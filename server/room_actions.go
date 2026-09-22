package server

import (
	"encoding/json"
	"strings"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/game/policethief"
)

type roomRequest struct {
	RoomID     string `json:"roomId"`
	Name       string `json:"name"`
	Difficulty string `json:"difficulty,omitempty"`
	Locale     string `json:"locale,omitempty"`
}

type createRoomRequest struct {
	Game    string `json:"game"`
	Name    string `json:"name"`
	Players int    `json:"players"`
	Role    string `json:"role,omitempty"`
}

type roomCreatePlan struct {
	players int
	addBot  bool
}

func planRoomCreate(gameName string, players int) roomCreatePlan {
	if players == 0 {
		players = 2
	}
	if (gameName == "gomoku" || gameName == "policethief") && players == 1 {
		return roomCreatePlan{players: 2, addBot: true}
	}
	return roomCreatePlan{players: players}
}

func (a *Actions) createRoom(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req createRoomRequest
	if err := c.BindingJson(&req); err != nil {
		c.SendCode(400, "invalid room request")
		return
	}
	if req.Game == "" {
		req.Game = "gomoku"
	}

	var roomValue interface{ Snapshot() map[string]any }
	var roomID string
	var err error
	autoBot := false
	switch req.Game {
	case "snake":
		r, createErr := a.service.Create("snake", 1, 8)
		err = createErr
		if r != nil {
			roomValue = r
			roomID = r.ID
		}
	case "drawguess":
		r, createErr := a.service.Create("drawguess", 2, 8)
		err = createErr
		if r != nil {
			roomValue = r
			roomID = r.ID
		}
	default:
		plan := planRoomCreate(req.Game, req.Players)
		autoBot = plan.addBot
		r, createErr := a.service.Create(req.Game, plan.players)
		err = createErr
		if r != nil {
			if req.Game == "policethief" {
				r.SetRuntimeState(policethief.Setup{HostRole: policethief.NormalizeRole(req.Role)})
			}
			roomValue = r
			roomID = r.ID
		}
	}
	if err != nil {
		c.SendCode(400, err.Error())
		return
	}
	if err := a.service.Join(roomID, playerID, displayName(req.Name, playerID)); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	if autoBot {
		if err := a.service.AddBot(roomID, playerID); err != nil {
			c.SendCode(400, err.Error())
			return
		}
	}
	topic := roomTopic(roomID)
	c.Sub(topic)
	state := roomValue.Snapshot()
	c.Send(state)
	c.Pub(topic, state)
}

func (a *Actions) joinRoom(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid room request")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.Join(req.RoomID, playerID, displayName(req.Name, playerID)); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	r, _ := a.service.Get(req.RoomID)
	topic := roomTopic(req.RoomID)
	c.Sub(topic)
	state := r.Snapshot()
	c.Send(state)
	c.Pub(topic, state)
}

func (a *Actions) roomState(c *ws.Context) {
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid room request")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	r, ok := a.service.Get(req.RoomID)
	if !ok {
		c.SendCode(404, "room not found")
		return
	}
	c.Send(r.Snapshot())
}

func (a *Actions) addBot(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid room request")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.AddBot(req.RoomID, playerID, req.Difficulty); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}

func (a *Actions) rematch(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid room request")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.Rematch(req.RoomID, playerID); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}

type moveRequest struct {
	RoomID string          `json:"roomId"`
	Move   json.RawMessage `json:"move"`
}

func (a *Actions) move(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req moveRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" || len(req.Move) == 0 {
		c.SendCode(400, "invalid move")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.Move(req.RoomID, playerID, req.Move); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}
