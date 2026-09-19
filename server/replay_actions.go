package server

import (
	"errors"
	"strings"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/arcade"
	"github.com/wonli/arcade/game"
	"github.com/wonli/arcade/internal/gamereplay"
)

const standaloneDungeonReplayRoomID = "SOLO-DUNGEON"

type replayLeaseRequest struct {
	RoomID string `json:"roomId"`
	Game   string `json:"game"`
}

type replayReleaseRequest struct {
	Game  string `json:"game"`
	Lease string `json:"lease"`
}

func (a *Actions) RegisterReplay(router ws.IRouter, replays *gamereplay.Store) {
	router.Add("replay.lease", func(c *ws.Context) {
		playerID, ok := currentPlayer(c)
		if !ok {
			c.SendCode(401, "guest login required")
			return
		}
		var req replayLeaseRequest
		if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.RoomID) == "" || strings.TrimSpace(req.Game) == "" {
			c.SendCode(400, "invalid replay lease request")
			return
		}
		lease, err := acquireReplayLease(a.service, replays, req.RoomID, req.Game, playerID)
		if errors.Is(err, gamereplay.ErrLeaseBusy) {
			c.SendCode(409, "replay lease busy")
			return
		}
		if err != nil {
			c.SendCode(403, err.Error())
			return
		}
		c.Send(ws.H{"token": lease.Token, "expiresAt": lease.ExpiresAt})
	})

	router.Add("replay.release", func(c *ws.Context) {
		if _, ok := currentPlayer(c); !ok {
			c.SendCode(401, "guest login required")
			return
		}
		var req replayReleaseRequest
		if err := c.BindingJson(&req); err != nil || strings.TrimSpace(req.Game) == "" || strings.TrimSpace(req.Lease) == "" {
			c.SendCode(400, "invalid replay release request")
			return
		}
		c.Send(ws.H{"released": replays.ReleaseLease(req.Game, req.Lease)})
	})
}

func acquireReplayLease(service *arcade.Service, replays *gamereplay.Store, roomID, gameName string, playerID game.PlayerID) (gamereplay.Lease, error) {
	roomID = strings.ToUpper(strings.TrimSpace(roomID))
	gameName = strings.ToLower(strings.TrimSpace(gameName))
	if roomID == standaloneDungeonReplayRoomID {
		if gameName != "dungeon" {
			return gamereplay.Lease{}, errors.New("standalone replay lease is only available for dungeon")
		}
		holder := strings.ToLower(standaloneDungeonReplayRoomID) + ":" + string(playerID)
		return replays.AcquireLease(gameName, holder)
	}
	if !service.ReplayHost(roomID, playerID, gameName) {
		return gamereplay.Lease{}, errors.New("replay lease requires the room host")
	}
	holder := roomID + ":" + string(playerID)
	return replays.AcquireLease(gameName, holder)
}
