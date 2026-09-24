package gamereplay

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	MaxReplayBytes = 100 << 10
	maxDurationMS  = 30_000
	leaseTTL       = 5 * time.Minute
)

var (
	ErrNotFound = errors.New("game replay not found")
	ErrLeaseBusy = errors.New("game replay lease busy")
	allowedGames = map[string]struct{}{
		"gomoku": {}, "chess": {}, "xiangqi": {}, "tetris": {}, "snake": {}, "drawguess": {}, "dungeon": {}, "policethief": {},
	}
)

type Metadata struct {
	Game       string    `json:"game"`
	Version    int       `json:"version"`
	DurationMS int       `json:"durationMs"`
	Players    int       `json:"players"`
	RecordedAt time.Time `json:"recordedAt"`
	Hash       string    `json:"hash"`
	Size       int       `json:"size"`
}

type SaveInput struct {
	Version    int
	DurationMS int
	Players    int
	Hash       string
	Data       []byte
}

type Lease struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type leaseEntry struct {
	Holder    string
	Token     string
	ExpiresAt time.Time
}

type Store struct {
	root string
	now  func() time.Time

	locksMu sync.Mutex
	locks   map[string]*sync.Mutex

	leaseMu sync.Mutex
	leases  map[string]leaseEntry
}

func NewStore(root string) *Store {
	return &Store{
		root:   root,
		now:    time.Now,
		locks:  make(map[string]*sync.Mutex),
		leases: make(map[string]leaseEntry),
	}
}

func normalizeGame(game string) (string, error) {
	game = strings.ToLower(strings.TrimSpace(game))
	if _, ok := allowedGames[game]; !ok {
		return "", fmt.Errorf("unknown game: %s", game)
	}
	return game, nil
}

func (s *Store) dir() string { return filepath.Join(s.root, "game-replays") }
func (s *Store) metadataPath(game string) string { return filepath.Join(s.dir(), game+".json") }
func (s *Store) dataPath(game string) string { return filepath.Join(s.dir(), game+".bin") }

func (s *Store) gameLock(game string) *sync.Mutex {
	s.locksMu.Lock()
	defer s.locksMu.Unlock()
	lock := s.locks[game]
	if lock == nil {
		lock = &sync.Mutex{}
		s.locks[game] = lock
	}
	return lock
}

func (s *Store) Save(game string, input SaveInput) (Metadata, error) {
	game, err := normalizeGame(game)
	if err != nil {
		return Metadata{}, err
	}
	if err := validateSaveInput(input); err != nil {
		return Metadata{}, err
	}

	lock := s.gameLock(game)
	lock.Lock()
	defer lock.Unlock()

	if err := os.MkdirAll(s.dir(), 0o755); err != nil {
		return Metadata{}, fmt.Errorf("create replay directory: %w", err)
	}

	now := s.now().UTC()
	meta := Metadata{
		Game: game,
		Version: input.Version,
		DurationMS: input.DurationMS,
		Players: input.Players,
		RecordedAt: now,
		Hash: strings.ToLower(input.Hash),
		Size: len(input.Data),
	}

	if err := atomicWrite(s.dataPath(game), input.Data, 0o644); err != nil {
		return Metadata{}, fmt.Errorf("write replay data: %w", err)
	}
	doc, err := json.Marshal(meta)
	if err != nil {
		return Metadata{}, fmt.Errorf("encode replay metadata: %w", err)
	}
	if err := atomicWrite(s.metadataPath(game), doc, 0o644); err != nil {
		return Metadata{}, fmt.Errorf("write replay metadata: %w", err)
	}
	return meta, nil
}

