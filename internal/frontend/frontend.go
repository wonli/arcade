package frontend

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
)

// dist always exists in the repository through dist/.gitkeep. Production
// builds replace the directory contents with Vite output before Go compiles.
//go:embed all:dist
var embedded embed.FS

func Register(engine *gin.Engine) {
	root, err := fs.Sub(embedded, "dist")
	if err != nil {
		panic(fmt.Errorf("frontend: open embedded dist: %w", err))
	}
	registerFS(engine, root)
}

func registerFS(engine *gin.Engine, root fs.FS) {
	fileServer := http.FileServer(http.FS(root))

	engine.NoRoute(func(c *gin.Context) {
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			c.Status(http.StatusNotFound)
			return
		}

		name := strings.TrimPrefix(path.Clean(c.Request.URL.Path), "/")
		if name == "." || name == "" || name == "index.html" {
			serveIndex(c, root)
			return
		}

		if info, err := fs.Stat(root, name); err == nil && !info.IsDir() {
			serveFile(fileServer, c, name)
			return
		}

		// Asset requests must fail loudly instead of returning index.html with a
		// 200 response. That makes broken bundles obvious in both browsers and CI.
		if strings.HasPrefix(name, "assets/") {
			c.Status(http.StatusNotFound)
			return
		}

		serveIndex(c, root)
	})
}

func serveIndex(c *gin.Context, root fs.FS) {
	data, err := fs.ReadFile(root, "index.html")
	if err != nil {
		c.String(http.StatusServiceUnavailable, "frontend is not built")
		return
	}

	if c.Request.Method == http.MethodHead {
		c.Data(http.StatusOK, "text/html; charset=utf-8", nil)
		return
	}
	c.Data(http.StatusOK, "text/html; charset=utf-8", data)
}

func serveFile(server http.Handler, c *gin.Context, name string) {
	request := c.Request.Clone(c.Request.Context())
	url := *c.Request.URL
	url.Path = "/" + name
	request.URL = &url
	server.ServeHTTP(c.Writer, request)
}
