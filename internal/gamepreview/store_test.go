package gamepreview

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func testJPEG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 320, 180))
	for y := 0; y < 180; y++ {
		for x := 0; x < 320; x++ {
			img.Set(x, y, color.RGBA{R: 24, G: 28, B: 32, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 80}); err != nil { t.Fatal(err) }
	return buf.Bytes()
}

func TestStoreRejectsUnknownGameAndOversizedSummary(t *testing.T) {
	store := NewStore(t.TempDir())
	_, err := store.Save("../oops", SaveInput{Image: testJPEG(t), ContentType: "image/jpeg", Players: 2})
	if err == nil { t.Fatal("expected unknown game error") }

	big := make([]byte, maxSummaryBytes+1)
	for i := range big { big[i] = 'a' }
	_, err = store.Save("gomoku", SaveInput{Image: testJPEG(t), ContentType: "image/jpeg", Players: 2, Summary: json.RawMessage(`{"x":"` + string(big) + `"}`)})
	if err == nil { t.Fatal("expected summary size error") }
}

func TestStoreSaveLoadAndReplaceKeepsOneImage(t *testing.T) {
	root := t.TempDir()
	now := time.Date(2026, 9, 17, 14, 0, 0, 0, time.UTC)
	store := NewStore(root)
	store.now = func() time.Time { return now }

	meta, err := store.Save("tetris", SaveInput{Image: testJPEG(t), ContentType: "image/jpeg", RoomID: "ABC123", Players: 2, Summary: json.RawMessage(`{"score":1200,"lines":8}`)})
	if err != nil { t.Fatal(err) }
	if meta.Game != "tetris" || meta.Players != 2 || meta.RoomID != "ABC123" { t.Fatalf("metadata = %#v", meta) }

	loaded, err := store.Load("tetris")
	if err != nil { t.Fatal(err) }
	if loaded.CapturedAt != now { t.Fatalf("capturedAt = %v", loaded.CapturedAt) }
	if _, err := os.Stat(filepath.Join(root, "game-previews", "tetris.jpg")); err != nil { t.Fatal(err) }

	matches, err := filepath.Glob(filepath.Join(root, "game-previews", "tetris.*"))
	if err != nil { t.Fatal(err) }
	if len(matches) != 2 { t.Fatalf("expected image + metadata only, got %v", matches) }
}

func TestStoreEnforcesThirtySecondCooldown(t *testing.T) {
	now := time.Date(2026, 9, 17, 14, 0, 0, 0, time.UTC)
	store := NewStore(t.TempDir())
	store.now = func() time.Time { return now }
	input := SaveInput{Image: testJPEG(t), ContentType: "image/jpeg", Players: 1}
	if _, err := store.Save("snake", input); err != nil { t.Fatal(err) }

	now = now.Add(5 * time.Second)
	_, err := store.Save("snake", input)
	cooldown, ok := err.(*CooldownError)
	if !ok { t.Fatalf("expected CooldownError, got %T %v", err, err) }
	if cooldown.RetryAfter < 24 || cooldown.RetryAfter > 25 { t.Fatalf("retryAfter = %d", cooldown.RetryAfter) }

	now = now.Add(25 * time.Second)
	if _, err := store.Save("snake", input); err != nil { t.Fatalf("expected cooldown expiry, got %v", err) }
}

func TestPreviewTokensExpire(t *testing.T) {
	now := time.Date(2026, 9, 17, 14, 0, 0, 0, time.UTC)
	store := NewStore(t.TempDir())
	store.now = func() time.Time { return now }
	token, expiresAt, err := store.IssueToken("player-1")
	if err != nil { t.Fatal(err) }
	if token == "" || !expiresAt.After(now) { t.Fatalf("token=%q expires=%v", token, expiresAt) }
	if !store.ValidateToken(token) { t.Fatal("fresh token should validate") }
	now = expiresAt.Add(time.Millisecond)
	if store.ValidateToken(token) { t.Fatal("expired token should fail") }
}
