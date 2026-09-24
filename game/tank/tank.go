package tank

import (
	"errors"
	"math"
	"sync"

	"github.com/wonli/arcade/game"
)

const (
	Width           = 1200.0
	Height          = 720.0
	TickSeconds     = 0.05
	TankRadius      = 27.0
	BulletRadius    = 5.0
	TankSpeed       = 220.0
	ReverseSpeed    = 130.0
	TurnSpeed       = 2.6
	BulletSpeed     = 620.0
	MaxHP           = 100
	BulletDamage    = 40
	FireCooldown    = 8
	RoundResetDelay = 20
	TargetScore     = 5
)

type Player struct {
	ID   game.PlayerID
	Name string
}

type Input struct {
	Throttle    float64 `json:"throttle"`
	Turn        float64 `json:"turn"`
	TurretAngle float64 `json:"turretAngle"`
	Fire        bool    `json:"fire"`
}

type Rect struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	W float64 `json:"w"`
	H float64 `json:"h"`
}

type Tank struct {
	PlayerID    game.PlayerID `json:"playerId"`
	Name        string        `json:"name"`
	X           float64       `json:"x"`
	Y           float64       `json:"y"`
	Angle       float64       `json:"angle"`
	TurretAngle float64       `json:"turretAngle"`
	HP          int           `json:"hp"`
	Alive       bool          `json:"alive"`
	Score       int           `json:"score"`
}

type Bullet struct {
	ID      int64         `json:"id"`
	OwnerID game.PlayerID `json:"ownerId"`
	X       float64       `json:"x"`
	Y       float64       `json:"y"`
	VX      float64       `json:"vx"`
	VY      float64       `json:"vy"`
}

type State struct {
	Width           float64       `json:"width"`
	Height          float64       `json:"height"`
	Tick            int64         `json:"tick"`
	Round           int           `json:"round"`
	RoundResetTicks int           `json:"roundResetTicks"`
	Tanks           []Tank        `json:"tanks"`
	Bullets         []Bullet      `json:"bullets"`
	Obstacles       []Rect        `json:"obstacles"`
	Status          game.Status   `json:"status"`
	Winner          game.PlayerID `json:"winner,omitempty"`
	TargetScore     int           `json:"targetScore"`
}

type Game struct {
	mu            sync.Mutex
	state         State
	inputs        map[game.PlayerID]Input
	fireCooldowns map[game.PlayerID]int
	nextBulletID  int64
}

var arenaObstacles = []Rect{
	{X: 315, Y: 120, W: 150, H: 78},
	{X: 735, Y: 522, W: 150, H: 78},
	{X: 558, Y: 72, W: 84, H: 180},
	{X: 558, Y: 468, W: 84, H: 180},
	{X: 210, Y: 505, W: 110, H: 70},
	{X: 880, Y: 145, W: 110, H: 70},
}

type spawn struct {
	x     float64
	y     float64
	angle float64
}

var duelSpawns = []spawn{
	{x: 120, y: Height / 2, angle: 0},
	{x: Width - 120, y: Height / 2, angle: math.Pi},
}

func New(players []Player) *Game {
	g := &Game{
		inputs:        make(map[game.PlayerID]Input, len(players)),
		fireCooldowns: make(map[game.PlayerID]int, len(players)),
		state: State{
			Width:       Width,
			Height:      Height,
			Round:       1,
			Status:      game.StatusPlaying,
			TargetScore: TargetScore,
			Obstacles:   append([]Rect(nil), arenaObstacles...),
			Tanks:       make([]Tank, 0, len(players)),
		},
	}
	for i, player := range players {
		s := duelSpawns[i%len(duelSpawns)]
		g.state.Tanks = append(g.state.Tanks, Tank{
			PlayerID:    player.ID,
			Name:        player.Name,
			X:           s.x,
			Y:           s.y,
			Angle:       s.angle,
			TurretAngle: s.angle,
			HP:          MaxHP,
			Alive:       true,
		})
	}
	return g
}

func (g *Game) Input(playerID game.PlayerID, input Input) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.state.Status != game.StatusPlaying {
		return errors.New("tank game is not playing")
	}
	if g.tankIndex(playerID) < 0 {
		return errors.New("player is not in tank game")
	}
	input.Throttle = clamp(input.Throttle, -1, 1)
	input.Turn = clamp(input.Turn, -1, 1)
	input.TurretAngle = normalizeAngle(input.TurretAngle)
	g.inputs[playerID] = input
	return nil
}

func (g *Game) Tick() State {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.state.Status != game.StatusPlaying {
		return cloneState(g.state)
	}

	g.state.Tick++
	if g.state.RoundResetTicks > 0 {
		g.state.RoundResetTicks--
		if g.state.RoundResetTicks == 0 {
			g.resetRound()
		}
		return cloneState(g.state)
	}

	for i := range g.state.Tanks {
		g.stepTank(i)
	}
	g.stepBullets()
	return cloneState(g.state)
}

func (g *Game) State() State {
	g.mu.Lock()
	defer g.mu.Unlock()
	return cloneState(g.state)
}

