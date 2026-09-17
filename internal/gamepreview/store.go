package gamepreview

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	maxImageBytes   = 500 << 10
	maxSummaryBytes = 4 << 10
	maxImageWidth   = 1920
	maxImageHeight  = 1080
	maxImagePixels  = maxImageWidth * maxImageHeight
	previewCooldown = 30 * time.Second
	previewTokenTTL = 2 * time.Minute
)

var (
	ErrNotFound = errors.New("game preview not found")
	allowedGames = map[string]struct{}{
		"gomoku": {}, "chess": {}, "tetris": {}, "snake": {}, "drawguess": {}, "dungeon": {},
	}
)

type Metadata struct {
	Game        string          `json:"game"`
	CapturedAt  time.Time       `json:"capturedAt"`
	RoomID      string          `json:"roomId,omitempty"`
	Players     int             `json:"players,omitempty"`
	Summary     json.RawMessage `json:"summary,omitempty"`
	ContentType string          `json:"contentType"`
}

type SaveInput struct {
	Image       []byte
	ContentType string
	RoomID      string
	Players     int
	Summary     json.RawMessage
}

type CooldownError struct { RetryAfter int }

func (e *CooldownError) Error() string { return fmt.Sprintf("game preview cooldown: retry in %ds", e.RetryAfter) }

type previewToken struct {
	PlayerID  string
	ExpiresAt time.Time
}

type Store struct {
	root     string
	now      func() time.Time
	tokenTTL time.Duration

	tokenMu sync.Mutex
	tokens  map[string]previewToken

	locksMu sync.Mutex
	locks   map[string]*sync.Mutex
}

func NewStore(root string) *Store {
	return &Store{
		root: root, now: time.Now, tokenTTL: previewTokenTTL,
		tokens: make(map[string]previewToken), locks: make(map[string]*sync.Mutex),
	}
}

func normalizeGame(game string) (string, error) {
	game = strings.ToLower(strings.TrimSpace(game))
	if _, ok := allowedGames[game]; !ok { return "", fmt.Errorf("unknown game: %s", game) }
	return game, nil
}

func (s *Store) dir() string { return filepath.Join(s.root, "game-previews") }
func (s *Store) metadataPath(game string) string { return filepath.Join(s.dir(), game+".json") }

func imageExtension(contentType string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(contentType)) {
	case "image/jpeg", "image/jpg": return ".jpg", nil
	case "image/webp": return ".webp", nil
	default: return "", fmt.Errorf("unsupported preview content type: %s", contentType)
	}
}

func (s *Store) gameLock(game string) *sync.Mutex {
	s.locksMu.Lock()
	defer s.locksMu.Unlock()
	lock := s.locks[game]
	if lock == nil { lock = &sync.Mutex{}; s.locks[game] = lock }
	return lock
}

func (s *Store) Load(game string) (Metadata, error) {
	game, err := normalizeGame(game)
	if err != nil { return Metadata{}, err }
	return s.loadUnlocked(game)
}

func (s *Store) loadUnlocked(game string) (Metadata, error) {
	doc, err := os.ReadFile(s.metadataPath(game))
	if os.IsNotExist(err) { return Metadata{}, ErrNotFound }
	if err != nil { return Metadata{}, fmt.Errorf("read preview metadata: %w", err) }
	var meta Metadata
	if err := json.Unmarshal(doc, &meta); err != nil { return Metadata{}, fmt.Errorf("decode preview metadata: %w", err) }
	if meta.Game != game { return Metadata{}, errors.New("preview metadata game mismatch") }
	return meta, nil
}

func (s *Store) ImagePath(game string) (string, error) {
	meta, err := s.Load(game)
	if err != nil { return "", err }
	ext, err := imageExtension(meta.ContentType)
	if err != nil { return "", err }
	path := filepath.Join(s.dir(), game+ext)
	if _, err := os.Stat(path); os.IsNotExist(err) { return "", ErrNotFound } else if err != nil { return "", err }
	return path, nil
}

func (s *Store) Save(game string, input SaveInput) (Metadata, error) {
	game, err := normalizeGame(game)
	if err != nil { return Metadata{}, err }
	lock := s.gameLock(game)
	lock.Lock()
	defer lock.Unlock()

	if err := validateSaveInput(input); err != nil { return Metadata{}, err }
	now := s.now().UTC()
	if current, err := s.loadUnlocked(game); err == nil {
		if elapsed := now.Sub(current.CapturedAt); elapsed < previewCooldown {
			remaining := previewCooldown - elapsed
			return Metadata{}, &CooldownError{RetryAfter: maxInt(1, int(math.Ceil(remaining.Seconds())))}
		}
	} else if !errors.Is(err, ErrNotFound) {
		return Metadata{}, err
	}

	if err := os.MkdirAll(s.dir(), 0o755); err != nil { return Metadata{}, fmt.Errorf("create preview directory: %w", err) }
	ext, _ := imageExtension(input.ContentType)
	imagePath := filepath.Join(s.dir(), game+ext)
	if err := atomicWrite(imagePath, input.Image, 0o644); err != nil { return Metadata{}, fmt.Errorf("write preview image: %w", err) }

	meta := Metadata{
		Game: game, CapturedAt: now, RoomID: strings.TrimSpace(input.RoomID), Players: input.Players,
		Summary: cloneJSON(input.Summary), ContentType: canonicalContentType(input.ContentType),
	}
	doc, err := json.Marshal(meta)
	if err != nil { return Metadata{}, fmt.Errorf("encode preview metadata: %w", err) }
	if err := atomicWrite(s.metadataPath(game), doc, 0o644); err != nil { return Metadata{}, fmt.Errorf("write preview metadata: %w", err) }

	other := ".jpg"
	if ext == ".jpg" { other = ".webp" }
	_ = os.Remove(filepath.Join(s.dir(), game+other))
	return meta, nil
}

