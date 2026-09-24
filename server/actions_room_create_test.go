package server

import "testing"

func TestPlanRoomCreateGomokuBot(t *testing.T) {
	plan := planRoomCreate("gomoku", 1)
	if plan.players != 2 {
		t.Fatalf("gomoku bot room should still have 2 seats, got %d", plan.players)
	}
	if !plan.addBot {
		t.Fatal("gomoku players=1 should request an automatic bot")
	}
}

func TestPlanRoomCreatePoliceThiefBot(t *testing.T) {
	plan := planRoomCreate("policethief", 1)
	if plan.players != 2 || !plan.addBot {
		t.Fatalf("policethief players=1 should create two seats plus bot: %+v", plan)
	}
}

func TestPlanRoomCreateXiangqiBot(t *testing.T) {
	plan := planRoomCreate("xiangqi", 1)
	if plan.players != 2 || !plan.addBot {
		t.Fatalf("xiangqi players=1 should create two seats plus bot: %+v", plan)
	}
}

func TestPlanRoomCreateKeepsTwoPlayerGomoku(t *testing.T) {
	plan := planRoomCreate("gomoku", 2)
	if plan.players != 2 || plan.addBot {
		t.Fatalf("two-player gomoku changed unexpectedly: %+v", plan)
	}
}

func TestPlanRoomCreateKeepsTwoPlayerPoliceThief(t *testing.T) {
	plan := planRoomCreate("policethief", 2)
	if plan.players != 2 || plan.addBot {
		t.Fatalf("two-player policethief changed unexpectedly: %+v", plan)
	}
}

func TestPlanRoomCreateKeepsTwoPlayerXiangqi(t *testing.T) {
	plan := planRoomCreate("xiangqi", 2)
	if plan.players != 2 || plan.addBot {
		t.Fatalf("two-player xiangqi changed unexpectedly: %+v", plan)
	}
}

func TestPlanRoomCreateDefaultsToTwoPlayers(t *testing.T) {
	plan := planRoomCreate("tetris", 0)
	if plan.players != 2 || plan.addBot {
		t.Fatalf("default room plan changed unexpectedly: %+v", plan)
	}
}