func (g *Game) stepTank(index int) {
	tank := &g.state.Tanks[index]
	if !tank.Alive {
		return
	}
	input := g.inputs[tank.PlayerID]
	tank.TurretAngle = normalizeAngle(input.TurretAngle)
	tank.Angle = normalizeAngle(tank.Angle + input.Turn*TurnSpeed*TickSeconds)

	if input.Throttle != 0 {
		speed := TankSpeed
		if input.Throttle < 0 {
			speed = ReverseSpeed
		}
		distance := input.Throttle * speed * TickSeconds
		nextX := tank.X + math.Cos(tank.Angle)*distance
		nextY := tank.Y + math.Sin(tank.Angle)*distance
		if g.canOccupy(index, nextX, nextY) {
			tank.X = nextX
			tank.Y = nextY
		}
	}

	cooldown := g.fireCooldowns[tank.PlayerID]
	if cooldown > 0 {
		cooldown--
		g.fireCooldowns[tank.PlayerID] = cooldown
	}
	if input.Fire && cooldown == 0 {
		g.spawnBullet(*tank)
		g.fireCooldowns[tank.PlayerID] = FireCooldown
	}
}

func (g *Game) canOccupy(index int, x, y float64) bool {
	if x < TankRadius || x > Width-TankRadius || y < TankRadius || y > Height-TankRadius {
		return false
	}
	for _, obstacle := range g.state.Obstacles {
		if circleRectCollision(x, y, TankRadius, obstacle) {
			return false
		}
	}
	for i, other := range g.state.Tanks {
		if i == index || !other.Alive {
			continue
		}
		if math.Hypot(x-other.X, y-other.Y) < TankRadius*2 {
			return false
		}
	}
	return true
}

func (g *Game) spawnBullet(tank Tank) {
	g.nextBulletID++
	offset := TankRadius + 10
	g.state.Bullets = append(g.state.Bullets, Bullet{
		ID:      g.nextBulletID,
		OwnerID: tank.PlayerID,
		X:       tank.X + math.Cos(tank.TurretAngle)*offset,
		Y:       tank.Y + math.Sin(tank.TurretAngle)*offset,
		VX:      math.Cos(tank.TurretAngle) * BulletSpeed,
		VY:      math.Sin(tank.TurretAngle) * BulletSpeed,
	})
}

func (g *Game) stepBullets() {
	if len(g.state.Bullets) == 0 {
		return
	}
	next := g.state.Bullets[:0]
	for _, bullet := range g.state.Bullets {
		bullet.X += bullet.VX * TickSeconds
		bullet.Y += bullet.VY * TickSeconds
		if bullet.X < -BulletRadius || bullet.X > Width+BulletRadius || bullet.Y < -BulletRadius || bullet.Y > Height+BulletRadius {
			continue
		}
		blocked := false
		for _, obstacle := range g.state.Obstacles {
			if circleRectCollision(bullet.X, bullet.Y, BulletRadius, obstacle) {
				blocked = true
				break
			}
		}
		if blocked {
			continue
		}

		hit := -1
		for i := range g.state.Tanks {
			tank := &g.state.Tanks[i]
			if !tank.Alive || tank.PlayerID == bullet.OwnerID {
				continue
			}
			if math.Hypot(bullet.X-tank.X, bullet.Y-tank.Y) <= TankRadius+BulletRadius {
				hit = i
				break
			}
		}
		if hit < 0 {
			next = append(next, bullet)
			continue
		}
		g.damageTank(hit, bullet.OwnerID)
		if g.state.RoundResetTicks > 0 || g.state.Status == game.StatusFinished {
			break
		}
	}
	if g.state.RoundResetTicks > 0 || g.state.Status == game.StatusFinished {
		g.state.Bullets = nil
		return
	}
	g.state.Bullets = next
}

func (g *Game) damageTank(index int, attacker game.PlayerID) {
	tank := &g.state.Tanks[index]
	tank.HP -= BulletDamage
	if tank.HP > 0 {
		return
	}
	tank.HP = 0
	tank.Alive = false
	attackerIndex := g.tankIndex(attacker)
	if attackerIndex >= 0 {
		g.state.Tanks[attackerIndex].Score++
		if g.state.Tanks[attackerIndex].Score >= TargetScore {
			g.state.Status = game.StatusFinished
			g.state.Winner = attacker
			return
		}
	}
	for i := range g.state.Tanks {
		g.state.Tanks[i].Alive = false
	}
	g.state.RoundResetTicks = RoundResetDelay
}

func (g *Game) resetRound() {
	g.state.Round++
	g.state.Bullets = nil
	clear(g.inputs)
	clear(g.fireCooldowns)
	for i := range g.state.Tanks {
		s := duelSpawns[i%len(duelSpawns)]
		tank := &g.state.Tanks[i]
		tank.X = s.x
		tank.Y = s.y
		tank.Angle = s.angle
		tank.TurretAngle = s.angle
		tank.HP = MaxHP
		tank.Alive = true
	}
}

func (g *Game) tankIndex(playerID game.PlayerID) int {
	for i := range g.state.Tanks {
		if g.state.Tanks[i].PlayerID == playerID {
			return i
		}
	}
	return -1
}

func circleRectCollision(cx, cy, radius float64, rect Rect) bool {
	nearestX := clamp(cx, rect.X, rect.X+rect.W)
	nearestY := clamp(cy, rect.Y, rect.Y+rect.H)
	return math.Hypot(cx-nearestX, cy-nearestY) < radius
}

func clamp(value, min, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func normalizeAngle(value float64) float64 {
	for value > math.Pi {
		value -= math.Pi * 2
	}
	for value <= -math.Pi {
		value += math.Pi * 2
	}
	return value
}

func cloneState(state State) State {
	copy := state
	copy.Tanks = append([]Tank(nil), state.Tanks...)
	copy.Bullets = append([]Bullet(nil), state.Bullets...)
	copy.Obstacles = append([]Rect(nil), state.Obstacles...)
	return copy
}
