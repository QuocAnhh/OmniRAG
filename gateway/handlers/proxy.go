package handlers

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/omnirag/gateway/config"
)

const (
	// FIX #2: Limit request body to 10MB to prevent OOM attacks
	maxBodySize = 10 * 1024 * 1024 // 10 MB

	// Max duration for a single SSE stream (prevents goroutine exhaustion)
	maxStreamDuration = 30 * time.Minute
)

type ProxyHandler struct {
	logger     *zap.Logger
	redis      *redis.Client
	config     *config.Config
	httpClient *http.Client
}

func NewProxyHandler(logger *zap.Logger, redis *redis.Client, cfg *config.Config) *ProxyHandler {
	return &ProxyHandler{
		logger: logger,
		redis:  redis,
		config: cfg,
		httpClient: &http.Client{
			Timeout: 120 * time.Second, // Longer timeout for RAG operations
		},
	}
}

// ProxyToPython forwards requests to Python backend with caching and streaming support
func (h *ProxyHandler) ProxyToPython(c *gin.Context) {
	path := c.Request.URL.Path
	method := c.Request.Method

	// FIX #2: Limit body size to prevent memory exhaustion (OOM) attacks
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodySize)
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		if strings.Contains(err.Error(), "http: request body too large") {
			h.logger.Warn("Request body too large, rejected",
				zap.String("path", path),
				zap.String("ip", c.ClientIP()),
			)
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": "Request body exceeds 10MB limit",
			})
			return
		}
		h.logger.Error("Failed to read request body", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Detect streaming endpoints — skip caching entirely
	isStreamingEndpoint := strings.Contains(path, "/chat-stream") ||
		strings.Contains(path, "stream")

	// Dynamic endpoints that should NEVER be cached (they change with every request)
	isDynamicEndpoint := strings.Contains(path, "/sessions") ||
		strings.Contains(path, "/history") ||
		strings.Contains(path, "/memory") ||
		strings.Contains(path, "/analytics")

	// Check if client requests cache bypass
	bypassCache := c.GetHeader("Cache-Control") == "no-cache" || c.GetHeader("Pragma") == "no-cache" || strings.Contains(c.GetHeader("Cache-Control"), "no-cache")

	// FIX #3: Cache only GET requests, and include Authorization to prevent user data leaks
	// Also skip cache for dynamic endpoints that change frequently
	if method == "GET" && !isStreamingEndpoint && !isDynamicEndpoint && !bypassCache {
		// FIX #3: Include auth token in cache key so each user gets their own cache
		authHeader := c.GetHeader("Authorization")
		cacheKey := h.generateCacheKey(path, string(bodyBytes), authHeader)
		if cached, err := h.getFromCache(cacheKey); err == nil && cached != nil {
			h.logger.Info("Cache HIT", zap.String("path", path))
			c.Header("X-Cache", "HIT")
			c.JSON(http.StatusOK, cached)
			return
		}
	}

	// Build target URL
	targetURL := fmt.Sprintf("%s%s", h.config.PythonBackendURL, path)
	if c.Request.URL.RawQuery != "" {
		targetURL = fmt.Sprintf("%s?%s", targetURL, c.Request.URL.RawQuery)
	}

	// Create new request
	req, err := http.NewRequest(method, targetURL, bytes.NewReader(bodyBytes))
	if err != nil {
		h.logger.Error("Failed to create request", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to proxy request"})
		return
	}

	// Copy headers from client
	for key, values := range c.Request.Header {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}

	// Add forwarding metadata
	req.Header.Set("X-Forwarded-For", c.ClientIP())
	req.Header.Set("X-Real-IP", c.ClientIP())

	h.logger.Info("Proxying request",
		zap.String("method", method),
		zap.String("path", path),
		zap.String("target", targetURL),
		zap.Bool("streaming", isStreamingEndpoint),
	)

	// Route streaming requests to a dedicated handler
	if isStreamingEndpoint {
		h.proxyStreaming(c, req, path)
		return
	}

	// Standard proxy
	resp, err := h.httpClient.Do(req)
	if err != nil {
		h.logger.Error("Failed to proxy request", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": "Backend service unavailable"})
		return
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		h.logger.Error("Failed to read response", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read backend response"})
		return
	}

	// Cache only successful GET responses (exclude dynamic/streaming endpoints)
	if resp.StatusCode == http.StatusOK && method == "GET" && !isDynamicEndpoint {
		var responseData interface{}
		if err := json.Unmarshal(respBody, &responseData); err == nil {
			authHeader := c.GetHeader("Authorization")
			cacheKey := h.generateCacheKey(path, string(bodyBytes), authHeader)
			h.saveToCache(cacheKey, responseData)
		}
	}

	// Copy response headers to client
	for key, values := range resp.Header {
		for _, value := range values {
			c.Header(key, value)
		}
	}

	c.Header("X-Cache", "MISS")
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), respBody)
}

// proxyStreaming handles SSE (Server-Sent Events) streaming responses.
// FIX #4: Uses context with max timeout + client disconnect detection to prevent goroutine leaks.
func (h *ProxyHandler) proxyStreaming(c *gin.Context, req *http.Request, path string) {
	// FIX #4: Bounded timeout for streaming — prevents goroutines from leaking indefinitely.
	// 30 minutes is generous enough for any RAG response.
	ctx, cancel := context.WithTimeout(c.Request.Context(), maxStreamDuration)
	defer cancel()

	req = req.WithContext(ctx)

	// Dedicated client with no timeout — timeout is managed by the context above
	streamClient := &http.Client{
		Timeout: 0,
	}

	resp, err := streamClient.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			h.logger.Warn("Streaming request cancelled or timed out", zap.String("path", path))
			return
		}
		h.logger.Error("Failed to proxy streaming request", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": "Backend service unavailable"})
		return
	}
	defer resp.Body.Close()

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			c.Header(key, value)
		}
	}

	// Enforce SSE headers for proper streaming
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Accel-Buffering", "no") // Disable nginx proxy buffering
	c.Header("Connection", "keep-alive")
	c.Status(resp.StatusCode)

	flusher, canFlush := c.Writer.(http.Flusher)
	buf := make([]byte, 4096)

	for {
		// Check if client disconnected or context expired before each read
		select {
		case <-ctx.Done():
			h.logger.Info("Streaming stopped: context done",
				zap.String("path", path),
				zap.Error(ctx.Err()),
			)
			return
		default:
		}

		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := c.Writer.Write(buf[:n]); writeErr != nil {
				// Client disconnected — stop streaming, free the goroutine
				h.logger.Info("Client disconnected during stream",
					zap.String("path", path),
					zap.Error(writeErr),
				)
				return
			}
			if canFlush {
				flusher.Flush()
			}
		}
		if readErr != nil {
			if readErr != io.EOF {
				h.logger.Error("Stream read error",
					zap.String("path", path),
					zap.Error(readErr),
				)
			}
			break
		}
	}

	h.logger.Info("Streaming completed", zap.String("path", path))
}

