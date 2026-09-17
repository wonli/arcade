package gamepreview

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func previewRouter(store *Store) *gin.Engine {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	RegisterRoutes(engine, store)
	return engine
}

func uploadRequest(t *testing.T, game, token string, image []byte, contentType string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	partHeader := make(map[string][]string)
	partHeader["Content-Disposition"] = []string{`form-data; name="image"; filename="preview.jpg"`}
	partHeader["Content-Type"] = []string{contentType}
	part, err := writer.CreatePart(textprotoMIMEHeader(partHeader))
	if err != nil { t.Fatal(err) }
	if _, err := part.Write(image); err != nil { t.Fatal(err) }
	_ = writer.WriteField("roomId", "ABC123")
	_ = writer.WriteField("players", "2")
	_ = writer.WriteField("summary", `{"score":900}`)
	if err := writer.Close(); err != nil { t.Fatal(err) }

	req := httptest.NewRequest(http.MethodPost, "/api/game-previews/"+game, &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if token != "" { req.Header.Set("X-Arcade-Preview-Token", token) }
	return req
}

// textprotoMIMEHeader keeps the test readable without coupling routes to multipart.FileHeader internals.
func textprotoMIMEHeader(values map[string][]string) mapHeader { return mapHeader(values) }
type mapHeader map[string][]string

func TestRoutesMissingPreviewReturns404(t *testing.T) {
	engine := previewRouter(NewStore(t.TempDir()))
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/game-previews/gomoku", nil))
	if recorder.Code != http.StatusNotFound { t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String()) }
}

func TestRoutesRejectUnauthorizedUpload(t *testing.T) {
	store := NewStore(t.TempDir())
	engine := previewRouter(store)
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, uploadRequest(t, "gomoku", "", testJPEG(t), "image/jpeg"))
	if recorder.Code != http.StatusUnauthorized { t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String()) }
}

func TestRoutesUploadReadAndCooldown(t *testing.T) {
	now := time.Date(2026, 9, 17, 14, 3, 0, 0, time.UTC)
	store := NewStore(t.TempDir())
	store.now = func() time.Time { return now }
	token, _, err := store.IssueToken("player-1")
	if err != nil { t.Fatal(err) }
	engine := previewRouter(store)

	first := httptest.NewRecorder()
	engine.ServeHTTP(first, uploadRequest(t, "tetris", token, testJPEG(t), "image/jpeg"))
	if first.Code != http.StatusOK { t.Fatalf("upload status = %d body=%s", first.Code, first.Body.String()) }
	var meta struct {
		Game string `json:"game"`
		ImageURL string `json:"imageUrl"`
	}
	if err := json.Unmarshal(first.Body.Bytes(), &meta); err != nil { t.Fatal(err) }
	if meta.Game != "tetris" || meta.ImageURL == "" { t.Fatalf("metadata = %#v", meta) }

	read := httptest.NewRecorder()
	engine.ServeHTTP(read, httptest.NewRequest(http.MethodGet, "/api/game-previews/tetris", nil))
	if read.Code != http.StatusOK { t.Fatalf("read status = %d body=%s", read.Code, read.Body.String()) }

	imageResponse := httptest.NewRecorder()
	engine.ServeHTTP(imageResponse, httptest.NewRequest(http.MethodGet, "/api/game-previews/tetris/image", nil))
	if imageResponse.Code != http.StatusOK || imageResponse.Header().Get("Content-Type") != "image/jpeg" {
		t.Fatalf("image status=%d content-type=%q", imageResponse.Code, imageResponse.Header().Get("Content-Type"))
	}

	now = now.Add(2 * time.Second)
	second := httptest.NewRecorder()
	engine.ServeHTTP(second, uploadRequest(t, "tetris", token, testJPEG(t), "image/jpeg"))
	if second.Code != http.StatusTooManyRequests { t.Fatalf("cooldown status = %d body=%s", second.Code, second.Body.String()) }
	var cooldown struct { RetryAfter int `json:"retryAfter"` }
	if err := json.Unmarshal(second.Body.Bytes(), &cooldown); err != nil { t.Fatal(err) }
	if cooldown.RetryAfter < 27 || cooldown.RetryAfter > 28 { t.Fatalf("retryAfter = %d", cooldown.RetryAfter) }
}
