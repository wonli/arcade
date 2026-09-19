package server

import (
	"strings"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/game/snake"
)

type snakeStartRequest struct {
	RoomID string `json:"roomId"`
	Speed  *int   `json:"speed,omitempty"`
}

type snakeInputRequest struct {
	RoomID    string          `json:"roomId"`
	Direction snake.Direction `json:"direction"`
}

func (a *Actions) snakeStart(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req snakeStartRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid snake start")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	speed := 2
	if req.Speed != nil {
		speed = *req.Speed
	}
	pubsub := c.Client.Hub.PubSub
	if err := a.service.StartSnake(req.RoomID, playerID, speed, func(roomID string, state snake.State) {
		pubsub.Pub(roomTopic(roomID), ws.H{"type": "snake.state", "state": state})
	}); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}

func (a *Actions) snakeInput(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req snakeInputRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid snake input")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.SnakeInput(req.RoomID, playerID, req.Direction); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	c.Send(ws.H{"ok": true})
}

func (a *Actions) snakeRestart(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid snake restart")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	pubsub := c.Client.Hub.PubSub
	if err := a.service.RestartSnake(req.RoomID, playerID, func(roomID string, state snake.State) {
		pubsub.Pub(roomTopic(roomID), ws.H{"type": "snake.state", "state": state})
	}); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}
