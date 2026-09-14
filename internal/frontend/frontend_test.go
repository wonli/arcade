package frontend

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/gin-gonic/gin"
)

func testEngine() *gin.Engine {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	registerFS(engine, fstest.MapFS{
		"index.html":    &fstest.MapFile{Data: []byte(`<!doctype html><main>home</main>`)},
		"200.html":      &fstest.MapFile{Data: []byte(`<!doctype html><main>room fallback</main>`)},
		"assets/app.js": &fstest.MapFile{Data: []byte(`console.log("arcade")`)},
	})
	return engine
}

func TestRegisterServesIndex(t *testing.T) {
	engine := testEngine()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if !strings.Contains(recorder.Body.String(), "home") {
		t.Fatalf("root did not serve index.html: %q", recorder.Body.String())
	}
}

func TestRegisterServesStaticAsset(t *testing.T) {
	engine := testEngine()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/assets/app.js", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if !strings.Contains(recorder.Body.String(), "arcade") {
		t.Fatalf("asset response = %q", recorder.Body.String())
	}
}

func TestRegisterUsesSvelteKitFallbackForRoomRoute(t *testing.T) {
	engine := testEngine()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/room/ABC123", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if !strings.Contains(recorder.Body.String(), "room fallback") {
		t.Fatalf("room route did not serve 200.html: %q", recorder.Body.String())
	}
}

func TestRegisterUsesSvelteKitFallbackForDungeonRoute(t *testing.T) {
	engine := testEngine()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/dungeon", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if !strings.Contains(recorder.Body.String(), "room fallback") {
		t.Fatalf("dungeon route did not serve 200.html: %q", recorder.Body.String())
	}
}

func TestRegisterUsesSvelteKitFallbackForCleanDungeonRoom(t *testing.T) {
	for _, route := range []string{"/ABC123/dungeon/", "/new/dungeon/"} {
		t.Run(route, func(t *testing.T) {
			engine := testEngine()
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, route, nil)
			engine.ServeHTTP(recorder, request)
			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
			}
			if !strings.Contains(recorder.Body.String(), "room fallback") {
				t.Fatalf("dungeon room route did not serve 200.html: %q", recorder.Body.String())
			}
		})
	}
}

func TestRegisterRejectsUnrelatedDungeonLikeRoute(t *testing.T) {
	engine := testEngine()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/hello/dungeon/", nil)
	engine.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
}

func TestRegisterReturnsNotFoundForMissingAsset(t *testing.T) {
	engine := testEngine()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/assets/does-not-exist.js", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
}

func TestRegisterReturnsNotFoundForUnknownRoute(t *testing.T) {
	engine := testEngine()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/unknown", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
}

func TestRegisterDoesNotServeShellForPost(t *testing.T) {
	engine := testEngine()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/room/ABC123", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
}
