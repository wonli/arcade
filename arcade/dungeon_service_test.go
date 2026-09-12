package arcade

import "testing"

func TestDungeonRoomWaitsForSecondPlayerThenStartsWithoutServerSimulation(t *testing.T) {
	s := NewService()
	r, err := s.Create("dungeon", 2)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "p1", "Player 1"); err != nil {
		t.Fatal(err)
	}
	if r.Started() {
		t.Fatal("dungeon room started before second player joined")
	}
	if err := s.Join(r.ID, "p2", "Player 2"); err != nil {
		t.Fatal(err)
	}
	if !r.Started() {
		t.Fatal("dungeon room did not start after second player joined")
	}
	if r.Game() != nil {
		t.Fatal("dungeon simulation should remain client-side on the host")
	}
}

func TestDungeonRequiresExactlyTwoPlayers(t *testing.T) {
	s := NewService()
	if _, err := s.Create("dungeon", 1); err == nil {
		t.Fatal("expected solo dungeon room to be rejected")
	}
	if _, err := s.Create("dungeon", 3); err == nil {
		t.Fatal("expected three-player dungeon room to be rejected")
	}
}

func TestDungeonRelayAuthorizesMembersAndReservesWorldStateForHost(t *testing.T) {
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
	if !s.CanRelayDungeon(r.ID, "guest", false) {
		t.Fatal("guest input should be allowed")
	}
	if s.CanRelayDungeon(r.ID, "guest", true) {
		t.Fatal("guest must not publish authoritative state")
	}
	if !s.CanRelayDungeon(r.ID, "host", true) {
		t.Fatal("host state should be allowed")
	}
	if s.CanRelayDungeon(r.ID, "intruder", false) {
		t.Fatal("outsider relay should be rejected")
	}
}