func (s *Store) Load(game string) (Metadata, []byte, error) {
	game, err := normalizeGame(game)
	if err != nil {
		return Metadata{}, nil, err
	}
	lock := s.gameLock(game)
	lock.Lock()
	defer lock.Unlock()

	doc, err := os.ReadFile(s.metadataPath(game))
	if os.IsNotExist(err) {
		return Metadata{}, nil, ErrNotFound
	}
	if err != nil {
		return Metadata{}, nil, fmt.Errorf("read replay metadata: %w", err)
	}
	var meta Metadata
	if err := json.Unmarshal(doc, &meta); err != nil {
		return Metadata{}, nil, fmt.Errorf("decode replay metadata: %w", err)
	}
	if meta.Game != game {
		return Metadata{}, nil, errors.New("replay metadata game mismatch")
	}
	data, err := os.ReadFile(s.dataPath(game))
	if os.IsNotExist(err) {
		return Metadata{}, nil, ErrNotFound
	}
	if err != nil {
		return Metadata{}, nil, fmt.Errorf("read replay data: %w", err)
	}
	if len(data) != meta.Size {
		return Metadata{}, nil, errors.New("replay data size mismatch")
	}
	if sha256Hex(data) != strings.ToLower(meta.Hash) {
		return Metadata{}, nil, errors.New("replay data hash mismatch")
	}
	return meta, data, nil
}

func (s *Store) DataPath(game string) (string, error) {
	game, err := normalizeGame(game)
	if err != nil {
		return "", err
	}
	path := s.dataPath(game)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return "", ErrNotFound
	} else if err != nil {
		return "", err
	}
	return path, nil
}

func (s *Store) AcquireLease(game, holder string) (Lease, error) {
	game, err := normalizeGame(game)
	if err != nil {
		return Lease{}, err
	}
	holder = strings.TrimSpace(holder)
	if holder == "" {
		return Lease{}, errors.New("lease holder is required")
	}

	s.leaseMu.Lock()
	defer s.leaseMu.Unlock()

	now := s.now().UTC()
	if current, ok := s.leases[game]; ok && current.ExpiresAt.After(now) {
		if current.Holder != holder {
			return Lease{}, ErrLeaseBusy
		}
		current.ExpiresAt = now.Add(leaseTTL)
		s.leases[game] = current
		return Lease{Token: current.Token, ExpiresAt: current.ExpiresAt}, nil
	}

	token, err := randomToken()
	if err != nil {
		return Lease{}, err
	}
	entry := leaseEntry{Holder: holder, Token: token, ExpiresAt: now.Add(leaseTTL)}
	s.leases[game] = entry
	return Lease{Token: entry.Token, ExpiresAt: entry.ExpiresAt}, nil
}

func (s *Store) ValidateLease(game, token string) bool {
	game, err := normalizeGame(game)
	if err != nil {
		return false
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return false
	}

	s.leaseMu.Lock()
	defer s.leaseMu.Unlock()
	entry, ok := s.leases[game]
	if !ok {
		return false
	}
	if !entry.ExpiresAt.After(s.now().UTC()) {
		delete(s.leases, game)
		return false
	}
	return entry.Token == token
}

func (s *Store) ReleaseLease(game, token string) bool {
	game, err := normalizeGame(game)
	if err != nil {
		return false
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return false
	}

	s.leaseMu.Lock()
	defer s.leaseMu.Unlock()
	entry, ok := s.leases[game]
	if !ok || entry.Token != token {
		return false
	}
	delete(s.leases, game)
	return true
}

func validateSaveInput(input SaveInput) error {
	if input.Version <= 0 { return errors.New("replay version must be positive") }
	if input.DurationMS <= 0 || input.DurationMS > maxDurationMS { return errors.New("replay duration is invalid") }
	if input.Players <= 0 || input.Players > 8 { return errors.New("replay player count is invalid") }
	if len(input.Data) == 0 || len(input.Data) > MaxReplayBytes { return errors.New("replay payload size is invalid") }
	hash := strings.ToLower(strings.TrimSpace(input.Hash))
	if len(hash) != sha256.Size*2 { return errors.New("replay hash is invalid") }
	if _, err := hex.DecodeString(hash); err != nil { return errors.New("replay hash is invalid") }
	if sha256Hex(input.Data) != hash { return errors.New("replay hash mismatch") }
	return nil
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func randomToken() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func atomicWrite(path string, data []byte, perm os.FileMode) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".*.tmp")
	if err != nil { return err }
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if err := tmp.Chmod(perm); err != nil { tmp.Close(); return err }
	if _, err := tmp.Write(data); err != nil { tmp.Close(); return err }
	if err := tmp.Sync(); err != nil { tmp.Close(); return err }
	if err := tmp.Close(); err != nil { return err }
	return os.Rename(tmpPath, path)
}
