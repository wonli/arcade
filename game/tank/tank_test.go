package tank

import (
	"math"
	"testing"

	"github.com/wonli/arcade/game"
)

func duelPlayers() []Player {
	return []Player{
		{ID: game.PlayerID("blue"), Name: "Blue"},
		{ID: game.PlayerID("red"), Name: "Red"},
	}
}

func TestNewCreatesAPlayableDuel(t *testing.T) {
	g := New(duelPlayers())
	state := g.State()
	if state.Status != game.StatusPlaying {
		t.Fatalf("status = %q, want playing", state.Status)
	}
	if state.Width != Width || state.Height != Height {
		t.Fatalf("arena = %dx%d, want %dx%d", state.Width, state.Height, Width, Height)
	}
	if len(state.Tanks) != 2 {
		t.Fatalf("tanks = %d, want 2", len(state.Tanks))
	}
	if state.Tanks[0].HP != MaxHP || state.Tanks[1].HP != MaxHP {
		t.Fatalf("initial hp = %d/%d, want %d", state.Tanks[0].HP, state.Tanks[1].HP, MaxHP)
	}
	if len(state.Obstacles) == 0 {
		t.Fatal("arena should expose static obstacles to the renderer")
	}
}

func TestInputMovesTankAndKeepsItInsideArena(t *testing.T) {
	g := New(duelPlayers())
	before := g.State().Tanks[0]
	if err := g.Input(before.PlayerID, Input{Throttle: 1, TurretAngle: 0}); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 5; i++ {
		g.Tick()
	}
	after := g.State().Tanks[0]
	if after.X <= before.X {
		t.Fatalf("tank did not move forward: before=%f after=%f", before.X, after.X)
	}
	if after.X < TankRadius || after.X > Width-TankRadius || after.Y < TankRadius || after.Y > Height-TankRadius {
		t.Fatalf("tank escaped arena: %+v", after)
	}
}

func TestTurnAndTurretAimAreIndependent(t *testing.T) {
	g := New(duelPlayers())
	player := g.State().Tanks[0].PlayerID
	if err := g.Input(player, Input{Turn: 1, TurretAngle: math.Pi / 2}); err != nil {
		t.Fatal(err)
	}
	state := g.Tick()
	tank := state.Tanks[0]
	if tank.Angle == 0 {
		t.Fatal("body angle should change when turning")
	}
	if math.Abs(tank.TurretAngle-math.Pi/2) > 0.0001 {
		t.Fatalf("turret angle = %f, want pi/2", tank.TurretAngle)
	}
}

func TestFireCreatesBulletAndCooldownPreventsSpam(t *testing.T) {
	g := New(duelPlayers())
	player := g.State().Tanks[0].PlayerID
	if err := g.Input(player, Input{TurretAngle: 0, Fire: true}); err != nil {
		t.Fatal(err)
	}
	state := g.Tick()
	if len(state.Bullets) != 1 {
		t.Fatalf("bullets = %d, want 1", len(state.Bullets))
	}
	state = g.Tick()
	if len(state.Bullets) != 1 {
		t.Fatalf("cooldown should prevent a second immediate shot, bullets = %d", len(state.Bullets))
	}
}

func TestBulletDamagesOpponentAndRoundResetsAfterKill(t *testing.T) {
	g := New(duelPlayers())
	blue := g.State().Tanks[0].PlayerID

	for shot := 0; shot < 3; shot++ {
		if err := g.Input(blue, Input{TurretAngle: 0, Fire: true}); err != nil {
			t.Fatal(err)
		}
		g.Tick()
		if err := g.Input(blue, Input{TurretAngle: 0, Fire: false}); err != nil {
			t.Fatal(err)
		}
		for i := 0; i < 42; i++ {
			g.Tick()
		}
	}

	state := g.State()
	if state.Tanks[0].Score != 1 {
		t.Fatalf("blue score = %d, want 1", state.Tanks[0].Score)
	}
	if state.RoundResetTicks <= 0 {
		t.Fatalf("round reset ticks = %d, want positive after kill", state.RoundResetTicks)
	}

	for state.RoundResetTicks > 0 {
		state = g.Tick()
	}
	if !state.Tanks[0].Alive || !state.Tanks[1].Alive {
		t.Fatal("both tanks should respawn for the next round")
	}
	if state.Tanks[0].HP != MaxHP || state.Tanks[1].HP != MaxHP {
		t.Fatalf("respawn hp = %d/%d, want %d", state.Tanks[0].HP, state.Tanks[1].HP, MaxHP)
	}
}

func TestInputRejectsUnknownPlayer(t *testing.T) {
	g := New(duelPlayers())
	if err := g.Input(game.PlayerID("missing"), Input{}); err == nil {
		t.Fatal("expected unknown player input to fail")
	}
}
