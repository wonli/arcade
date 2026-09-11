package room

import (
	"crypto/rand"
	"errors"
	"sync"
)

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

type Manager struct { rooms sync.Map }
func NewManager() *Manager { return &Manager{} }

func (m *Manager) Create(gameName string, maxPlayers int) (*Room, error) {
	for range 10 {
		id, err := roomID(6); if err != nil { return nil, err }
		r := New(id, gameName, maxPlayers)
		if _, loaded := m.rooms.LoadOrStore(id, r); !loaded { return r, nil }
	}
	return nil, errors.New("could not allocate room id")
}
func (m *Manager) Get(id string) (*Room, bool) { v, ok := m.rooms.Load(id); if !ok { return nil, false }; return v.(*Room), true }
func roomID(length int) (string, error) {
	buf := make([]byte, length); random := make([]byte, length)
	if _, err := rand.Read(random); err != nil { return "", err }
	for i := range buf { buf[i] = alphabet[int(random[i])%len(alphabet)] }
	return string(buf), nil
}
