package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/omnirag/gateway/config"
)

const (
	// redisPingTimeout is the maximum time allowed for a Redis ping in health checks.
	redisPingTimeout = 2 * time.Second

	// backendCheckTimeout is the maximum time allowed for the backend reachability check.
	backendCheckTimeout = 5 * time.Second
)

// HealthHandler handles liveness, readiness, and metrics endpoints.
type HealthHandler struct {
	logger        *zap.Logger
	redis         *redis.Client
	config        *config.Config
	backendClient *http.Client // reused across health probes; avoids per-call connection pool thrash
}

// NewHealthHandler constructs a HealthHandler with a pre-allocated HTTP client.
func NewHealthHandler(logger *zap.Logger, redis *redis.Client, cfg *config.Config) *HealthHandler {
	return &HealthHandler{
		logger: logger,
		redis:  redis,
		config: cfg,
		backendClient: &http.Client{
			Timeout: backendCheckTimeout,
		},
	}
}

// HealthCheck returns service health status (liveness probe).
func (h *HealthHandler) HealthCheck(c *gin.Context) {
	health := gin.H{
		"status":    "healthy",
		"timestamp": time.Now().Format(time.RFC3339),
		"service":   "omnirag-gateway",
		"version":   "1.0.0",
	}

	// Check Redis with a bounded timeout so a blocked Redis cannot stall the handler.
	redisCtx, redisCancel := context.WithTimeout(c.Request.Context(), redisPingTimeout)
	defer redisCancel()

	if err := h.redis.Ping(redisCtx).Err(); err != nil {
		h.logger.Error("Redis health check failed", zap.Error(err))
		health["redis"] = "unhealthy"
		health["status"] = "degraded"
	} else {
		health["redis"] = "healthy"
	}

	// Check Python backend reachability.
	backendURL := h.config.PythonBackendURL + "/docs"
	backendReq, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, backendURL, nil)
	if err != nil {
		h.logger.Error("Failed to build backend health request", zap.Error(err))
		health["backend"] = "unhealthy"
		health["status"] = "degraded"
	} else {
		resp, err := h.backendClient.Do(backendReq)
		if err != nil {
			h.logger.Error("Backend health check failed", zap.Error(err))
			health["backend"] = "unhealthy"
			health["status"] = "degraded"
		} else {
			// Always close the body to prevent a connection leak regardless of status.
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				health["backend"] = "healthy"
			} else {
				health["backend"] = "unhealthy"
				health["status"] = "degraded"
			}
		}
	}

	statusCode := http.StatusOK
	if health["status"] == "degraded" {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, health)
}

// ReadinessCheck returns whether the service is ready to accept traffic.
func (h *HealthHandler) ReadinessCheck(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), redisPingTimeout)
	defer cancel()

	if err := h.redis.Ping(ctx).Err(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"ready":  false,
			"reason": "Redis unavailable",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ready": true})
}

// MetricsHandler returns basic Redis stats.
func (h *HealthHandler) MetricsHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), redisPingTimeout)
	defer cancel()

	info, err := h.redis.Info(ctx, "stats").Result()
	if err != nil {
		h.logger.Error("Failed to fetch Redis metrics", zap.Error(err))
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Redis metrics unavailable",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"service":    "omnirag-gateway",
		"redis_info": info,
		"timestamp":  time.Now().Format(time.RFC3339),
	})
}
