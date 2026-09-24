package server

import (
	"time"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/game/xiangqi"
	"github.com/wonli/arcade/room"
)

const xiangqiBotTurnLimit = 30 * time.Second

type xiangqiTurnClock struct {
	turn     xiangqi.Color
	ply      int
	deadline time.Time
	timer    *time.Timer
}

func (a *Actions) syncXiangqiTurnClock(roomID string) {
	r, ok := a.service.Get(roomID)
	if !ok {
		a.clearXiangqiTurnClock(roomID)
		return
	}
	snapshot := r.Snapshot()
	state, ok := snapshot["state"].(xiangqi.State)
	if !ok || state.Status != game.StatusPlaying {
		a.clearXiangqiTurnClock(roomID)
		return
	}
	players, ok := snapshot["players"].([]room.Player)
	if !ok || len(players) != 2 {
		a.clearXiangqiTurnClock(roomID)
		return
	}
	turnIndex := 0
	if state.Turn == xiangqi.Black {
		turnIndex = 1
	}
	if !players[turnIndex].Bot {
		// This is a bot-health watchdog, not a chess clock for human-v-human rooms.
		a.clearXiangqiTurnClock(roomID)
		return
	}

	a.xiangqiClockMu.Lock()
	defer a.xiangqiClockMu.Unlock()
	if a.xiangqiClocks == nil {
		a.xiangqiClocks = make(map[string]*xiangqiTurnClock)
	}
	if current := a.xiangqiClocks[roomID]; current != nil {
		if current.turn == state.Turn && current.ply == state.Ply {
			return
		}
		current.timer.Stop()
	}

	clock := &xiangqiTurnClock{
		turn:     state.Turn,
		ply:      state.Ply,
		deadline: time.Now().Add(xiangqiBotTurnLimit),
	}
	clock.timer = time.AfterFunc(xiangqiBotTurnLimit, func() {
		a.expireXiangqiTurn(roomID, clock)
	})
	a.xiangqiClocks[roomID] = clock
}

func (a *Actions) expireXiangqiTurn(roomID string, clock *xiangqiTurnClock) {
	a.xiangqiClockMu.Lock()
	current := a.xiangqiClocks[roomID]
	a.xiangqiClockMu.Unlock()
	if current != clock {
		return
	}

	forfeited, err := a.service.ForfeitXiangqiTurn(roomID, clock.turn, clock.ply)
	if err != nil || !forfeited {
		return
	}

	a.xiangqiClockMu.Lock()
	if a.xiangqiClocks[roomID] == clock {
		delete(a.xiangqiClocks, roomID)
	}
	a.xiangqiClockMu.Unlock()

	r, ok := a.service.Get(roomID)
	if !ok {
		return
	}
	ws.Pub(roomTopic(roomID), r.Snapshot())
}

func (a *Actions) clearXiangqiTurnClock(roomID string) {
	a.xiangqiClockMu.Lock()
	defer a.xiangqiClockMu.Unlock()
	if a.xiangqiClocks == nil {
		return
	}
	if clock := a.xiangqiClocks[roomID]; clock != nil {
		clock.timer.Stop()
		delete(a.xiangqiClocks, roomID)
	}
}

func (a *Actions) decorateXiangqiSnapshot(roomID string, snapshot map[string]any) {
	state, ok := snapshot["state"].(xiangqi.State)
	if !ok || state.Status != game.StatusPlaying {
		return
	}

	a.xiangqiClockMu.Lock()
	defer a.xiangqiClockMu.Unlock()
	clock := a.xiangqiClocks[roomID]
	if clock == nil || clock.turn != state.Turn || clock.ply != state.Ply {
		return
	}
	snapshot["turnDeadlineUnixMs"] = clock.deadline.UnixMilli()
}
