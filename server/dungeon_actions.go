package server

import (
	"encoding/json"
	"strings"

	"github.com/wonli/aqi/ws"
)

func (a *Actions) RegisterDungeon(router ws.IRouter) {
	router.Add("dungeon.input", a.dungeonInput)
	router.Add("dungeon.state", a.dungeonState)
}

type dungeonInputRequest struct {
	RoomID string          `json:"roomId"`
	Input  json.RawMessage `json:"input"`
}

type dungeonStateRequest struct {
	RoomID string          `json:"roomId"`
	State  json.RawMessage `json:"state"`
}

func (a *Actions) dungeonInput(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req dungeonInputRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" || len(req.Input) == 0 {
		c.SendCode(400, "invalid dungeon input")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(req.RoomID))
	if !a.service.CanRelayDungeon(roomID, playerID, false) {
		c.SendCode(400, "invalid dungeon room")
		return
	}
	c.Pub(roomTopic(roomID), ws.H{"type": "dungeon.input", "playerId": playerID, "input": req.Input})
	c.Send(ws.H{"ok": true})
}

func (a *Actions) dungeonState(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req dungeonStateRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" || len(req.State) == 0 {
		c.SendCode(400, "invalid dungeon state")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(req.RoomID))
	if !a.service.CanRelayDungeon(roomID, playerID, true) {
		c.SendCode(403, "dungeon state requires room host")
		return
	}
	c.Pub(roomTopic(roomID), ws.H{"type": "dungeon.state", "playerId": playerID, "state": req.State})
	c.Send(ws.H{"ok": true})
}
