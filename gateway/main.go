package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	
	"github.com/omnirag/gateway/config"
	"github.com/omnirag/gateway/handlers"
	"github.com/omnirag/gateway/middleware"
)

func main() {
	// Load configuration
	cfg := config.LoadConfig()
	
	// Initialize logger
	var logger *zap.Logger
	var err error
	if cfg.Environment == "production" {
		logger, err = zap.NewProduction()
	} else {
		logger, err = zap.NewDevelopment()
	}
	if err != nil {
		log.Fatal("Failed to initialize logger:", err)
	}
	defer logger.Sync()
	
	logger.Info("🚀 Starting OmniRAG Gateway",
		zap.String("environment", cfg.Environment),
		zap.String("port", cfg.Port),
	)
	
	// Initialize Redis client
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		logger.Fatal("Failed to parse Redis URL", zap.Error(err))
	}
	redisClient := redis.NewClient(opt)
	
	// Test Redis connection
	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		logger.Warn("Redis connection failed, caching will be disabled", zap.Error(err))
	} else {
		logger.Info("✅ Redis connected successfully")
	}
	
	// Set Gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	
	// Initialize Gin router
	router := gin.New()
	
	// Apply global middleware
	router.Use(gin.Recovery())
	router.Use(middleware.CORS())
	router.Use(middleware.Logger(logger))
	
	// Apply rate limiting if enabled
	if cfg.RateLimitEnabled {
		rateLimiter := middleware.NewRateLimiter(redisClient, cfg.RateLimitRPS)
		router.Use(rateLimiter.Middleware())
		logger.Info("✅ Rate limiting enabled", zap.Int("rps", cfg.RateLimitRPS))
	}
	
	// Initialize handlers
	healthHandler := handlers.NewHealthHandler(logger, redisClient, cfg)
	proxyHandler := handlers.NewProxyHandler(logger, redisClient, cfg)
	
	// Health check routes
	router.GET("/health", healthHandler.HealthCheck)
	router.GET("/readiness", healthHandler.ReadinessCheck)
	router.GET("/metrics", healthHandler.MetricsHandler)
	
	// Info route — DO NOT expose internal URLs
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "OmniRAG Gateway",
			"version": "1.0.0",
			"status": "running",
		})
	})
	
	// Proxy all API requests to Python backend
	router.Any("/api/*path", proxyHandler.ProxyToPython)
	router.Any("/docs", proxyHandler.ProxyToPython)
	router.Any("/redoc", proxyHandler.ProxyToPython)
	router.Any("/openapi.json", proxyHandler.ProxyToPython)
	
	// Create HTTP server
	// NOTE: WriteTimeout must be 0 to support long-lived SSE streaming connections.
	// Individual handler timeouts are managed via request contexts instead.
	srv := &http.Server{
		Addr:           ":" + cfg.Port,
		Handler:        router,
		ReadTimeout:    30 * time.Second,
		WriteTimeout:   0, // 0 = no global write timeout (SSE streaming needs this)
		IdleTimeout:    120 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1 MB
	}
	
	// Start server in goroutine
	go func() {
		logger.Info(fmt.Sprintf("🌐 Gateway listening on http://0.0.0.0:%s", cfg.Port))
		logger.Info(fmt.Sprintf("📖 API Docs: http://localhost:%s/docs", cfg.Port))
		logger.Info(fmt.Sprintf("🔍 Health Check: http://localhost:%s/health", cfg.Port))
		
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Server failed to start", zap.Error(err))
		}
	}()
	
	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	
	logger.Info("🛑 Shutting down gateway...")
	
	// Give 30s for in-flight requests (including streaming) to finish
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}
	
	logger.Info("✅ Gateway stopped gracefully")
}
