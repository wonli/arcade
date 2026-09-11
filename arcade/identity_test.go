package arcade

import "testing"

func TestGuestIdentitySeparatesPlayerAndSession(t *testing.T) {
	uid := GuestUID("player-123")
	appID := GuestAppID("session-456")

	if uid != "arcade:player-123" {
		t.Fatalf("uid = %q", uid)
	}
	if appID != "web:session-456" {
		t.Fatalf("appID = %q", appID)
	}
}
