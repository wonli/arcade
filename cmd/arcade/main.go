package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wonli/aqi"
	"github.com/wonli/aqi/middlewares"
	"github.com/wonli/aqi/ws"

	"github.com/wonli/arcade/arcade"
	"github.com/wonli/arcade/internal/frontend"
	arcadeserver "github.com/wonli/arcade/server"
)

func main() {
	app := aqi.Init(
		aqi.ConfigFile("config.yaml"),
		aqi.HttpServer("Arcade", "port"),
	)

	engine := gin.Default()
	engine.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	engine.GET("/ws", func(c *gin.Context) {
		ws.HttpHandler(c.Writer, c.Request)
	})

	router := ws.NewRouter().Use(middlewares.Recovery())
	actions := arcadeserver.NewActions(arcade.NewService())
	actions.Register(router)
	actions.RegisterChess(router)
	actions.RegisterDungeon(router)

	frontend.Register(engine)

	app.WithHttpServer(engine)
	app.Start()
}
