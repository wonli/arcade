package arcade

import (
	"errors"
	"strings"

	"github.com/wonli/arcade/game"
)

var (
	ErrSessionStateMembership = errors.New("session room membership required")
	ErrSessionStateAuthority  = errors.New("session state authority required")
	ErrSessionStateNotFound   = errors.New("session state not found")
)

func (s *Service) sessionPeer(roomID string, playerID game.PlayerID) (isHost bool, ok bool) {
	if s == nil {
		return false, false
	}
	r, exists := s.rooms.Get(strings.TrimSpace(roomID))
	if !exists || !r.Started() || !r.HasPlayer(playerID) {
		return false, false
	}
	return r.HostID == playerID, true
}

func (s *Service) GetSessionState(roomID string, playerID game.PlayerID) (SessionState, error) {
	if _, ok := s.sessionPeer(roomID, playerID); !ok {
		return SessionState{}, ErrSessionStateMembership
	}
	state, ok := s.sessionStates.Get(strings.TrimSpace(roomID))
	if !ok {
		return SessionState{}, ErrSessionStateNotFound
	}
	return state, nil
}

func (s *Service) PutSessionState(roomID string, playerID game.PlayerID, state SessionState) error {
	isHost, ok := s.sessionPeer(roomID, playerID)
	if !ok {
		return ErrSessionStateMembership
	}

	key := strings.TrimSpace(roomID)
	current, exists := s.sessionStates.Get(key)
	if !exists {
		if !isHost {
			return ErrSessionStateAuthority
		}
	} else if state.AuthorityEpoch == current.AuthorityEpoch && current.AuthorityID != string(playerID) {
		return ErrSessionStateAuthority
	}

	state.AuthorityID = string(playerID)
	return s.sessionStates.Put(key, state)
}
