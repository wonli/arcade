package server

import (
	"errors"
	"testing"

	"github.com/wonli/arcade/arcade"
	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/internal/gamereplay"
)

func TestAcquireReplayLeaseRequiresStartedRoomHost(t *testing.T) {
	service := arcade.NewService()
	store := gamereplay.NewStore(t.TempDir())
	roomValue, err := service.Create("gomoku", 2)
	if err != nil { t.Fatal(err) }
	host := game.PlayerID("host")
	guest := game.PlayerID("guest")
	if err := service.Join(roomValue.ID, host, "Host"); err != nil { t.Fatal(err) }
	if _, err := acquireReplayLease(service, store, roomValue.ID, "gomoku", host); err == nil {
		t.Fatal("waiting room should not receive replay lease")
	}
	if err := service.Join(roomValue.ID, guest, "Guest"); err != nil { t.Fatal(err) }
	lease, err := acquireReplayLease(service, store, roomValue.ID, "gomoku", host)
	if err != nil { t.Fatal(err) }
	if lease.Token == "" || !store.ValidateLease("gomoku", lease.Token) {
		t.Fatalf("invalid lease %#v", lease)
	}
	if _, err := acquireReplayLease(service, store, roomValue.ID, "gomoku", guest); err == nil {
		t.Fatal("guest must not receive replay lease")
	}
	if _, err := acquireReplayLease(service, store, roomValue.ID, "chess", host); err == nil {
		t.Fatal("game mismatch must not receive replay lease")
	}
}

func TestAcquireReplayLeaseAllowsDungeonHostBeforeSecondPlayerJoins(t *testing.T) {
	service := arcade.NewService()
	store := gamereplay.NewStore(t.TempDir())
	roomValue, err := service.Create("dungeon", 2)
	if err != nil { t.Fatal(err) }
	host := game.PlayerID("host")
	guest := game.PlayerID("guest")
	if err := service.Join(roomValue.ID, host, "Host"); err != nil { t.Fatal(err) }

	lease, err := acquireReplayLease(service, store, roomValue.ID, "dungeon", host)
	if err != nil { t.Fatal(err) }
	if lease.Token == "" || !store.ValidateLease("dungeon", lease.Token) {
		t.Fatalf("invalid dungeon lease %#v", lease)
	}
	if _, err := acquireReplayLease(service, store, roomValue.ID, "dungeon", guest); err == nil {
		t.Fatal("player outside the room must not receive dungeon replay lease")
	}
}

func TestAcquireReplayLeaseAllowsStandaloneDungeonPlayer(t *testing.T) {
	service := arcade.NewService()
	store := gamereplay.NewStore(t.TempDir())
	player := game.PlayerID("solo-player")

	lease, err := acquireReplayLease(service, store, standaloneDungeonReplayRoomID, "dungeon", player)
	if err != nil { t.Fatal(err) }
	if lease.Token == "" || !store.ValidateLease("dungeon", lease.Token) {
		t.Fatalf("invalid standalone dungeon lease %#v", lease)
	}
	if _, err := acquireReplayLease(service, store, standaloneDungeonReplayRoomID, "gomoku", player); err == nil {
		t.Fatal("standalone replay lease must remain dungeon-only")
	}
}

func TestAcquireReplayLeaseReturnsBusyForAnotherRoom(t *testing.T) {
	service := arcade.NewService()
	store := gamereplay.NewStore(t.TempDir())

	makeRoom := func(hostID, guestID string) (string, game.PlayerID) {
		r, err := service.Create("gomoku", 2)
		if err != nil { t.Fatal(err) }
		host := game.PlayerID(hostID)
		if err := service.Join(r.ID, host, hostID); err != nil { t.Fatal(err) }
		if err := service.Join(r.ID, game.PlayerID(guestID), guestID); err != nil { t.Fatal(err) }
		return r.ID, host
	}

	roomA, hostA := makeRoom("host-a", "guest-a")
	roomB, hostB := makeRoom("host-b", "guest-b")
	if _, err := acquireReplayLease(service, store, roomA, "gomoku", hostA); err != nil { t.Fatal(err) }
	if _, err := acquireReplayLease(service, store, roomB, "gomoku", hostB); !errors.Is(err, gamereplay.ErrLeaseBusy) {
		t.Fatalf("expected replay lease busy, got %v", err)
	}
}
