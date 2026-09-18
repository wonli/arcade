package server

import (
	"encoding/json"
	"strings"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/arcade"
	"github.com/wonli/arcade/game"
)

func (a *Actions) RegisterDungeon(router ws.IRouter) {
	binary := router.Coder(NewDungeonProtoCoder())
	binary.Add("dungeon.snapshot", a.dungeonSnapshot)
	binary.Add("dungeon.command", a.dungeonCommand)
	router.Add("dungeon.fact", a.dungeonFact)
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
	var req DungeonSnapshotRequest
	if err := c.Bind(&req); err != nil || dungeonRoomID(req.GetRoomId()) == "" || req.GetSnapshot() == nil {
		c.SendCode(400, "invalid dungeon snapshot")
		return
	}
	roomID := dungeonRoomID(req.GetRoomId())
	if _, member := a.service.DungeonPeer(roomID, playerID); !member {
		c.SendCode(403, "dungeon room membership required")
		return
	}
	a.sendDungeonToRoom(c, roomID, playerID, "dungeon.snapshot", &DungeonSnapshotRelay{
		PlayerId:   string(playerID),
		Snapshot:   req.GetSnapshot(),
		PlayerState: req.GetPlayerState(),
	})
	c.Send(ws.H{"ok": true})
}

func (a *Actions) dungeonCommand(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req DungeonCommandRequest
	if err := c.Bind(&req); err != nil || dungeonRoomID(req.GetRoomId()) == "" || req.GetCommand() == nil {
		c.SendCode(400, "invalid dungeon command")
		return
	}
	roomID := dungeonRoomID(req.GetRoomId())
	if _, member := a.service.DungeonPeer(roomID, playerID); !member {
		c.SendCode(403, "dungeon room membership required")
		return
	}
	a.sendDungeonToRoom(c, roomID, playerID, "dungeon.command", &DungeonCommandRelay{
		PlayerId: string(playerID),
		Command:  req.GetCommand(),
	})
	c.Send(ws.H{"ok": true})
}

func (a *Actions) sendDungeonToRoom(c *ws.Context, roomID string, sender game.PlayerID, action string, data any) {
	room, ok := a.service.Get(roomID)
	if !ok {
		return
	}
	for _, player := range room.Players {
		if player.ID == sender {
			continue
		}
		c.SendTo(arcade.GuestUID(string(player.ID)), action, data)
	}
}

func (a *Actions) dungeonFactRelayAllowed(roomID string, playerID game.PlayerID) bool {
	_, member := a.service.DungeonPeer(dungeonRoomID(roomID), playerID)
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
