package server

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/wonli/arcade/arcade"
	"github.com/wonli/arcade/game/xiangqi"
)

func TestXiangqiTurnClockOnlyTracksBotTurn(t *testing.T) {
	s := arcade.NewService()
	r, err := s.Create("xiangqi", 2)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Join(r.ID, "red", "Red"); err != nil {
		t.Fatal(err)
	}
	if err := s.AddBot(r.ID, "red"); err != nil {
		t.Fatal(err)
	}

	a := NewActions(s)
	t.Cleanup(func() { a.clearXiangqiTurnClock(r.ID) })
	a.syncXiangqiTurnClock(r.ID)

	a.xiangqiClockMu.Lock()
	opening := a.xiangqiClocks[r.ID]
	a.xiangqiClockMu.Unlock()
	if opening != nil {
		t.Fatalf("human red opening turn unexpectedly has a watchdog: %#v", opening)
	}

	state := r.Game().State().(xiangqi.State)
	payload, err := json.Marshal(state.Legal[0])
	if err != nil {
		t.Fatal(err)
	}
	if err := s.MovePlayer(r.ID, "red", payload); err != nil {
		t.Fatal(err)
	}
	a.syncXiangqiTurnClock(r.ID)

	a.xiangqiClockMu.Lock()
	clock := a.xiangqiClocks[r.ID]
	a.xiangqiClockMu.Unlock()
	if clock == nil || clock.turn != xiangqi.Black || clock.ply != 1 || !clock.deadline.After(time.Now()) {
		t.Fatalf("unexpected black bot clock: %#v", clock)
	}

	snapshot := r.Snapshot()
	a.decorateXiangqiSnapshot(r.ID, snapshot)
	if _, ok := snapshot["turnDeadlineUnixMs"].(int64); !ok {
		t.Fatalf("snapshot missing server deadline: %#v", snapshot["turnDeadlineUnixMs"])
	}
}
