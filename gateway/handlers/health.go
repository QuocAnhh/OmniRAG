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

type HealthHandler struct {
	logger *zap.Logger
	redis  *redis.Client
	config *config.Config
}

func NewHealthHandler(logger *zap.Logger, redis *redis.Client, cfg *config.Config) *HealthHandler {
	return &HealthHandler{
		logger: logger,
		redis:  redis,
		config: cfg,
	}
}

// HealthCheck returns service health status
func (h *HealthHandler) HealthCheck(c *gin.Context) {
	ctx := context.Background()
	
	health := gin.H{
		"status": "healthy",
		"timestamp": time.Now().Format(time.RFC3339),
		"service": "omnirag-gateway",
		"version": "1.0.0",
	}
	
	// Check Redis connection
	if err := h.redis.Ping(ctx).Err(); err != nil {
		h.logger.Error("Redis health check failed", zap.Error(err))
		health["redis"] = "unhealthy"
		health["status"] = "degraded"
	} else {
		health["redis"] = "healthy"
	}
	
	// Check Python backend
	backendURL := h.config.PythonBackendURL + "/docs"
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(backendURL)
	if err != nil || resp.StatusCode != http.StatusOK {
		h.logger.Error("Backend health check failed", zap.Error(err))
		health["backend"] = "unhealthy"
		health["status"] = "degraded"
	} else {
		health["backend"] = "healthy"
		resp.Body.Close()
	}
	
	statusCode := http.StatusOK
	if health["status"] == "degraded" {
		statusCode = http.StatusServiceUnavailable
	}
	
	c.JSON(statusCode, health)
}

// ReadinessCheck returns if service is ready to accept traffic
func (h *HealthHandler) ReadinessCheck(c *gin.Context) {
	ctx := context.Background()
	
	// Check if Redis is accessible
	if err := h.redis.Ping(ctx).Err(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"ready": false,
			"reason": "Redis unavailable",
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"ready": true,
	})
}

// MetricsHandler returns basic metrics
func (h *HealthHandler) MetricsHandler(c *gin.Context) {
	ctx := context.Background()
	
	// Get Redis stats
	info := h.redis.Info(ctx, "stats").Val()
	
	c.JSON(http.StatusOK, gin.H{
		"service": "omnirag-gateway",
		"redis_info": info,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}
