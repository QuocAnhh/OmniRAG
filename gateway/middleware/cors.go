package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORS returns a middleware that sets CORS headers for the given allowed origins.
//
// Using a specific origin allowlist (instead of "*") is required to support
// credentialed requests (Authorization: Bearer headers). Per the CORS spec,
// "Access-Control-Allow-Origin: *" combined with "Access-Control-Allow-Credentials: true"
// is invalid and modern browsers will block all such requests.
func CORS(allowedOrigins []string) gin.HandlerFunc {
	originSet := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		originSet[strings.ToLower(strings.TrimSpace(o))] = struct{}{}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if _, allowed := originSet[strings.ToLower(origin)]; allowed {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		c.Writer.Header().Set("Access-Control-Allow-Headers",
			"Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, Accept, Origin, Cache-Control, X-Requested-With, Pragma")
		c.Writer.Header().Set("Access-Control-Allow-Methods",
			"POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
