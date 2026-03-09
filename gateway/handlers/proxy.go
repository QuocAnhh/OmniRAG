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
	// maxBodySize is the default body size limit for normal API requests.
	maxBodySize = 10 * 1024 * 1024 // 10 MB

	// maxUploadBodySize is the higher limit for document upload endpoints.
	maxUploadBodySize = 20 * 1024 * 1024 // 20 MB

	// maxStreamDuration is the maximum duration for a single SSE stream.
	// Prevents goroutine exhaustion from abandoned connections.
	maxStreamDuration = 30 * time.Minute

	// cacheOpTimeout is the maximum time for a Redis cache operation.
	cacheOpTimeout = 500 * time.Millisecond
)

// ProxyHandler forwards incoming requests to the Python backend with caching
// and streaming support.
type ProxyHandler struct {
	logger       *zap.Logger
	redis        *redis.Client
	config       *config.Config
	httpClient   *http.Client // reused for standard (non-streaming) upstream calls
	streamClient *http.Client // reused for SSE streaming; Timeout=0, context controls deadline
}

// NewProxyHandler constructs a ProxyHandler with pre-allocated HTTP clients.
func NewProxyHandler(logger *zap.Logger, redis *redis.Client, cfg *config.Config) *ProxyHandler {
	return &ProxyHandler{
		logger: logger,
		redis:  redis,
		config: cfg,
		httpClient: &http.Client{
			Timeout: 120 * time.Second, // generous timeout for RAG operations
		},
		streamClient: &http.Client{
			Timeout: 0, // streaming deadline managed by per-request context
		},
	}
}

// ProxyToPython forwards requests to the Python backend with caching and
// streaming support.
func (h *ProxyHandler) ProxyToPython(c *gin.Context) {
	path := c.Request.URL.Path
	method := c.Request.Method

	// Apply a higher body size limit for document upload endpoints.
	bodyLimit := int64(maxBodySize)
	limitErrMsg := "Request body exceeds 10MB limit"
	if method == "POST" && strings.Contains(path, "/documents") {
		bodyLimit = int64(maxUploadBodySize)
		limitErrMsg = "Request body exceeds 20MB limit"
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, bodyLimit)
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		if strings.Contains(err.Error(), "http: request body too large") {
			h.logger.Warn("Request body too large, rejected",
				zap.String("path", path),
				zap.String("ip", c.ClientIP()),
			)
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": limitErrMsg})
			return
		}
		h.logger.Error("Failed to read request body", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Detect streaming endpoints — skip caching entirely.
	isStreamingEndpoint := strings.Contains(path, "/chat-stream") ||
		strings.Contains(path, "stream")

	// Dynamic endpoints that must never be cached (change with every request).
	isDynamicEndpoint := strings.Contains(path, "/sessions") ||
		strings.Contains(path, "/history") ||
		strings.Contains(path, "/memory") ||
		strings.Contains(path, "/analytics") ||
		strings.Contains(path, "/knowledge-graph") ||
		strings.Contains(path, "/documents")

	bypassCache := strings.Contains(c.GetHeader("Cache-Control"), "no-cache") ||
		c.GetHeader("Pragma") == "no-cache"

	// Cache only GET requests; include Authorization to prevent cross-user leaks.
	if method == "GET" && !isStreamingEndpoint && !isDynamicEndpoint && !bypassCache {
		authHeader := c.GetHeader("Authorization")
		cacheKey := h.generateCacheKey(path, string(bodyBytes), authHeader)
		if cached, err := h.getFromCache(c.Request.Context(), cacheKey); err == nil && cached != nil {
			h.logger.Info("Cache HIT", zap.String("path", path))
			c.Header("X-Cache", "HIT")
			c.JSON(http.StatusOK, cached)
			return
		}
	}

	// Build target URL.
	targetURL := fmt.Sprintf("%s%s", h.config.PythonBackendURL, path)
	if c.Request.URL.RawQuery != "" {
		targetURL = fmt.Sprintf("%s?%s", targetURL, c.Request.URL.RawQuery)
	}

	// Create upstream request — propagate client request context so that if the
	// client disconnects, the outbound request is cancelled immediately rather
	// than running until httpClient.Timeout fires.
	req, err := http.NewRequestWithContext(c.Request.Context(), method, targetURL, bytes.NewReader(bodyBytes))
	if err != nil {
		h.logger.Error("Failed to create request", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to proxy request"})
		return
	}

	// Copy headers from client.
	for key, values := range c.Request.Header {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}
	req.Header.Set("X-Forwarded-For", c.ClientIP())
	req.Header.Set("X-Real-IP", c.ClientIP())

	h.logger.Info("Proxying request",
		zap.String("method", method),
		zap.String("path", path),
		zap.String("target", targetURL),
		zap.Bool("streaming", isStreamingEndpoint),
	)

	if isStreamingEndpoint {
		h.proxyStreaming(c, req, path)
		return
	}

	// Standard (non-streaming) proxy.
	resp, err := h.httpClient.Do(req)
	if err != nil {
		h.logger.Error("Failed to proxy request", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": "Backend service unavailable"})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		h.logger.Error("Failed to read response", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read backend response"})
		return
	}

	// Cache successful GET responses (exclude dynamic/streaming endpoints).
	if resp.StatusCode == http.StatusOK && method == "GET" && !isDynamicEndpoint {
		var responseData interface{}
		if err := json.Unmarshal(respBody, &responseData); err == nil {
			authHeader := c.GetHeader("Authorization")
			cacheKey := h.generateCacheKey(path, string(bodyBytes), authHeader)
			h.saveToCache(c.Request.Context(), cacheKey, responseData)
		}
	}

	// Invalidate the GET cache after successful write operations on the same path.
	if resp.StatusCode >= 200 && resp.StatusCode < 300 &&
		(method == "PUT" || method == "PATCH" || method == "DELETE") &&
		!isDynamicEndpoint {
		authHeader := c.GetHeader("Authorization")
		getCacheKey := h.generateCacheKey(path, "", authHeader)
		h.deleteFromCache(c.Request.Context(), getCacheKey)
	}

	for key, values := range resp.Header {
		for _, value := range values {
			c.Header(key, value)
		}
	}
	c.Header("X-Cache", "MISS")
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), respBody)
}

