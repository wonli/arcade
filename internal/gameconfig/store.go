package gameconfig

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
)

type Source string

const (
	SourceEmbedded Source = "embedded"
	SourceOverride Source = "override"
)

var allowedDocuments = map[string]map[string]struct{}{
	"dungeon": {
		"weapon-presentation": {},
	},
}

type Store struct {
	embedded fs.FS
	dataRoot string
}

func NewStore(embedded fs.FS, dataRoot string) *Store {
	return &Store{embedded: embedded, dataRoot: dataRoot}
}

func validateKey(game, name string) error {
	names, ok := allowedDocuments[game]
	if !ok {
		return fmt.Errorf("unknown game config: %s", game)
	}
	if _, ok := names[name]; !ok {
		return fmt.Errorf("unknown config document: %s/%s", game, name)
	}
	return nil
}

func validateDocument(document []byte) error {
	if !json.Valid(document) {
		return errors.New("config is not valid JSON")
	}
	var header struct {
		Version int `json:"version"`
	}
	if err := json.Unmarshal(document, &header); err != nil {
		return fmt.Errorf("decode config: %w", err)
	}
	if header.Version != 1 {
		return fmt.Errorf("unsupported config version: %d", header.Version)
	}
	return nil
}

func (s *Store) embeddedPath(game, name string) string {
	return path.Join(game, name+".json")
}

func (s *Store) overridePath(game, name string) string {
	return filepath.Join(s.dataRoot, game, name+".json")
}

func (s *Store) Load(game, name string) ([]byte, Source, error) {
	if err := validateKey(game, name); err != nil {
		return nil, "", err
	}

	if document, err := os.ReadFile(s.overridePath(game, name)); err == nil {
		if err := validateDocument(document); err != nil {
			return nil, "", fmt.Errorf("invalid override: %w", err)
		}
		return document, SourceOverride, nil
	} else if !os.IsNotExist(err) {
		return nil, "", fmt.Errorf("read override: %w", err)
	}

	document, err := fs.ReadFile(s.embedded, s.embeddedPath(game, name))
	if err != nil {
		return nil, "", fmt.Errorf("read embedded config: %w", err)
	}
	if err := validateDocument(document); err != nil {
		return nil, "", fmt.Errorf("invalid embedded config: %w", err)
	}
	return document, SourceEmbedded, nil
}

func (s *Store) Save(game, name string, document []byte) error {
	if err := validateKey(game, name); err != nil {
		return err
	}
	if err := validateDocument(document); err != nil {
		return err
	}

	dir := filepath.Dir(s.overridePath(game, name))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}

	tmp, err := os.CreateTemp(dir, name+"-*.tmp")
	if err != nil {
		return fmt.Errorf("create temporary config: %w", err)
	}
	tmpName := tmp.Name()
	removeTmp := true
	defer func() {
		_ = tmp.Close()
		if removeTmp {
			_ = os.Remove(tmpName)
		}
	}()

	if _, err := tmp.Write(document); err != nil {
		return fmt.Errorf("write temporary config: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		return fmt.Errorf("sync temporary config: %w", err)
	}
	if err := tmp.Chmod(0o644); err != nil {
		return fmt.Errorf("chmod temporary config: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close temporary config: %w", err)
	}
	if err := os.Rename(tmpName, s.overridePath(game, name)); err != nil {
		return fmt.Errorf("replace config override: %w", err)
	}
	removeTmp = false
	return nil
}

func (s *Store) Reset(game, name string) error {
	if err := validateKey(game, name); err != nil {
		return err
	}
	err := os.Remove(s.overridePath(game, name))
	if err == nil || os.IsNotExist(err) {
		return nil
	}
	return fmt.Errorf("remove config override: %w", err)
}
