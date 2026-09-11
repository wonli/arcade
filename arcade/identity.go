package arcade

import "strings"

func GuestUID(ids ...string) string {
	if len(ids) == 0 {
		return "arcade:"
	}
	if len(ids) == 1 {
		return "arcade:" + strings.TrimSpace(ids[0])
	}
	return "arcade:" + strings.TrimSpace(ids[0]) + ":" + strings.TrimSpace(ids[1])
}

func GuestAppID(sessionID string) string {
	return "web:" + strings.TrimSpace(sessionID)
}

func GuestSeatID(sessionID string) string {
	return strings.TrimSpace(sessionID)
}
