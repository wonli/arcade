package arcade

import "strings"

func GuestUID(playerID string) string {
	return "arcade:" + strings.TrimSpace(playerID)
}

func GuestAppID(sessionID string) string {
	return "web:" + strings.TrimSpace(sessionID)
}
