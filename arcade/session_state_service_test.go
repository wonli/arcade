package arcade

import (
	"encoding/json"
	"errors"
	"testing"
)

func sessionStateServiceFixture(t *testing.T) (*Service, string) {
	t.Helper()
	s := NewService()
	r, err := s.Create("dungeon", 2)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "host", "Host"); err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "guest", "Guest"); err != nil {
		t.Fatal(err)
	}
	return s, r.ID
}

func sessionState(epoch, revision uint64, marker string) SessionState {
	return SessionState{
		AuthorityEpoch: epoch,
		Revision:       revision,
		SchemaVersion:  1,
		Payload:        json.RawMessage(`{"marker":"` + marker + `"}`),
	}
}

func TestServiceSessionStateRequiresHostForInitialAuthority(t *testing.T) {
	s, roomID := sessionStateServiceFixture(t)

	if err := s.PutSessionState(roomID, "guest", sessionState(1, 1, "guest")); !errors.Is(err, ErrSessionStateAuthority) {
		t.Fatalf("guest initial put error = %v, want ErrSessionStateAuthority", err)
	}
	if err := s.PutSessionState(roomID, "host", sessionState(1, 1, "host")); err != nil {
		t.Fatalf("host initial put: %v", err)
	}

	got, err := s.GetSessionState(roomID, "guest")
	if err != nil {
		t.Fatalf("room member get: %v", err)
	}
	if got.AuthorityID != "host" || got.AuthorityEpoch != 1 || got.Revision != 1 {
		t.Fatalf("unexpected state owner: %+v", got)
	}
}

func TestServiceSessionStateAllowsMemberAuthorityHandoffOnlyAtHigherEpoch(t *testing.T) {
	s, roomID := sessionStateServiceFixture(t)
	if err := s.PutSessionState(roomID, "host", sessionState(1, 4, "host")); err != nil {
		t.Fatal(err)
	}

	if err := s.PutSessionState(roomID, "guest", sessionState(1, 5, "same-epoch-hijack")); !errors.Is(err, ErrSessionStateAuthority) {
		t.Fatalf("same epoch authority change error = %v, want ErrSessionStateAuthority", err)
	}
	if err := s.PutSessionState(roomID, "guest", sessionState(2, 1, "handoff")); err != nil {
		t.Fatalf("higher epoch handoff rejected: %v", err)
	}
	if err := s.PutSessionState(roomID, "host", sessionState(1, 99, "old-host")); !errors.Is(err, ErrStaleSessionState) {
		t.Fatalf("old authority overwrite error = %v, want ErrStaleSessionState", err)
	}

	got, err := s.GetSessionState(roomID, "host")
	if err != nil {
		t.Fatal(err)
	}
	if got.AuthorityID != "guest" || got.AuthorityEpoch != 2 || string(got.Payload) != `{"marker":"handoff"}` {
		t.Fatalf("unexpected handoff state: %+v", got)
	}
}

func TestServiceSessionStateRejectsPlayersOutsideRoom(t *testing.T) {
	s, roomID := sessionStateServiceFixture(t)

	if _, err := s.GetSessionState(roomID, "intruder"); !errors.Is(err, ErrSessionStateMembership) {
		t.Fatalf("intruder get error = %v, want ErrSessionStateMembership", err)
	}
	if err := s.PutSessionState(roomID, "intruder", sessionState(2, 1, "intruder")); !errors.Is(err, ErrSessionStateMembership) {
		t.Fatalf("intruder put error = %v, want ErrSessionStateMembership", err)
	}
}
