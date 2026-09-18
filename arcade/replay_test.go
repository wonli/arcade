package arcade

import (
	"testing"

	"github.com/wonli/arcade/game"
)

func TestReplayHostRequiresStartedMatchingRoomHost(t *testing.T) {
	service := NewService()
	roomValue, err := service.Create("gomoku", 2)
	if err != nil {
		t.Fatal(err)
	}
	host := game.PlayerID("host")
	guest := game.PlayerID("guest")
	if err := service.Join(roomValue.ID, host, "Host"); err != nil {
		t.Fatal(err)
	}
	if service.ReplayHost(roomValue.ID, host, "gomoku") {
		t.Fatal("waiting room must not grant replay host")
	}
	if err := service.Join(roomValue.ID, guest, "Guest"); err != nil {
		t.Fatal(err)
	}
	if !service.ReplayHost(roomValue.ID, host, "gomoku") {
		t.Fatal("started room host should be replay host")
	}
	if service.ReplayHost(roomValue.ID, guest, "gomoku") {
		t.Fatal("non-host player must not be replay host")
	}
	if service.ReplayHost(roomValue.ID, host, "chess") {
		t.Fatal("game mismatch must not be accepted")
	}
	if service.ReplayHost("missing", host, "gomoku") {
		t.Fatal("missing room must not be accepted")
	}
}

func TestReplayHostAllowsDungeonHostBeforeSecondPlayerJoins(t *testing.T) {
	service := NewService()
	roomValue, err := service.Create("dungeon", 2)
	if err != nil {
		t.Fatal(err)
	}
	host := game.PlayerID("host")
	guest := game.PlayerID("guest")
	if err := service.Join(roomValue.ID, host, "Host"); err != nil {
		t.Fatal(err)
	}
	if roomValue.Started() {
		t.Fatal("single-player dungeon room should still be waiting for its optional co-op peer")
	}
	if !service.ReplayHost(roomValue.ID, host, "dungeon") {
		t.Fatal("dungeon host should be allowed to record while playing alone")
	}
	if service.ReplayHost(roomValue.ID, guest, "dungeon") {
		t.Fatal("player outside the room must not be replay host")
	}
}
