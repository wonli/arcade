package arcade

import "github.com/wonli/arcade/game"

// ReplayHost reports whether playerID is the current Host of a started room
// whose game matches gameName. Replay recording is intentionally restricted
// to the Host so only one client in a room attempts to publish attract-mode
// data.
func (s *Service) ReplayHost(roomID string, playerID game.PlayerID, gameName string) bool {
	r, ok := s.rooms.Get(roomID)
	if !ok || r.GameName != gameName || !r.Started() || !r.HasPlayer(playerID) {
		return false
	}
	return r.HostID == playerID
}
