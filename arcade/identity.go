package arcade

import "strings"

func GuestUID(playerID, sessionID string) string {
	return "arcade:" + strings.TrimSpace(playerID) + ":" + strings.TrimSpace(sessionID)
}

func GuestAppID(sessionID string) string {
	return "web:" + strings.TrimSpace(sessionID)
}

func GuestSeatID(sessionID string) string {
	return strings.TrimSpace(sessionID)
}
