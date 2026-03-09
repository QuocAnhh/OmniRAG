package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"

	"github.com/omnirag/gateway/config"
)

// newProxySetup creates a ProxyHandler backed by miniredis and a mock backend server.
func newProxySetup(t *testing.T, backendHandler http.Handler) (*ProxyHandler, *miniredis.Miniredis, *httptest.Server) {
	t.Helper()

	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)

	backendSrv := httptest.NewServer(backendHandler)
	t.Cleanup(backendSrv.Close)

	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	cfg := &config.Config{
		Environment:      "test",
		PythonBackendURL: backendSrv.URL,
		CacheTTL:         60,
	}
	h := NewProxyHandler(zaptest.NewLogger(t), client, cfg)
	return h, mr, backendSrv
}

func newProxyRouter(h *ProxyHandler) *gin.Engine {
	r := gin.New()
	r.Any("/api/*path", h.ProxyToPython)
	return r
}

func TestProxyToPython_ForwardsGetRequest(t *testing.T) {
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hello":"world"}`))
	})
	h, _, _ := newProxySetup(t, backend)
	r := newProxyRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bots", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "world", body["hello"])
}

func TestProxyToPython_CachesGetResponse(t *testing.T) {
	callCount := 0
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"count":1}`))
	})
	h, _, _ := newProxySetup(t, backend)
	r := newProxyRouter(h)

	// First request — goes to backend.
	req1 := httptest.NewRequest(http.MethodGet, "/api/v1/bots", nil)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	assert.Equal(t, "MISS", w1.Header().Get("X-Cache"))
	assert.Equal(t, 1, callCount)

	// Second identical request — should hit cache.
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/bots", nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	assert.Equal(t, "HIT", w2.Header().Get("X-Cache"))
	assert.Equal(t, 1, callCount, "backend should not be called again for cached response")
}

func TestProxyToPython_DynamicEndpointNotCached(t *testing.T) {
	callCount := 0
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
	h, _, _ := newProxySetup(t, backend)
	r := newProxyRouter(h)

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/bots/123/sessions", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}
	assert.Equal(t, 3, callCount, "dynamic endpoint /sessions must never be cached")
}

func TestProxyToPython_InvalidateCacheOnDelete(t *testing.T) {
	callCount := 0
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodDelete {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"abc"}`))
	})
	h, _, _ := newProxySetup(t, backend)
	r := newProxyRouter(h)

	// Prime cache with a GET.
	get1 := httptest.NewRequest(http.MethodGet, "/api/v1/bots/abc", nil)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, get1)
	assert.Equal(t, "MISS", w1.Header().Get("X-Cache"))

	// Perform a DELETE to invalidate.
	del := httptest.NewRequest(http.MethodDelete, "/api/v1/bots/abc", nil)
	wd := httptest.NewRecorder()
	r.ServeHTTP(wd, del)
	assert.Equal(t, http.StatusNoContent, wd.Code)

	// GET should now be a MISS (cache was invalidated).
	get2 := httptest.NewRequest(http.MethodGet, "/api/v1/bots/abc", nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, get2)
	assert.Equal(t, "MISS", w2.Header().Get("X-Cache"), "cache should have been invalidated by DELETE")
}

func TestProxyToPython_BackendUnavailableReturns502(t *testing.T) {
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})
	h, _, backendSrv := newProxySetup(t, backend)
	// Shut down the backend before sending request.
	backendSrv.Close()

	r := newProxyRouter(h)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/bots", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadGateway, w.Code)
}

func TestProxyToPython_BodyTooLargeReturns413(t *testing.T) {
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h, _, _ := newProxySetup(t, backend)
	r := newProxyRouter(h)

	// Send a body larger than maxBodySize (10 MB).
	bigBody := strings.Repeat("x", maxBodySize+1)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/something", strings.NewReader(bigBody))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
}

func TestProxyToPython_CacheBypassOnNoCacheHeader(t *testing.T) {
	callCount := 0
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"v":1}`))
	})
	h, _, _ := newProxySetup(t, backend)
	r := newProxyRouter(h)

	// Prime cache.
	req1 := httptest.NewRequest(http.MethodGet, "/api/v1/bots", nil)
	r.ServeHTTP(httptest.NewRecorder(), req1)

	// Second request with Cache-Control: no-cache should bypass the cache.
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/bots", nil)
	req2.Header.Set("Cache-Control", "no-cache")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	assert.Equal(t, "MISS", w2.Header().Get("X-Cache"))
	assert.Equal(t, 2, callCount, "no-cache request should bypass cache and hit backend")
}

func TestGenerateCacheKey_DifferentPathsDifferentKeys(t *testing.T) {
	h := &ProxyHandler{}
	k1 := h.generateCacheKey("/a|b", "c", "token")
	k2 := h.generateCacheKey("/a", "b|c", "token")
	assert.NotEqual(t, k1, k2, "length-prefixed keys must not collide on ambiguous inputs")
}

func TestGenerateCacheKey_SameInputsSameKey(t *testing.T) {
	h := &ProxyHandler{}
	k1 := h.generateCacheKey("/api/v1/bots", "", "Bearer abc")
	k2 := h.generateCacheKey("/api/v1/bots", "", "Bearer abc")
	assert.Equal(t, k1, k2)
}

func TestGenerateCacheKey_DifferentAuthDifferentKeys(t *testing.T) {
	h := &ProxyHandler{}
	k1 := h.generateCacheKey("/api/v1/bots", "", "Bearer user1")
	k2 := h.generateCacheKey("/api/v1/bots", "", "Bearer user2")
	assert.NotEqual(t, k1, k2, "different auth tokens must yield different cache keys")
}
