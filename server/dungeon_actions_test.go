package server

import (
	"testing"

	"github.com/wonli/arcade/arcade"
)

func dungeonActionsFixture(t *testing.T) (*Actions, string) {
	t.Helper()
	s := arcade.NewService()
	r, err := s.Create("dungeon", 2)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "p2", "Player 2"); err != nil {
		t.Fatal(err)
	}
	return NewActions(s), r.ID
}

func TestDungeonFactRelayAllowsEitherRoomMember(t *testing.T) {
	a, roomID := dungeonActionsFixture(t)

	if !a.dungeonFactRelayAllowed(roomID, "p1") {
		t.Fatal("initial room host should be allowed to relay dungeon facts")
	}
	if !a.dungeonFactRelayAllowed(roomID, "p2") {
		t.Fatal("second room member should be allowed to relay facts after authority handoff")
	}
}

func TestDungeonFactRelayRejectsNonMembersAndMissingRooms(t *testing.T) {
	a, roomID := dungeonActionsFixture(t)

	if a.dungeonFactRelayAllowed(roomID, "intruder") {
		t.Fatal("non-member must not relay dungeon facts")
	}
	if a.dungeonFactRelayAllowed("MISSING", "p1") {
		t.Fatal("missing room must not relay dungeon facts")
	}
}
