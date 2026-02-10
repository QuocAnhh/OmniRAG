package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type RateLimiter struct {
	redis *redis.Client
	limit int // requests per second
}

func NewRateLimiter(redisClient *redis.Client, rps int) *RateLimiter {
	return &RateLimiter{
		redis: redisClient,
		limit: rps,
	}
}

// Middleware returns a rate limiting middleware
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		key := fmt.Sprintf("ratelimit:%s", ip)
		
		ctx := context.Background()
		
		// Increment counter
		count, err := rl.redis.Incr(ctx, key).Result()
		if err != nil {
			// If Redis fails, allow the request (fail open)
			c.Next()
			return
		}
		
		// Set expiration on first request
		if count == 1 {
			rl.redis.Expire(ctx, key, time.Second)
		}
		
		// Check if limit exceeded
		if count > int64(rl.limit) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded",
				"limit": rl.limit,
				"retry_after": 1,
			})
			c.Abort()
			return
		}
		
		// Add rate limit headers
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", rl.limit))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", rl.limit-int(count)))
		
		c.Next()
	}
}
