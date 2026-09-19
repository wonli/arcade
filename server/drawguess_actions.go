package server

import (
	"strings"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/game/drawguess"
)

type drawStrokeRequest struct {
	RoomID string           `json:"roomId"`
	Stroke drawguess.Stroke `json:"stroke"`
}

type drawGuessRequest struct {
	RoomID string `json:"roomId"`
	Text   string `json:"text"`
}

func (a *Actions) drawStart(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid draw start")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	pubsub := c.Client.Hub.PubSub
	if err := a.service.StartDrawGuessLocale(req.RoomID, playerID, req.Locale, func(roomID string, event map[string]any) {
		pubsub.Pub(roomTopic(roomID), event)
	}); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}

func (a *Actions) drawStroke(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req drawStrokeRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid draw stroke")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.DrawGuessStroke(req.RoomID, playerID, req.Stroke); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	c.Send(ws.H{"ok": true})
}

func (a *Actions) drawClear(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid draw clear")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.DrawGuessClear(req.RoomID, playerID); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	c.Send(ws.H{"ok": true})
}

func (a *Actions) drawGuess(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req drawGuessRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" || strings.TrimSpace(req.Text) == "" {
		c.SendCode(400, "invalid guess")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	result, err := a.service.DrawGuessGuess(req.RoomID, playerID, req.Text)
	if err != nil {
		c.SendCode(400, err.Error())
		return
	}
	c.Send(result)
}

func (a *Actions) drawPrivateState(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid private state request")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	state, err := a.service.DrawGuessPrivateState(req.RoomID, playerID)
	if err != nil {
		c.SendCode(400, err.Error())
		return
	}
	c.Send(state)
}
