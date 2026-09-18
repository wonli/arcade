package gamereplay

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

const maxUploadRequestBytes = MaxReplayBytes + 4<<10

type responseMetadata struct {
	Game       string `json:"game"`
	Version    int    `json:"version"`
	DurationMS int    `json:"durationMs"`
	Players    int    `json:"players"`
	RecordedAt any    `json:"recordedAt"`
	Hash       string `json:"hash"`
	Size       int    `json:"size"`
	DataURL    string `json:"dataUrl"`
}

func replayResponse(meta Metadata) responseMetadata {
	return responseMetadata{
		Game: meta.Game,
		Version: meta.Version,
		DurationMS: meta.DurationMS,
		Players: meta.Players,
		RecordedAt: meta.RecordedAt,
		Hash: meta.Hash,
		Size: meta.Size,
		DataURL: fmt.Sprintf("/api/game-replays/%s/data?v=%s", meta.Game, meta.Hash),
	}
}

func NewHandler(store *Store) http.Handler {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	RegisterRoutes(engine, store)
	return engine
}

func RegisterRoutes(engine *gin.Engine, store *Store) {
	engine.GET("/api/game-replays/:game", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		game, err := normalizeGame(c.Param("game"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "game replay not found"})
			return
		}
		meta, _, err := store.Load(game)
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "game replay not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, replayResponse(meta))
	})

	engine.GET("/api/game-replays/:game/data", func(c *gin.Context) {
		game, err := normalizeGame(c.Param("game"))
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		meta, data, err := store.Load(game)
		if errors.Is(err, ErrNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Header("Content-Type", "application/octet-stream")
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
		c.Header("ETag", `"`+meta.Hash+`"`)
		c.Data(http.StatusOK, "application/octet-stream", data)
	})

	engine.POST("/api/game-replays/:game", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		game, err := normalizeGame(c.Param("game"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "unknown game"})
			return
		}
		if !store.ValidateLease(game, c.GetHeader("X-Arcade-Replay-Lease")) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "active replay lease required"})
			return
		}
		if contentType := strings.ToLower(strings.TrimSpace(strings.Split(c.GetHeader("Content-Type"), ";")[0])); contentType != "application/octet-stream" {
			c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "replay upload must be application/octet-stream"})
			return
		}

		version, err := requiredIntHeader(c, "X-Arcade-Replay-Version")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		durationMS, err := requiredIntHeader(c, "X-Arcade-Replay-Duration-Ms")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		players, err := requiredIntHeader(c, "X-Arcade-Replay-Players")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		hash := strings.ToLower(strings.TrimSpace(c.GetHeader("X-Arcade-Replay-Hash")))
		if hash == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing X-Arcade-Replay-Hash"})
			return
		}

		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadRequestBytes)
		payload, err := io.ReadAll(io.LimitReader(c.Request.Body, MaxReplayBytes+1))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid replay payload"})
			return
		}
		meta, err := store.Save(game, SaveInput{
			Version: version,
			DurationMS: durationMS,
			Players: players,
			Hash: hash,
			Data: payload,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, replayResponse(meta))
	})
}

func requiredIntHeader(c *gin.Context, name string) (int, error) {
	raw := strings.TrimSpace(c.GetHeader(name))
	if raw == "" {
		return 0, fmt.Errorf("missing %s", name)
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("invalid %s", name)
	}
	return value, nil
}
