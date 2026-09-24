package gamereplay

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func replayRouter(store *Store) http.Handler {
	return NewHandler(store)
}

func replayUploadRequest(game, token string, data []byte, durationMS, players int) *http.Request {
	req := httptest.NewRequest(http.MethodPost, "/api/game-replays/"+game, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("X-Arcade-Replay-Lease", token)
	req.Header.Set("X-Arcade-Replay-Version", "1")
	req.Header.Set("X-Arcade-Replay-Duration-Ms", strconv.Itoa(durationMS))
	req.Header.Set("X-Arcade-Replay-Players", strconv.Itoa(players))
	req.Header.Set("X-Arcade-Replay-Hash", sha256Hex(data))
	return req
}

func TestRoutesMissingReplayReturns404(t *testing.T) {
	handler := replayRouter(NewStore(t.TempDir()))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/game-replays/gomoku", nil))
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestRoutesRejectUnauthorizedUpload(t *testing.T) {
	store := NewStore(t.TempDir())
	handler := replayRouter(store)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, replayUploadRequest("gomoku", "bad-token", []byte(`{"frames":[1]}`), 1000, 2))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestRoutesUploadMetadataAndDataRoundTrip(t *testing.T) {
	store := NewStore(t.TempDir())
	lease, err := store.AcquireLease("tetris", "room-a:host-a")
	if err != nil {
		t.Fatal(err)
	}
	handler := replayRouter(store)
	payload := []byte(`{"frames":[{"t":0},{"t":1800}]}`)

	upload := httptest.NewRecorder()
	handler.ServeHTTP(upload, replayUploadRequest("tetris", lease.Token, payload, 1800, 2))
	if upload.Code != http.StatusOK {
		t.Fatalf("upload status=%d body=%s", upload.Code, upload.Body.String())
	}

	var meta map[string]any
	if err := json.Unmarshal(upload.Body.Bytes(), &meta); err != nil {
		t.Fatal(err)
	}
	if meta["game"] != "tetris" || meta["dataUrl"] == "" {
		t.Fatalf("metadata=%#v", meta)
	}
	if _, ok := meta["roomId"]; ok {
		t.Fatalf("public metadata leaked roomId: %#v", meta)
	}
	if _, ok := meta["playerId"]; ok {
		t.Fatalf("public metadata leaked playerId: %#v", meta)
	}

	read := httptest.NewRecorder()
	handler.ServeHTTP(read, httptest.NewRequest(http.MethodGet, "/api/game-replays/tetris", nil))
	if read.Code != http.StatusOK || strings.Contains(read.Body.String(), "room-a") {
		t.Fatalf("metadata status=%d body=%s", read.Code, read.Body.String())
	}

	data := httptest.NewRecorder()
	handler.ServeHTTP(data, httptest.NewRequest(http.MethodGet, "/api/game-replays/tetris/data", nil))
	if data.Code != http.StatusOK || data.Header().Get("Content-Type") != "application/octet-stream" || !bytes.Equal(data.Body.Bytes(), payload) {
		t.Fatalf("data status=%d content-type=%q body=%q", data.Code, data.Header().Get("Content-Type"), data.Body.Bytes())
	}
}

func TestRoutesXiangqiUploadRoundTrip(t *testing.T) {
	store := NewStore(t.TempDir())
	lease, err := store.AcquireLease("xiangqi", "room-x:host-x")
	if err != nil {
		t.Fatalf("acquire xiangqi replay lease: %v", err)
	}

	payload := []byte(`{"frames":[{"t":0,"state":{"turn":"red"}}]}`)
	handler := replayRouter(store)
	upload := httptest.NewRecorder()
	handler.ServeHTTP(upload, replayUploadRequest("xiangqi", lease.Token, payload, 1200, 2))
	if upload.Code != http.StatusOK {
		t.Fatalf("upload status=%d body=%s", upload.Code, upload.Body.String())
	}

	var meta map[string]any
	if err := json.Unmarshal(upload.Body.Bytes(), &meta); err != nil {
		t.Fatal(err)
	}
	if meta["game"] != "xiangqi" {
		t.Fatalf("metadata=%#v", meta)
	}

	data := httptest.NewRecorder()
	handler.ServeHTTP(data, httptest.NewRequest(http.MethodGet, "/api/game-replays/xiangqi/data", nil))
	if data.Code != http.StatusOK || !bytes.Equal(data.Body.Bytes(), payload) {
		t.Fatalf("data status=%d body=%q", data.Code, data.Body.Bytes())
	}
}
