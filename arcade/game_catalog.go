package arcade

import (
	"errors"

	"github.com/wonli/arcade/game/chess"
	"github.com/wonli/arcade/game/gomoku"
	"github.com/wonli/arcade/game/policethief"
	"github.com/wonli/arcade/game/xiangqi"
	"github.com/wonli/arcade/room"
)

type gameSpec struct {
	validateBounds func(minPlayers, maxPlayers int) error
	onJoin         func(*room.Room) error
}

var gameCatalog = map[string]gameSpec{
	"gomoku": {
		validateBounds: func(minPlayers, maxPlayers int) error {
			if minPlayers != 2 || maxPlayers != 2 {
				return errors.New("gomoku requires two players")
			}
			return nil
		},
		onJoin: func(r *room.Room) error {
			ids := r.PlayerIDs()
			if r.Started() || len(ids) != r.MaxPlayers {
				return nil
			}
			if len(ids) != 2 {
				return errors.New("gomoku requires two players")
			}
			r.Ready(gomoku.New(ids[0], ids[1]))
			return nil
		},
	},
	"chess": {
		validateBounds: func(minPlayers, maxPlayers int) error {
			if minPlayers != 2 || maxPlayers != 2 {
				return errors.New("chess requires two players")
			}
			return nil
		},
		onJoin: func(r *room.Room) error {
			ids := r.PlayerIDs()
			if r.Started() || len(ids) != r.MaxPlayers {
				return nil
			}
			if len(ids) != 2 {
				return errors.New("chess requires two players")
			}
			r.Ready(chess.New(ids[0], ids[1]))
			return nil
		},
	},
	"xiangqi": {
		validateBounds: func(minPlayers, maxPlayers int) error {
			if minPlayers != 2 || maxPlayers != 2 {
				return errors.New("xiangqi requires two players")
			}
			return nil
		},
		onJoin: func(r *room.Room) error {
			ids := r.PlayerIDs()
			if r.Started() || len(ids) != r.MaxPlayers {
				return nil
			}
			if len(ids) != 2 {
				return errors.New("xiangqi requires two players")
			}
			r.Ready(xiangqi.New(ids[0], ids[1]))
			return nil
		},
	},
	"policethief": {
		validateBounds: func(minPlayers, maxPlayers int) error {
			if minPlayers != 2 || maxPlayers != 2 {
				return errors.New("policethief requires two players")
			}
			return nil
		},
		onJoin: func(r *room.Room) error {
			ids := r.PlayerIDs()
			if r.Started() || len(ids) != r.MaxPlayers {
				return nil
			}
			if len(ids) != 2 {
				return errors.New("policethief requires two players")
			}
			hostRole := policethief.Thief
			if setup, ok := r.Snapshot()["state"].(policethief.Setup); ok {
				hostRole = policethief.NormalizeRole(string(setup.HostRole))
			}
			thiefPlayer, policePlayer := ids[0], ids[1]
			if hostRole == policethief.Police {
				thiefPlayer, policePlayer = ids[1], ids[0]
			}
			r.Ready(policethief.New(thiefPlayer, policePlayer))
			return nil
		},
	},
	"tetris": {
		validateBounds: func(minPlayers, maxPlayers int) error {
			if minPlayers != maxPlayers || (maxPlayers != 1 && maxPlayers != 2) {
				return errors.New("tetris supports one or two players")
			}
			return nil
		},
		onJoin: startRoomWhenFull,
	},
	"dungeon": {
		validateBounds: func(minPlayers, maxPlayers int) error {
			if minPlayers != 2 || maxPlayers != 2 {
				return errors.New("dungeon requires two players")
			}
			return nil
		},
		onJoin: startRoomWhenFull,
	},
	"tank": {
		validateBounds: func(minPlayers, maxPlayers int) error {
			if minPlayers != 2 || maxPlayers != 2 {
				return errors.New("tank requires two players")
			}
			return nil
		},
		onJoin: noRoomStart,
	},
	"snake": {
		validateBounds: func(minPlayers, maxPlayers int) error {
			if minPlayers != 1 || maxPlayers != 8 {
				return errors.New("snake supports 1-8 players")
			}
			return nil
		},
		onJoin: noRoomStart,
	},
	"drawguess": {
		validateBounds: func(minPlayers, maxPlayers int) error {
			if minPlayers != 2 || maxPlayers != 8 {
				return errors.New("drawguess supports 2-8 players")
			}
			return nil
		},
		onJoin: noRoomStart,
	},
}

func lookupGameSpec(name string) (gameSpec, bool) {
	spec, ok := gameCatalog[name]
	return spec, ok
}

func startRoomWhenFull(r *room.Room) error {
	if r.Started() || len(r.PlayerIDs()) != r.MaxPlayers {
		return nil
	}
	r.SetStatus(room.StatusPlaying)
	return nil
}

func noRoomStart(*room.Room) error { return nil }
