package server

import (
	"strings"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/game"
)

type tetrisStateRequest struct {
	RoomID   string  `json:"roomId"`
	Board    [][]int `json:"board"`
	Score    int     `json:"score"`
	Lines    int     `json:"lines"`
	GameOver bool    `json:"gameOver"`
}

type tetrisAttackRequest struct {
	RoomID string `json:"roomId"`
	Lines  int    `json:"lines"`
}

func (a *Actions) tetrisState(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req tetrisStateRequest
	if err := c.BindingJson(&req); err != nil || !a.canRelayTetris(req.RoomID, playerID) {
		c.SendCode(400, "invalid tetris state")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(req.RoomID))
	c.Pub(roomTopic(roomID), ws.H{"type": "tetris.state", "playerId": playerID, "board": req.Board, "score": req.Score, "lines": req.Lines, "gameOver": req.GameOver})
	c.Send(ws.H{"ok": true})
}

func (a *Actions) tetrisAttack(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req tetrisAttackRequest
	if err := c.BindingJson(&req); err != nil || req.Lines <= 0 || req.Lines > 8 || !a.canRelayTetris(req.RoomID, playerID) {
		c.SendCode(400, "invalid tetris attack")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(req.RoomID))
	c.Pub(roomTopic(roomID), ws.H{"type": "tetris.attack", "playerId": playerID, "lines": req.Lines})
	c.Send(ws.H{"ok": true})
}

func (a *Actions) tetrisGameOver(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || !a.canRelayTetris(req.RoomID, playerID) {
		c.SendCode(400, "invalid tetris game over")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(req.RoomID))
	c.Pub(roomTopic(roomID), ws.H{"type": "tetris.gameover", "playerId": playerID})
	c.Send(ws.H{"ok": true})
}

func (a *Actions) tetrisRestart(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}
	var req roomRequest
	if err := c.BindingJson(&req); err != nil || !a.canRelayTetris(req.RoomID, playerID) {
		c.SendCode(400, "invalid tetris restart")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(req.RoomID))
	c.Pub(roomTopic(roomID), ws.H{"type": "tetris.restart", "playerId": playerID})
	c.Send(ws.H{"ok": true})
}

func (a *Actions) canRelayTetris(roomID string, playerID game.PlayerID) bool {
	roomID = strings.ToUpper(strings.TrimSpace(roomID))
	r, ok := a.service.Get(roomID)
	return ok && r.GameName == "tetris" && r.HasPlayer(playerID)
}
