package arcade

import (
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"time"
)

var (
	ErrInvalidSessionState = errors.New("invalid session state")
	ErrStaleSessionState   = errors.New("stale session state")
)

const defaultSessionStateTTL = 30 * time.Minute

type SessionState struct {
	AuthorityID    string          `json:"authorityId"`
	AuthorityEpoch uint64          `json:"authorityEpoch"`
	Revision       uint64          `json:"revision"`
	SchemaVersion  uint64          `json:"schemaVersion"`
	UpdatedAt      time.Time       `json:"updatedAt"`
	Payload        json.RawMessage `json:"payload"`
}

type SessionStateStoreOptions struct {
	TTL time.Duration
	Now func() time.Time
}

type SessionStateStore struct {
	mu      sync.Mutex
	states  map[string]SessionState
	ttl     time.Duration
	now     func() time.Time
}

func NewSessionStateStore(options ...SessionStateStoreOptions) *SessionStateStore {
	cfg := SessionStateStoreOptions{}
	if len(options) > 0 {
		cfg = options[0]
	}
	if cfg.TTL <= 0 {
		cfg.TTL = defaultSessionStateTTL
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	return &SessionStateStore{
		states: make(map[string]SessionState),
		ttl:    cfg.TTL,
		now:    cfg.Now,
	}
}

func sessionStateKey(sessionID string) string {
	return strings.TrimSpace(sessionID)
}

func cloneSessionState(state SessionState) SessionState {
	state.Payload = append(json.RawMessage(nil), state.Payload...)
	return state
}

func (s *SessionStateStore) Get(sessionID string) (SessionState, bool) {
	if s == nil {
		return SessionState{}, false
	}
	key := sessionStateKey(sessionID)
	if key == "" {
		return SessionState{}, false
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	state, ok := s.states[key]
	if !ok {
		return SessionState{}, false
	}
	if !state.UpdatedAt.Add(s.ttl).After(s.now()) {
		delete(s.states, key)
		return SessionState{}, false
	}
	return cloneSessionState(state), true
}

func (s *SessionStateStore) Put(sessionID string, state SessionState) error {
	if s == nil {
		return ErrInvalidSessionState
	}
	key := sessionStateKey(sessionID)
	if key == "" || state.AuthorityEpoch == 0 || state.Revision == 0 || state.SchemaVersion == 0 || len(state.Payload) == 0 {
		return ErrInvalidSessionState
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := s.now()
	if current, ok := s.states[key]; ok {
		if !current.UpdatedAt.Add(s.ttl).After(now) {
			delete(s.states, key)
		} else if state.AuthorityEpoch < current.AuthorityEpoch ||
			(state.AuthorityEpoch == current.AuthorityEpoch && state.Revision <= current.Revision) {
			return ErrStaleSessionState
		}
	}

	state.UpdatedAt = now
	s.states[key] = cloneSessionState(state)
	return nil
}

func (s *SessionStateStore) Delete(sessionID string) {
	if s == nil {
		return
	}
	key := sessionStateKey(sessionID)
	if key == "" {
		return
	}
	s.mu.Lock()
	delete(s.states, key)
	s.mu.Unlock()
}
