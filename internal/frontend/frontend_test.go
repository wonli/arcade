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
		"index.html": &fstest.MapFile{Data: []byte(`<!doctype html><div id="app"></div>`)},
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
	if !strings.Contains(recorder.Body.String(), `<div id="app"></div>`) {
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

func TestRegisterFallsBackToIndexForSPARoute(t *testing.T) {
	engine := testEngine()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/room/ABC123", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if !strings.Contains(recorder.Body.String(), `<div id="app"></div>`) {
		t.Fatalf("SPA route did not fall back to index.html: %q", recorder.Body.String())
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
