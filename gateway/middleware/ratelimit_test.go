package middleware

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newRateLimitRouter(t *testing.T, rps int) (*gin.Engine, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)

	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	rl := NewRateLimiter(client, rps)

	r := gin.New()
	r.Use(rl.Middleware())
	r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })
	return r, mr
}

func TestRateLimiter_RequestsUnderLimitAreAllowed(t *testing.T) {
	r, _ := newRateLimitRouter(t, 5)

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "request %d should be allowed", i+1)
	}
}

func TestRateLimiter_RequestOverLimitIsBlocked(t *testing.T) {
	r, _ := newRateLimitRouter(t, 2)

	doReq := func() int {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}

	assert.Equal(t, http.StatusOK, doReq(), "request 1/2 should pass")
	assert.Equal(t, http.StatusOK, doReq(), "request 2/2 should pass")
	assert.Equal(t, http.StatusTooManyRequests, doReq(), "request 3/2 should be rate-limited")
}

func TestRateLimiter_RateLimitHeadersPresent(t *testing.T) {
	r, _ := newRateLimitRouter(t, 10)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, "10", w.Header().Get("X-RateLimit-Limit"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Remaining"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Reset"))
}

func TestRateLimiter_ResetHeaderIsUnixTimestamp(t *testing.T) {
	r, _ := newRateLimitRouter(t, 10)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	resetVal := w.Header().Get("X-RateLimit-Reset")
	ts, err := strconv.ParseInt(resetVal, 10, 64)
	require.NoError(t, err, "X-RateLimit-Reset must be a numeric Unix timestamp, got: %s", resetVal)

	// Should be within a few seconds of now.
	now := time.Now().Unix()
	assert.InDelta(t, now, ts, 5, "X-RateLimit-Reset should be close to current Unix time")
}

func TestRateLimiter_WindowResetsAfterOneSec(t *testing.T) {
	r, mr := newRateLimitRouter(t, 1)

	doReq := func() int {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}

	assert.Equal(t, http.StatusOK, doReq(), "first request should pass")
	assert.Equal(t, http.StatusTooManyRequests, doReq(), "second request should be blocked")

	// Fast-forward miniredis clock by 2 seconds to expire the rate-limit key.
	mr.FastForward(2 * time.Second)

	assert.Equal(t, http.StatusOK, doReq(), "request after window reset should pass")
}

func TestRateLimiter_FailOpenWhenRedisDown(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	rl := NewRateLimiter(client, 1)

	r := gin.New()
	r.Use(rl.Middleware())
	r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	// Shut down Redis before sending requests.
	mr.Close()

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "requests should pass when Redis is down (fail-open)")
	}
}
