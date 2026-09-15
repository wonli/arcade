package server

import (
	"encoding/json"
	"strings"

	"github.com/wonli/aqi/ws"
)

func (a *Actions) RegisterDungeon(router ws.IRouter) {
	router.Add("dungeon.input", a.dungeonInput)
	router.Add("dungeon.event", a.dungeonEvent)
	router.Add("dungeon.sync", a.dungeonSync)
	// Kept during the V3 migration so an older client fails gracefully instead of
	// losing its route while rooms roll over. V3 clients do not publish it.
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

type dungeonEventRequest struct {
	RoomID string          `json:"roomId"`
	Event  json.RawMessage `json:"event"`
}

type dungeonSyncRequest struct {
	RoomID string          `json:"roomId"`
	Sync   json.RawMessage `json:"sync"`
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
}

func (a *Actions) dungeonEvent(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req dungeonEventRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" || len(req.Event) == 0 {
		c.SendCode(400, "invalid dungeon event")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(req.RoomID))
	if !a.service.CanRelayDungeon(roomID, playerID, true) {
		c.SendCode(403, "dungeon event requires room host")
		return
	}
	c.Pub(roomTopic(roomID), ws.H{"type": "dungeon.event", "playerId": playerID, "event": req.Event})
}

func (a *Actions) dungeonSync(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req dungeonSyncRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" || len(req.Sync) == 0 {
		c.SendCode(400, "invalid dungeon sync")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(req.RoomID))
	if !a.service.CanRelayDungeon(roomID, playerID, true) {
		c.SendCode(403, "dungeon sync requires room host")
		return
	}
	c.Pub(roomTopic(roomID), ws.H{"type": "dungeon.sync", "playerId": playerID, "sync": req.Sync})
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
}
