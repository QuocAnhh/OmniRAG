package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// luaRateLimit is an atomic Lua script that fixes the TOCTOU race condition.
//
// FIX: The original code did INCR then Expire in two separate commands.
// Under high concurrency, two goroutines could both see count==1 and both
// call Expire, or a crash between INCR and Expire would leave the key without
// a TTL (growing forever). This Lua script runs atomically in Redis:
//   1. INCR the counter
//   2. If it's a fresh key (count==1), set TTL=1s
//   3. Return current count
//
// Because Lua scripts run atomically in Redis, there is NO race condition.
var luaRateLimit = redis.NewScript(`
local key   = KEYS[1]
local limit = tonumber(ARGV[1])
local count = redis.call("INCR", key)
if count == 1 then
    redis.call("EXPIRE", key, 1)
end
return count
`)

type RateLimiter struct {
	redis *redis.Client
	limit int // requests per second per IP
}

func NewRateLimiter(redisClient *redis.Client, rps int) *RateLimiter {
	return &RateLimiter{
		redis: redisClient,
		limit: rps,
	}
}

// Middleware returns a rate limiting gin.HandlerFunc.
// Uses a sliding 1-second window per IP address stored in Redis.
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		key := fmt.Sprintf("ratelimit:%s", ip)

		ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		defer cancel()

		// Run atomic Lua script — single round-trip, no race condition
		result, err := luaRateLimit.Run(ctx, rl.redis, []string{key}, rl.limit).Int64()
		if err != nil {
			// If Redis is unavailable, fail open: allow the request through.
			// Better to serve than to block all users when Redis is down.
			c.Next()
			return
		}

		count := result

		// Return rate limit info headers on every request
		remaining := rl.limit - int(count)
		if remaining < 0 {
			remaining = 0
		}
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", rl.limit))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
		c.Header("X-RateLimit-Reset", "1") // resets in ~1 second

		// Block if over limit
		if count > int64(rl.limit) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Rate limit exceeded",
				"limit":       rl.limit,
				"retry_after": 1,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
