package gamereplay

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func replayHash(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func validInput(data []byte) SaveInput {
	return SaveInput{Version: 1, DurationMS: 20_000, Players: 2, Hash: replayHash(data), Data: data}
}

func TestStoreSaveLoadAndReplaceKeepsOneReplay(t *testing.T) {
	root := t.TempDir()
	now := time.Date(2026, 9, 17, 9, 0, 0, 0, time.UTC)
	store := NewStore(root)
	store.now = func() time.Time { return now }

	first := []byte(`{"frames":[1]}`)
	meta, err := store.Save("tetris", validInput(first))
	if err != nil { t.Fatal(err) }
	if meta.Game != "tetris" || meta.Size != len(first) || meta.RecordedAt != now { t.Fatalf("metadata = %#v", meta) }

	loaded, data, err := store.Load("tetris")
	if err != nil { t.Fatal(err) }
	if loaded.Hash != replayHash(first) || string(data) != string(first) { t.Fatalf("loaded=%#v data=%q", loaded, data) }

	now = now.Add(time.Minute)
	second := []byte(`{"frames":[2,3]}`)
	if _, err := store.Save("tetris", validInput(second)); err != nil { t.Fatal(err) }
	_, data, err = store.Load("tetris")
	if err != nil || string(data) != string(second) { t.Fatalf("replacement data=%q err=%v", data, err) }

	matches, err := filepath.Glob(filepath.Join(root, "game-replays", "tetris.*"))
	if err != nil { t.Fatal(err) }
	if len(matches) != 2 { t.Fatalf("expected metadata + binary only, got %v", matches) }
	for _, path := range matches { if _, err := os.Stat(path); err != nil { t.Fatal(err) } }
}

func TestStoreValidatesReplayEnvelope(t *testing.T) {
	store := NewStore(t.TempDir())
	data := []byte("replay")

	cases := []struct {
		name string
		game string
		input SaveInput
	}{
		{"unknown game", "../oops", validInput(data)},
		{"zero version", "gomoku", SaveInput{DurationMS: 1000, Players: 2, Hash: replayHash(data), Data: data}},
		{"zero duration", "gomoku", SaveInput{Version: 1, Players: 2, Hash: replayHash(data), Data: data}},
		{"long duration", "gomoku", SaveInput{Version: 1, DurationMS: 30_001, Players: 2, Hash: replayHash(data), Data: data}},
		{"too many players", "gomoku", SaveInput{Version: 1, DurationMS: 1000, Players: 9, Hash: replayHash(data), Data: data}},
		{"hash mismatch", "gomoku", SaveInput{Version: 1, DurationMS: 1000, Players: 2, Hash: replayHash([]byte("other")), Data: data}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := store.Save(tc.game, tc.input); err == nil { t.Fatal("expected validation error") }
		})
	}
}

func TestStoreRejectsPayloadOver100KiB(t *testing.T) {
	store := NewStore(t.TempDir())
	data := make([]byte, MaxReplayBytes+1)
	input := validInput(data)
	if _, err := store.Save("snake", input); err == nil { t.Fatal("expected oversized replay to fail") }

	data = make([]byte, MaxReplayBytes)
	input = validInput(data)
	if _, err := store.Save("snake", input); err != nil { t.Fatalf("100 KiB boundary should pass: %v", err) }
}

func TestLeaseRenewsForHolderAndBlocksOthersUntilExpiry(t *testing.T) {
	now := time.Date(2026, 9, 17, 9, 0, 0, 0, time.UTC)
	store := NewStore(t.TempDir())
	store.now = func() time.Time { return now }

	first, err := store.AcquireLease("tetris", "room-a:host-a")
	if err != nil { t.Fatal(err) }
	if first.Token == "" || first.ExpiresAt.Sub(now) != 5*time.Minute { t.Fatalf("lease = %#v", first) }
	if !store.ValidateLease("tetris", first.Token) { t.Fatal("fresh lease should validate") }

	now = now.Add(time.Minute)
	renewed, err := store.AcquireLease("tetris", "room-a:host-a")
	if err != nil { t.Fatal(err) }
	if renewed.Token != first.Token { t.Fatalf("same holder should renew same token: %q != %q", renewed.Token, first.Token) }
	if !renewed.ExpiresAt.After(first.ExpiresAt) { t.Fatal("renewal should extend expiry") }

	if _, err := store.AcquireLease("tetris", "room-b:host-b"); !errors.Is(err, ErrLeaseBusy) { t.Fatalf("expected ErrLeaseBusy, got %v", err) }

	now = renewed.ExpiresAt.Add(time.Millisecond)
	if store.ValidateLease("tetris", renewed.Token) { t.Fatal("expired lease should not validate") }
	takeover, err := store.AcquireLease("tetris", "room-b:host-b")
	if err != nil { t.Fatal(err) }
	if takeover.Token == renewed.Token { t.Fatal("new holder should receive a new token") }
}
