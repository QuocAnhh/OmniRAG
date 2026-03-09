package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"

	"github.com/omnirag/gateway/config"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// newHealthSetup creates a test HealthHandler backed by miniredis and an
// optional mock Python backend HTTP server.
func newHealthSetup(t *testing.T) (*HealthHandler, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)

	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	cfg := &config.Config{
		Environment:      "test",
		PythonBackendURL: "http://127.0.0.1:0", // nothing listening; expect unhealthy
	}
	logger := zaptest.NewLogger(t)
	h := NewHealthHandler(logger, client, cfg)
	return h, mr
}

func TestHealthCheck_HealthyRedis(t *testing.T) {
	h, _ := newHealthSetup(t)

	r := gin.New()
	r.GET("/health", h.HealthCheck)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))

	assert.Equal(t, "healthy", body["redis"])
	// Backend will be unhealthy since there's no real server, overall status degraded.
	assert.Equal(t, "degraded", body["status"])
}

func TestHealthCheck_UnhealthyRedis(t *testing.T) {
	h, mr := newHealthSetup(t)
	mr.Close() // shut down Redis

	r := gin.New()
	r.GET("/health", h.HealthCheck)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "unhealthy", body["redis"])
	assert.Equal(t, "degraded", body["status"])
}

func TestHealthCheck_BackendHealthy(t *testing.T) {
	// Spin up a mock backend that answers /docs with 200.
	mockBackend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(mockBackend.Close)

	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)

	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	cfg := &config.Config{
		Environment:      "test",
		PythonBackendURL: mockBackend.URL,
	}
	h := NewHealthHandler(zaptest.NewLogger(t), client, cfg)

	r := gin.New()
	r.GET("/health", h.HealthCheck)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "healthy", body["redis"])
	assert.Equal(t, "healthy", body["backend"])
	assert.Equal(t, "healthy", body["status"])
}

func TestReadinessCheck_ReadyWhenRedisHealthy(t *testing.T) {
	h, _ := newHealthSetup(t)

	r := gin.New()
	r.GET("/readiness", h.ReadinessCheck)

	req := httptest.NewRequest(http.MethodGet, "/readiness", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, true, body["ready"])
}

func TestReadinessCheck_NotReadyWhenRedisDown(t *testing.T) {
	h, mr := newHealthSetup(t)
	mr.Close()

	r := gin.New()
	r.GET("/readiness", h.ReadinessCheck)

	req := httptest.NewRequest(http.MethodGet, "/readiness", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, false, body["ready"])
}

func TestMetricsHandler_RedisDown(t *testing.T) {
	h, mr := newHealthSetup(t)
	mr.Close()

	r := gin.New()
	r.GET("/metrics", h.MetricsHandler)

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestMetricsHandler_RedisHealthy(t *testing.T) {
	h, _ := newHealthSetup(t)

	r := gin.New()
	r.GET("/metrics", h.MetricsHandler)

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "omnirag-gateway", body["service"])
	assert.NotEmpty(t, body["timestamp"])
}
