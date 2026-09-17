package gamepreview

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const maxUploadRequestBytes = maxImageBytes + 64<<10

type responseMetadata struct {
	Game       string          `json:"game"`
	ImageURL   string          `json:"imageUrl"`
	CapturedAt time.Time       `json:"capturedAt"`
	RoomID     string          `json:"roomId,omitempty"`
	Players    int             `json:"players,omitempty"`
	Summary    json.RawMessage `json:"summary,omitempty"`
}

func previewResponse(meta Metadata) responseMetadata {
	version := meta.CapturedAt.UTC().Format("20060102T150405.000000000")
	return responseMetadata{
		Game: meta.Game,
		ImageURL: fmt.Sprintf("/api/game-previews/%s/image?v=%s", meta.Game, version),
		CapturedAt: meta.CapturedAt,
		RoomID: meta.RoomID,
		Players: meta.Players,
		Summary: meta.Summary,
	}
}

func RegisterRoutes(engine *gin.Engine, store *Store) {
	engine.GET("/api/game-previews/:game", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		game, err := normalizeGame(c.Param("game"))
		if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": "game preview not found"}); return }
		meta, err := store.Load(game)
		if errors.Is(err, ErrNotFound) { c.JSON(http.StatusNotFound, gin.H{"error": "game preview not found"}); return }
		if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
		c.JSON(http.StatusOK, previewResponse(meta))
	})

	engine.GET("/api/game-previews/:game/image", func(c *gin.Context) {
		game, err := normalizeGame(c.Param("game"))
		if err != nil { c.Status(http.StatusNotFound); return }
		meta, err := store.Load(game)
		if errors.Is(err, ErrNotFound) { c.Status(http.StatusNotFound); return }
		if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
		path, err := store.ImagePath(game)
		if errors.Is(err, ErrNotFound) { c.Status(http.StatusNotFound); return }
		if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
		c.Header("Content-Type", meta.ContentType)
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
		c.File(path)
	})

	engine.POST("/api/game-previews/:game", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		game, err := normalizeGame(c.Param("game"))
		if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": "unknown game"}); return }
		if !store.ValidateToken(c.GetHeader("X-Arcade-Preview-Token")) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "preview upload authorization required"})
			return
		}

		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadRequestBytes)
		if err := c.Request.ParseMultipartForm(maxUploadRequestBytes); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid preview upload"})
			return
		}
		file, header, err := c.Request.FormFile("image")
		if err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": "preview image is required"}); return }
		defer file.Close()
		imageData, err := io.ReadAll(io.LimitReader(file, maxImageBytes+1))
		if err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": "invalid preview image"}); return }

		contentType := header.Header.Get("Content-Type")
		if contentType == "" { contentType = http.DetectContentType(imageData) }
		players := 0
		if raw := strings.TrimSpace(c.Request.FormValue("players")); raw != "" {
			players, err = strconv.Atoi(raw)
			if err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": "invalid players value"}); return }
		}
		summary := json.RawMessage(strings.TrimSpace(c.Request.FormValue("summary")))

		meta, err := store.Save(game, SaveInput{
			Image: imageData,
			ContentType: contentType,
			RoomID: c.Request.FormValue("roomId"),
			Players: players,
			Summary: summary,
		})
		var cooldown *CooldownError
		if errors.As(err, &cooldown) {
			c.Header("Retry-After", strconv.Itoa(cooldown.RetryAfter))
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "preview update is cooling down", "retryAfter": cooldown.RetryAfter})
			return
		}
		if err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
		c.JSON(http.StatusOK, previewResponse(meta))
	})
}
