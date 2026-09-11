package frontend

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRegisterServesIndex(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	Register(engine)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if !strings.Contains(recorder.Body.String(), "<div id=\"app\"></div>") {
		t.Fatalf("root did not serve embedded index.html: %q", recorder.Body.String())
	}
}

func TestRegisterFallsBackToIndexForSPARoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	Register(engine)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/room/ABC123", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if !strings.Contains(recorder.Body.String(), "<div id=\"app\"></div>") {
		t.Fatalf("SPA route did not fall back to index.html: %q", recorder.Body.String())
	}
}

func TestRegisterReturnsNotFoundForMissingAsset(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	Register(engine)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/assets/does-not-exist.js", nil)
	engine.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
}