// proxyStreaming handles SSE (Server-Sent Events) streaming responses.
// A bounded context deadline prevents goroutine leaks on abandoned connections.
func (h *ProxyHandler) proxyStreaming(c *gin.Context, req *http.Request, path string) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), maxStreamDuration)
	defer cancel()

	req = req.WithContext(ctx)

	resp, err := h.streamClient.Do(req)
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

	for key, values := range resp.Header {
		for _, value := range values {
			c.Header(key, value)
		}
	}
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Accel-Buffering", "no")
	c.Header("Connection", "keep-alive")
	c.Status(resp.StatusCode)

	flusher, canFlush := c.Writer.(http.Flusher)
	buf := make([]byte, 4096)

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := c.Writer.Write(buf[:n]); writeErr != nil {
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

// generateCacheKey creates a collision-resistant SHA-256 cache key.
// Length-prefixed fields prevent ambiguous collisions (e.g. "/a|b" + "c" vs "/a" + "b|c").
// authToken is included so user A never sees user B's cached data.
func (h *ProxyHandler) generateCacheKey(path, body, authToken string) string {
	raw := fmt.Sprintf("%d:%s|%d:%s|%d:%s", len(path), path, len(body), body, len(authToken), authToken)
	hash := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("gateway:cache:%s", hex.EncodeToString(hash[:]))
}

// getFromCache retrieves a cached response from Redis.
// ctx should be the request context so the cache read is cancelled if the client disconnects.
func (h *ProxyHandler) getFromCache(ctx context.Context, key string) (interface{}, error) {
	cacheCtx, cancel := context.WithTimeout(ctx, cacheOpTimeout)
	defer cancel()

	val, err := h.redis.Get(cacheCtx, key).Result()
	if err != nil {
		return nil, err
	}

	var data interface{}
	if err := json.Unmarshal([]byte(val), &data); err != nil {
		return nil, err
	}
	return data, nil
}

// saveToCache stores a response in Redis with the configured TTL.
func (h *ProxyHandler) saveToCache(ctx context.Context, key string, data interface{}) {
	cacheCtx, cancel := context.WithTimeout(ctx, cacheOpTimeout)
	defer cancel()

	jsonData, err := json.Marshal(data)
	if err != nil {
		h.logger.Error("Failed to marshal cache data", zap.Error(err))
		return
	}

	ttl := time.Duration(h.config.CacheTTL) * time.Second
	if err := h.redis.Set(cacheCtx, key, jsonData, ttl).Err(); err != nil {
		h.logger.Error("Failed to save to cache", zap.Error(err))
	}
}

// deleteFromCache removes a cached entry from Redis (cache invalidation on writes).
func (h *ProxyHandler) deleteFromCache(ctx context.Context, key string) {
	cacheCtx, cancel := context.WithTimeout(ctx, cacheOpTimeout)
	defer cancel()

	if err := h.redis.Del(cacheCtx, key).Err(); err != nil {
		h.logger.Debug("Cache invalidation: key not found or delete failed",
			zap.String("key", key),
			zap.Error(err),
		)
	} else {
		h.logger.Info("Cache invalidated", zap.String("key", key))
	}
}
