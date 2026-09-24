package server

import (
	"strings"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/game/tank"
)

type tankInputRequest struct {
	RoomID string     `json:"roomId"`
	Input  tank.Input `json:"input"`
}

func (a *Actions) tankStart(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid tank start")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	pubsub := c.Client.Hub.PubSub
	if err := a.service.StartTank(req.RoomID, playerID, func(roomID string, state tank.State) {
		pubsub.Pub(roomTopic(roomID), ws.H{"type": "tank.state", "state": state})
	}); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}

func (a *Actions) tankInput(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req tankInputRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid tank input")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.TankInput(req.RoomID, playerID, req.Input); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	c.Send(ws.H{"ok": true})
}

func (a *Actions) tankRestart(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid tank restart")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	pubsub := c.Client.Hub.PubSub
	if err := a.service.RestartTank(req.RoomID, playerID, func(roomID string, state tank.State) {
		pubsub.Pub(roomTopic(roomID), ws.H{"type": "tank.state", "state": state})
	}); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}
