package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newCORSRouter(allowedOrigins []string) *gin.Engine {
	r := gin.New()
	r.Use(CORS(allowedOrigins))
	r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })
	return r
}

func TestCORS_AllowedOriginGetsCredentials(t *testing.T) {
	r := newCORSRouter([]string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, "https://app.example.com", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "true", w.Header().Get("Access-Control-Allow-Credentials"))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCORS_DisallowedOriginNoCredentials(t *testing.T) {
	r := newCORSRouter([]string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://evil.com")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// Origin header must NOT be echoed back for an unlisted origin.
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Credentials"))
	assert.Equal(t, http.StatusOK, w.Code) // request still succeeds; CORS is browser enforcement
}

func TestCORS_OptionsPreflightReturns204(t *testing.T) {
	r := newCORSRouter([]string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestCORS_MultipleAllowedOrigins(t *testing.T) {
	origins := []string{"https://a.com", "https://b.com"}
	r := newCORSRouter(origins)

	for _, origin := range origins {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, origin, w.Header().Get("Access-Control-Allow-Origin"), "origin: %s", origin)
	}
}

func TestCORS_CaseInsensitiveOriginMatch(t *testing.T) {
	r := newCORSRouter([]string{"https://App.Example.com"})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://app.example.com") // all lower-case
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, "https://app.example.com", w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORS_AllowHeadersAndMethodsAlwaysPresent(t *testing.T) {
	r := newCORSRouter([]string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.NotEmpty(t, w.Header().Get("Access-Control-Allow-Headers"))
	assert.NotEmpty(t, w.Header().Get("Access-Control-Allow-Methods"))
}
