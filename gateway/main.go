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
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Configuration error: %v", err)
	}

	var logger *zap.Logger
	if cfg.Environment == "production" {
		logger, err = zap.NewProduction()
	} else {
		logger, err = zap.NewDevelopment()
	}
	if err != nil {
		log.Fatal("Failed to initialize logger:", err)
	}
	defer func() { _ = logger.Sync() }()

	logger.Info("Starting OmniRAG Gateway",
		zap.String("environment", cfg.Environment),
		zap.String("port", cfg.Port),
	)

	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		logger.Fatal("Failed to parse Redis URL", zap.Error(err))
	}
	redisClient := redis.NewClient(opt)

	startupCtx, startupCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer startupCancel()
	if err := redisClient.Ping(startupCtx).Err(); err != nil {
		logger.Warn("Redis connection failed, caching will be disabled", zap.Error(err))
	} else {
		logger.Info("Redis connected successfully")
	}

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.CORS(cfg.CORSAllowedOrigins))
	router.Use(middleware.Logger(logger))

	if cfg.RateLimitEnabled {
		rateLimiter := middleware.NewRateLimiter(redisClient, cfg.RateLimitRPS)
		router.Use(rateLimiter.Middleware())
		logger.Info("Rate limiting enabled", zap.Int("rps", cfg.RateLimitRPS))
	}

	healthHandler := handlers.NewHealthHandler(logger, redisClient, cfg)
	proxyHandler := handlers.NewProxyHandler(logger, redisClient, cfg)

	router.GET("/health", healthHandler.HealthCheck)
	router.GET("/readiness", healthHandler.ReadinessCheck)
	router.GET("/metrics", healthHandler.MetricsHandler)

	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "OmniRAG Gateway",
			"version": "1.0.0",
			"status":  "running",
		})
	})

	router.Any("/api/*path", proxyHandler.ProxyToPython)
	router.Any("/docs", proxyHandler.ProxyToPython)
	router.Any("/redoc", proxyHandler.ProxyToPython)
	router.Any("/openapi.json", proxyHandler.ProxyToPython)

	// NOTE: WriteTimeout is 0 to support long-lived SSE streaming connections.
	// Individual handler timeouts are managed via request contexts.
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      0,
		IdleTimeout:       120 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	go func() {
		logger.Info(fmt.Sprintf("Gateway listening on http://0.0.0.0:%s", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Server failed to start", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down gateway...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Gateway stopped gracefully")
}