// generateCacheKey creates a cache key using SHA-256 (FIX #3 + replaces MD5).
// authToken is included to prevent cross-user cache pollution.
func (h *ProxyHandler) generateCacheKey(path, body, authToken string) string {
	// FIX #3: Include auth token so user A never sees user B's cached data
	// FIX MD5 → SHA-256: collision-resistant, still fast enough for cache keys
	hash := sha256.Sum256([]byte(path + "|" + body + "|" + authToken))
	return fmt.Sprintf("gateway:cache:%s", hex.EncodeToString(hash[:]))
}

// getFromCache retrieves a cached response from Redis
func (h *ProxyHandler) getFromCache(key string) (interface{}, error) {
	ctx := context.Background()
	val, err := h.redis.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var data interface{}
	if err := json.Unmarshal([]byte(val), &data); err != nil {
		return nil, err
	}

	return data, nil
}

// saveToCache stores a response in Redis with TTL
func (h *ProxyHandler) saveToCache(key string, data interface{}) {
	ctx := context.Background()
	jsonData, err := json.Marshal(data)
	if err != nil {
		h.logger.Error("Failed to marshal cache data", zap.Error(err))
		return
	}

	ttl := time.Duration(h.config.CacheTTL) * time.Second
	if err := h.redis.Set(ctx, key, jsonData, ttl).Err(); err != nil {
		h.logger.Error("Failed to save to cache", zap.Error(err))
	}
}
