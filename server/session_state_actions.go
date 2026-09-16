package server

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/wonli/aqi/ws"
	"github.com/wonli/arcade/arcade"
)

func (a *Actions) RegisterSessionState(router ws.IRouter) {
	router.Add("session.state.get", a.sessionStateGet)
	router.Add("session.state.put", a.sessionStatePut)
}

type sessionStateGetRequest struct {
	RoomID string `json:"roomId"`
}

type sessionStatePutRequest struct {
	RoomID         string          `json:"roomId"`
	AuthorityEpoch uint64          `json:"authorityEpoch"`
	Revision       uint64          `json:"revision"`
	SchemaVersion  uint64          `json:"schemaVersion"`
	Payload        json.RawMessage `json:"payload"`
}

func sessionRoomID(roomID string) string {
	return strings.ToUpper(strings.TrimSpace(roomID))
}

func (a *Actions) sessionStateGet(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}

	var req sessionStateGetRequest
	if err := c.BindingJson(&req); err != nil || sessionRoomID(req.RoomID) == "" {
		c.SendCode(400, "invalid session state request")
		return
	}

	state, err := a.service.GetSessionState(sessionRoomID(req.RoomID), playerID)
	if errors.Is(err, arcade.ErrSessionStateNotFound) {
		c.Send(ws.H{"state": nil})
		return
	}
	if errors.Is(err, arcade.ErrSessionStateMembership) {
		c.SendCode(403, err.Error())
		return
	}
	if err != nil {
		c.SendCode(500, err.Error())
		return
	}
	c.Send(ws.H{"state": state})
}

func (a *Actions) sessionStatePut(c *ws.Context) {
	playerID, ok := currentPlayer(c)
	if !ok {
		c.SendCode(401, "guest login required")
		return
	}

	var req sessionStatePutRequest
	roomID := ""
	if err := c.BindingJson(&req); err == nil {
		roomID = sessionRoomID(req.RoomID)
	}
	if roomID == "" || req.AuthorityEpoch == 0 || req.Revision == 0 || req.SchemaVersion == 0 || len(req.Payload) == 0 {
		c.SendCode(400, "invalid session state")
		return
	}

	err := a.service.PutSessionState(roomID, playerID, arcade.SessionState{
		AuthorityEpoch: req.AuthorityEpoch,
		Revision:       req.Revision,
		SchemaVersion:  req.SchemaVersion,
		Payload:        req.Payload,
	})
	switch {
	case errors.Is(err, arcade.ErrSessionStateMembership):
		c.SendCode(403, err.Error())
	case errors.Is(err, arcade.ErrSessionStateAuthority), errors.Is(err, arcade.ErrStaleSessionState):
		c.SendCode(409, err.Error())
	case errors.Is(err, arcade.ErrInvalidSessionState):
		c.SendCode(400, err.Error())
	case err != nil:
		c.SendCode(500, err.Error())
	default:
		// Persisted session state is also the canonical anti-entropy snapshot.
		// Reuse the existing Dungeon checkpoint fact path so online peers apply
		// the same monotonic authority/revision validation as reconnect hydration.
		c.Pub(roomTopic(roomID), ws.H{
			"type":     "dungeon.fact",
			"playerId": playerID,
			"fact": ws.H{
				"type":       "session.checkpoint",
				"checkpoint": req.Payload,
			},
		})
		c.Send(ws.H{"ok": true})
	}
}
