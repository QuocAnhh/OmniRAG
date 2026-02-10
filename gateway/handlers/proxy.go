package handlers

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	
	"github.com/omnirag/gateway/config"
)

type ProxyHandler struct {
	logger      *zap.Logger
	redis       *redis.Client
	config      *config.Config
	httpClient  *http.Client
}

func NewProxyHandler(logger *zap.Logger, redis *redis.Client, cfg *config.Config) *ProxyHandler {
	return &ProxyHandler{
		logger: logger,
		redis:  redis,
		config: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ProxyToPython forwards requests to Python backend with caching
func (h *ProxyHandler) ProxyToPython(c *gin.Context) {
	path := c.Request.URL.Path
	method := c.Request.Method
	
	// Read request body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		h.logger.Error("Failed to read request body", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	
	// Check cache for GET requests and chat endpoints
	if method == "GET" || (method == "POST" && contains(path, "/chat")) {
		cacheKey := h.generateCacheKey(path, string(bodyBytes))
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
	
	// Copy headers
	for key, values := range c.Request.Header {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}
	
	// Forward request to Python backend
	h.logger.Info("Proxying request",
		zap.String("method", method),
		zap.String("path", path),
		zap.String("target", targetURL),
	)
	
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
	
	// Cache successful responses
	if resp.StatusCode == http.StatusOK && (method == "GET" || contains(path, "/chat")) {
		var responseData interface{}
		if err := json.Unmarshal(respBody, &responseData); err == nil {
			cacheKey := h.generateCacheKey(path, string(bodyBytes))
			h.saveToCache(cacheKey, responseData)
		}
	}
	
	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			c.Header(key, value)
		}
	}
	
	c.Header("X-Cache", "MISS")
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), respBody)
}

// generateCacheKey creates a cache key from path and body
func (h *ProxyHandler) generateCacheKey(path, body string) string {
	hash := md5.Sum([]byte(path + body))
	return fmt.Sprintf("gateway:cache:%s", hex.EncodeToString(hash[:]))
}

// getFromCache retrieves cached response
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

// saveToCache stores response in cache
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

func contains(str, substr string) bool {
	return len(str) >= len(substr) && str[len(str)-len(substr):] == substr || 
	       bytes.Contains([]byte(str), []byte(substr))
}
