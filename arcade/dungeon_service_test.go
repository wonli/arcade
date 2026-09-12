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

func TestDungeonGuestCanLeaveAndBeReplacedAfterTheRoomStarts(t *testing.T) {
	s := NewService()
	r, err := s.Create("dungeon", 2)
	if err != nil { t.Fatal(err) }
	if err := s.Join(r.ID, "host", "Host"); err != nil { t.Fatal(err) }
	if err := s.Join(r.ID, "guest-1", "Guest 1"); err != nil { t.Fatal(err) }
	if err := s.LeaveDungeon(r.ID, "guest-1"); err != nil { t.Fatal(err) }
	if r.HasPlayer("guest-1") || !r.HasPlayer("host") || !r.Started() { t.Fatalf("room did not retain only its active host: %#v", r.Snapshot()) }
	if err := s.Join(r.ID, "guest-2", "Guest 2"); err != nil { t.Fatal(err) }
	if !r.HasPlayer("guest-2") || len(r.PlayerIDs()) != 2 { t.Fatalf("replacement guest did not occupy the open seat: %#v", r.Snapshot()) }
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
