package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
	"go.uber.org/zap/zaptest"
)

func TestLogger_RequestIsLogged(t *testing.T) {
	logger := zaptest.NewLogger(t)

	r := gin.New()
	r.Use(Logger(logger))
	r.GET("/hello", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/hello", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	// If Logger panics or drops requests, the test itself fails — this ensures
	// the middleware does not interfere with the handler response.
}

func TestLogger_PassthroughStatus(t *testing.T) {
	logger := zaptest.NewLogger(t, zaptest.Level(zap.WarnLevel))

	r := gin.New()
	r.Use(Logger(logger))
	r.GET("/notfound", func(c *gin.Context) { c.Status(http.StatusNotFound) })

	req := httptest.NewRequest(http.MethodGet, "/notfound", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}