func validateSaveInput(input SaveInput) error {
	if len(input.Image) == 0 { return errors.New("preview image is required") }
	if len(input.Image) > maxImageBytes { return fmt.Errorf("preview image exceeds %d bytes", maxImageBytes) }
	if len(input.RoomID) > 64 { return errors.New("room id is too long") }
	if input.Players < 0 || input.Players > 8 { return errors.New("players must be between 0 and 8") }
	if len(input.Summary) > maxSummaryBytes { return fmt.Errorf("preview summary exceeds %d bytes", maxSummaryBytes) }
	if len(input.Summary) > 0 && !json.Valid(input.Summary) { return errors.New("preview summary is not valid JSON") }

	contentType := canonicalContentType(input.ContentType)
	if _, err := imageExtension(contentType); err != nil { return err }
	detected := http.DetectContentType(input.Image)
	if detected != contentType {
		return fmt.Errorf("preview content type mismatch: declared %s detected %s", contentType, detected)
	}
	width, height, err := imageDimensions(input.Image, contentType)
	if err != nil { return fmt.Errorf("decode preview image: %w", err) }
	if width < 1 || height < 1 || width > maxImageWidth || height > maxImageHeight || width*height > maxImagePixels {
		return fmt.Errorf("preview dimensions %dx%d exceed limits", width, height)
	}
	return nil
}

func canonicalContentType(value string) string {
	value = strings.ToLower(strings.TrimSpace(strings.Split(value, ";")[0]))
	if value == "image/jpg" { return "image/jpeg" }
	return value
}

func imageDimensions(data []byte, contentType string) (int, int, error) {
	if contentType == "image/webp" { return webpDimensions(data) }
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil { return 0, 0, err }
	return config.Width, config.Height, nil
}

func webpDimensions(data []byte) (int, int, error) {
	if len(data) < 30 || string(data[:4]) != "RIFF" || string(data[8:12]) != "WEBP" { return 0, 0, errors.New("invalid webp header") }
	switch string(data[12:16]) {
	case "VP8X":
		w := 1 + int(data[24]) + int(data[25])<<8 + int(data[26])<<16
		h := 1 + int(data[27]) + int(data[28])<<8 + int(data[29])<<16
		return w, h, nil
	case "VP8 ":
		if len(data) < 30 || data[23] != 0x9d || data[24] != 0x01 || data[25] != 0x2a { return 0, 0, errors.New("invalid vp8 frame") }
		w := int(data[26]) | int(data[27])<<8
		h := int(data[28]) | int(data[29])<<8
		return w & 0x3fff, h & 0x3fff, nil
	case "VP8L":
		if len(data) < 25 || data[20] != 0x2f { return 0, 0, errors.New("invalid vp8l frame") }
		bits := uint32(data[21]) | uint32(data[22])<<8 | uint32(data[23])<<16 | uint32(data[24])<<24
		return int(bits&0x3fff) + 1, int((bits>>14)&0x3fff) + 1, nil
	default:
		return 0, 0, errors.New("unsupported webp chunk")
	}
}

func atomicWrite(path string, data []byte, mode os.FileMode) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".preview-*.tmp")
	if err != nil { return err }
	name := tmp.Name()
	remove := true
	defer func() { _ = tmp.Close(); if remove { _ = os.Remove(name) } }()
	if _, err := tmp.Write(data); err != nil { return err }
	if err := tmp.Sync(); err != nil { return err }
	if err := tmp.Chmod(mode); err != nil { return err }
	if err := tmp.Close(); err != nil { return err }
	if err := os.Rename(name, path); err != nil { return err }
	remove = false
	return nil
}

func cloneJSON(value json.RawMessage) json.RawMessage {
	if len(value) == 0 { return nil }
	return append(json.RawMessage(nil), value...)
}

func (s *Store) IssueToken(playerID string) (string, time.Time, error) {
	playerID = strings.TrimSpace(playerID)
	if playerID == "" { return "", time.Time{}, errors.New("player id is required") }
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil { return "", time.Time{}, fmt.Errorf("generate preview token: %w", err) }
	token := hex.EncodeToString(bytes)
	expires := s.now().Add(s.tokenTTL)
	s.tokenMu.Lock()
	defer s.tokenMu.Unlock()
	now := s.now()
	for key, value := range s.tokens { if !value.ExpiresAt.After(now) { delete(s.tokens, key) } }
	s.tokens[token] = previewToken{PlayerID: playerID, ExpiresAt: expires}
	return token, expires, nil
}

func (s *Store) ValidateToken(token string) bool {
	token = strings.TrimSpace(token)
	if token == "" { return false }
	s.tokenMu.Lock()
	defer s.tokenMu.Unlock()
	entry, ok := s.tokens[token]
	if !ok { return false }
	if !entry.ExpiresAt.After(s.now()) { delete(s.tokens, token); return false }
	return true
}

func maxInt(a, b int) int { if a > b { return a }; return b }
