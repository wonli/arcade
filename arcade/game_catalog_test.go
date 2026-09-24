package arcade

import "testing"

func TestGameCatalogContainsCurrentGames(t *testing.T) {
	want := []string{"gomoku", "chess", "xiangqi", "tetris", "snake", "drawguess", "dungeon", "policethief", "tank"}
	for _, name := range want {
		if _, ok := lookupGameSpec(name); !ok {
			t.Fatalf("lookupGameSpec(%q) missing", name)
		}
	}
	if _, ok := lookupGameSpec("missing"); ok {
		t.Fatal("unknown game unexpectedly registered")
	}
}

func TestGameCatalogPreservesPlayerBounds(t *testing.T) {
	tests := []struct {
		name       string
		minPlayers int
		maxPlayers int
		wantErr    bool
	}{
		{name: "gomoku", minPlayers: 2, maxPlayers: 2},
		{name: "gomoku", minPlayers: 1, maxPlayers: 1, wantErr: true},
		{name: "chess", minPlayers: 2, maxPlayers: 2},
		{name: "chess", minPlayers: 1, maxPlayers: 2, wantErr: true},
		{name: "xiangqi", minPlayers: 2, maxPlayers: 2},
		{name: "xiangqi", minPlayers: 1, maxPlayers: 1, wantErr: true},
		{name: "tetris", minPlayers: 1, maxPlayers: 1},
		{name: "tetris", minPlayers: 2, maxPlayers: 2},
		{name: "tetris", minPlayers: 1, maxPlayers: 2, wantErr: true},
		{name: "snake", minPlayers: 1, maxPlayers: 8},
		{name: "snake", minPlayers: 2, maxPlayers: 8, wantErr: true},
		{name: "drawguess", minPlayers: 2, maxPlayers: 8},
		{name: "drawguess", minPlayers: 2, maxPlayers: 7, wantErr: true},
		{name: "dungeon", minPlayers: 2, maxPlayers: 2},
		{name: "dungeon", minPlayers: 1, maxPlayers: 1, wantErr: true},
		{name: "policethief", minPlayers: 2, maxPlayers: 2},
		{name: "policethief", minPlayers: 1, maxPlayers: 1, wantErr: true},
		{name: "tank", minPlayers: 2, maxPlayers: 2},
		{name: "tank", minPlayers: 1, maxPlayers: 2, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			spec, ok := lookupGameSpec(tt.name)
			if !ok {
				t.Fatalf("game %q not registered", tt.name)
			}
			err := spec.validateBounds(tt.minPlayers, tt.maxPlayers)
			if tt.wantErr && err == nil {
				t.Fatalf("validateBounds(%d, %d) unexpectedly succeeded", tt.minPlayers, tt.maxPlayers)
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("validateBounds(%d, %d) = %v", tt.minPlayers, tt.maxPlayers, err)
			}
		})
	}
}
