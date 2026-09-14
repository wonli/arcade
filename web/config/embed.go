package config

import "embed"

// Files contains version-controlled game defaults embedded into the Arcade binary.
// Runtime editor overrides live under data/<game>/ and are never written back here.
//go:embed dungeon/*.json
var Files embed.FS
