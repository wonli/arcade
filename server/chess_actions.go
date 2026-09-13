package server

import (
	"strings"

	"github.com/wonli/aqi/ws"
)

func (a *Actions) RegisterChess(router ws.IRouter) {
	router.Add("game.resign", a.resignChess)
}

func (a *Actions) resignChess(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" {
		c.SendCode(400, "invalid resign request")
		return
	}
	req.RoomID = strings.ToUpper(strings.TrimSpace(req.RoomID))
	if err := a.service.Resign(req.RoomID, playerID); err != nil {
		c.SendCode(400, err.Error())
		return
	}
	a.sendRoom(c, req.RoomID)
}
