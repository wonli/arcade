package gameconfig_test

import (
	"io/fs"
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/wonli/arcade/internal/gameconfig"
)

func embeddedDefaults() fs.FS {
	return fstest.MapFS{
		"dungeon/weapon-presentation.json": &fstest.MapFile{Data: []byte(`{"version":1,"defaults":{"scale":1}}`)},
	}
}

func TestStoreFallsBackToEmbeddedConfig(t *testing.T) {
	store := gameconfig.NewStore(embeddedDefaults(), t.TempDir())
	doc, source, err := store.Load("dungeon", "weapon-presentation")
	if err != nil { t.Fatal(err) }
	if source != gameconfig.SourceEmbedded { t.Fatalf("source = %q", source) }
	if string(doc) != `{"version":1,"defaults":{"scale":1}}` { t.Fatalf("doc = %s", doc) }
}

func TestStoreOverrideWinsAndResetRestoresEmbedded(t *testing.T) {
	root := t.TempDir()
	store := gameconfig.NewStore(embeddedDefaults(), root)
	override := []byte(`{"version":1,"defaults":{"scale":1.25}}`)
	if err := store.Save("dungeon", "weapon-presentation", override); err != nil { t.Fatal(err) }

	doc, source, err := store.Load("dungeon", "weapon-presentation")
	if err != nil { t.Fatal(err) }
	if source != gameconfig.SourceOverride { t.Fatalf("source = %q", source) }
	if string(doc) != string(override) { t.Fatalf("doc = %s", doc) }

	path := filepath.Join(root, "dungeon", "weapon-presentation.json")
	if _, err := os.Stat(path); err != nil { t.Fatalf("override not written: %v", err) }
	if err := store.Reset("dungeon", "weapon-presentation"); err != nil { t.Fatal(err) }
	if _, err := os.Stat(path); !os.IsNotExist(err) { t.Fatalf("override still exists: %v", err) }

	doc, source, err = store.Load("dungeon", "weapon-presentation")
	if err != nil { t.Fatal(err) }
	if source != gameconfig.SourceEmbedded { t.Fatalf("source after reset = %q", source) }
}

func TestStoreRejectsInvalidJSONAndUnknownDocuments(t *testing.T) {
	store := gameconfig.NewStore(embeddedDefaults(), t.TempDir())
	if err := store.Save("dungeon", "weapon-presentation", []byte(`{"version":`)); err == nil {
		t.Fatal("expected invalid JSON error")
	}
	if err := store.Save("dungeon", "../weapon-presentation", []byte(`{"version":1}`)); err == nil {
		t.Fatal("expected path whitelist error")
	}
	if _, _, err := store.Load("other", "weapon-presentation"); err == nil {
		t.Fatal("expected unknown game error")
	}
}
