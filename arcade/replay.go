package arcade

import "github.com/wonli/arcade/game"

// ReplayHost reports whether playerID is the current Host of a room whose
// game matches gameName. Most games may publish replay data only after the
// room has started. Dungeon is the exception: its Host can begin playing
// alone while the optional co-op peer has not joined yet, so replay recording
// must be allowed from that first local frame onward.
func (s *Service) ReplayHost(roomID string, playerID game.PlayerID, gameName string) bool {
	r, ok := s.rooms.Get(roomID)
	if !ok || r.GameName != gameName || !r.HasPlayer(playerID) {
		return false
	}
	if gameName != "dungeon" && !r.Started() {
		return false
	}
	return r.HostID == playerID
}
