package server

import (
	"encoding/json"
	"strings"

	"github.com/wonli/aqi/ws"
)

func (a *Actions) RegisterDungeon(router ws.IRouter) {
	router.Add("dungeon.snapshot", a.dungeonSnapshot)
	router.Add("dungeon.command", a.dungeonCommand)
	router.Add("dungeon.fact", a.dungeonFact)
}

type dungeonSnapshotRequest struct {
	RoomID   string          `json:"roomId"`
	Snapshot json.RawMessage `json:"snapshot"`
}

type dungeonCommandRequest struct {
	RoomID  string          `json:"roomId"`
	Command json.RawMessage `json:"command"`
}

type dungeonFactRequest struct {
	RoomID string          `json:"roomId"`
	Fact   json.RawMessage `json:"fact"`
}

func dungeonRoomID(roomID string) string {
	return strings.ToUpper(strings.TrimSpace(roomID))
}

func (a *Actions) dungeonSnapshot(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req dungeonSnapshotRequest
	if err := c.BindingJson(&req); err != nil || dungeonRoomID(req.RoomID) == "" || len(req.Snapshot) == 0 {
		c.SendCode(400, "invalid dungeon snapshot")
		return
	}
	roomID := dungeonRoomID(req.RoomID)
	if _, member := a.service.DungeonPeer(roomID, playerID); !member {
		c.SendCode(403, "dungeon room membership required")
		return
	}
	c.Pub(roomTopic(roomID), ws.H{
		"type":     "dungeon.snapshot",
		"playerId": playerID,
		"snapshot": req.Snapshot,
	})
	c.Send(ws.H{"ok": true})
}

func (a *Actions) dungeonCommand(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req dungeonCommandRequest
	if err := c.BindingJson(&req); err != nil || dungeonRoomID(req.RoomID) == "" || len(req.Command) == 0 {
		c.SendCode(400, "invalid dungeon command")
		return
	}
	roomID := dungeonRoomID(req.RoomID)
	if _, member := a.service.DungeonPeer(roomID, playerID); !member {
		c.SendCode(403, "dungeon room membership required")
		return
	}
	c.Pub(roomTopic(roomID), ws.H{
		"type":     "dungeon.command",
		"playerId": playerID,
		"command":  req.Command,
	})
	c.Send(ws.H{"ok": true})
}

func (a *Actions) dungeonFactRelayAllowed(roomID, playerID string) bool {
	_, member := a.service.DungeonPeer(dungeonRoomID(roomID), strings.TrimSpace(playerID))
	return member
}

func (a *Actions) dungeonFact(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req dungeonFactRequest
	if err := c.BindingJson(&req); err != nil || dungeonRoomID(req.RoomID) == "" || len(req.Fact) == 0 {
		c.SendCode(400, "invalid dungeon fact")
		return
	}
	roomID := dungeonRoomID(req.RoomID)
	if !a.dungeonFactRelayAllowed(roomID, playerID) {
		c.SendCode(403, "dungeon room membership required")
		return
	}
	c.Pub(roomTopic(roomID), ws.H{
		"type":     "dungeon.fact",
		"playerId": playerID,
		"fact":     req.Fact,
	})
	c.Send(ws.H{"ok": true})
}
