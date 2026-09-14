package gameconfig

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

const maxConfigDocumentSize = 1 << 20

func writeDocument(c *gin.Context, store *Store) {
	document, source, err := store.Load("dungeon", "weapon-presentation")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"source": source,
		"config": json.RawMessage(document),
	})
}

func RegisterRoutes(engine *gin.Engine, store *Store) {
	const endpoint = "/api/dungeon/config/weapon-presentation"

	engine.GET(endpoint, func(c *gin.Context) {
		writeDocument(c, store)
	})

	engine.PUT(endpoint, func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxConfigDocumentSize)
		document, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid config body"})
			return
		}
		if err := store.Save("dungeon", "weapon-presentation", document); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		writeDocument(c, store)
	})

	engine.DELETE(endpoint, func(c *gin.Context) {
		if err := store.Reset("dungeon", "weapon-presentation"); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		writeDocument(c, store)
	})
}
