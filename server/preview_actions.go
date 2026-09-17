package server

import (
	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/internal/gamepreview"
)

func (a *Actions) RegisterPreview(router ws.IRouter, previews *gamepreview.Store) {
	router.Add("preview.token", func(c *ws.Context) {
		playerID, ok := currentPlayer(c)
		if !ok {
			c.SendCode(401, "guest login required")
			return
		}
		token, expiresAt, err := previews.IssueToken(string(playerID))
		if err != nil {
			c.SendCode(500, err.Error())
			return
		}
		c.Send(ws.H{"token": token, "expiresAt": expiresAt})
	})
}
