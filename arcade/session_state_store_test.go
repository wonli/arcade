package arcade

import (
	"encoding/json"
	"errors"
	"testing"
	"time"
)

func TestSessionStateStoreKeepsLatestOpaqueStatePerSession(t *testing.T) {
	now := time.Date(2026, 9, 16, 19, 30, 0, 0, time.FixedZone("CST", 8*60*60))
	store := NewSessionStateStore(SessionStateStoreOptions{
		TTL: 30 * time.Minute,
		Now: func() time.Time { return now },
	})

	firstPayload := json.RawMessage(`{"world":{"floor":2},"players":{"p1":{"x":12}}}`)
	if err := store.Put("ROOM-A", SessionState{
		AuthorityEpoch: 1,
		Revision:       7,
		SchemaVersion:  1,
		Payload:        firstPayload,
	}); err != nil {
		t.Fatalf("put first state: %v", err)
	}
	if err := store.Put("ROOM-B", SessionState{
		AuthorityEpoch: 3,
		Revision:       2,
		SchemaVersion:  4,
		Payload:        json.RawMessage(`{"marker":"room-b"}`),
	}); err != nil {
		t.Fatalf("put second session: %v", err)
	}

	got, ok := store.Get("ROOM-A")
	if !ok {
		t.Fatal("expected ROOM-A state")
	}
	if got.AuthorityEpoch != 1 || got.Revision != 7 || got.SchemaVersion != 1 {
		t.Fatalf("unexpected metadata: %+v", got)
	}
	if string(got.Payload) != string(firstPayload) {
		t.Fatalf("payload changed: %s", got.Payload)
	}
	if !got.UpdatedAt.Equal(now) {
		t.Fatalf("updatedAt = %v, want %v", got.UpdatedAt, now)
	}

	got.Payload[0] = '['
	again, ok := store.Get("ROOM-A")
	if !ok || string(again.Payload) != string(firstPayload) {
		t.Fatalf("store leaked mutable payload: %s", again.Payload)
	}

	other, ok := store.Get("ROOM-B")
	if !ok || string(other.Payload) != `{"marker":"room-b"}` {
		t.Fatalf("session state leaked across rooms: %+v", other)
	}
}

func TestSessionStateStoreRejectsStaleEpochAndRevision(t *testing.T) {
	store := NewSessionStateStore(SessionStateStoreOptions{TTL: time.Hour})
	put := func(epoch, revision uint64, marker string) error {
		return store.Put("ROOM", SessionState{
			AuthorityEpoch: epoch,
			Revision:       revision,
			SchemaVersion:  1,
			Payload:        json.RawMessage(`{"marker":"` + marker + `"}`),
		})
	}

	if err := put(4, 9, "current"); err != nil {
		t.Fatal(err)
	}
	if err := put(3, 99, "old-authority"); !errors.Is(err, ErrStaleSessionState) {
		t.Fatalf("older authority epoch error = %v, want ErrStaleSessionState", err)
	}
	if err := put(4, 9, "same-revision"); !errors.Is(err, ErrStaleSessionState) {
		t.Fatalf("same revision error = %v, want ErrStaleSessionState", err)
	}
	if err := put(4, 8, "older-revision"); !errors.Is(err, ErrStaleSessionState) {
		t.Fatalf("older revision error = %v, want ErrStaleSessionState", err)
	}
	if err := put(4, 10, "newer-revision"); err != nil {
		t.Fatalf("newer revision rejected: %v", err)
	}
	if err := put(5, 1, "new-authority"); err != nil {
		t.Fatalf("new authority epoch rejected: %v", err)
	}

	got, ok := store.Get("ROOM")
	if !ok || got.AuthorityEpoch != 5 || got.Revision != 1 || string(got.Payload) != `{"marker":"new-authority"}` {
		t.Fatalf("unexpected latest state: %+v, ok=%v", got, ok)
	}
}

func TestSessionStateStoreExpiresLazilyAfterTTL(t *testing.T) {
	now := time.Date(2026, 9, 16, 19, 30, 0, 0, time.UTC)
	store := NewSessionStateStore(SessionStateStoreOptions{
		TTL: 30 * time.Minute,
		Now: func() time.Time { return now },
	})
	if err := store.Put("ROOM", SessionState{
		AuthorityEpoch: 1,
		Revision:       1,
		SchemaVersion:  1,
		Payload:        json.RawMessage(`{"floor":2}`),
	}); err != nil {
		t.Fatal(err)
	}

	now = now.Add(29*time.Minute + 59*time.Second)
	if _, ok := store.Get("ROOM"); !ok {
		t.Fatal("state expired before TTL")
	}

	now = now.Add(2 * time.Second)
	if _, ok := store.Get("ROOM"); ok {
		t.Fatal("state should expire after TTL")
	}
}
