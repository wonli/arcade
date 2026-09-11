package arcade

import "testing"

func TestGuestIdentitySeparatesPlayerSessionAndSeat(t *testing.T) {
	uid := GuestUID("player-123", "session-456")
	appID := GuestAppID("session-456")
	seatID := GuestSeatID("session-456")

	if uid != "arcade:player-123:session-456" {
		t.Fatalf("uid = %q", uid)
	}
	if appID != "web:session-456" {
		t.Fatalf("appID = %q", appID)
	}
	if seatID != "session-456" {
		t.Fatalf("seatID = %q", seatID)
	}
}
