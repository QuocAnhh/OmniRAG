package config

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all gateway configuration loaded from environment variables.
type Config struct {
	// Server
	Port        string
	Environment string

	// CORS
	CORSAllowedOrigins []string

	// Backend
	PythonBackendURL string

	// JWT
	JWTSecret     string
	JWTExpiration int // seconds

	// Redis
	RedisURL string
	CacheTTL int // seconds

	// Rate Limiting
	RateLimitEnabled bool
	RateLimitRPS     int

	// OpenRouter (passthrough)
	OpenRouterAPIKey string
}

// LoadConfig loads configuration from environment variables.
// Returns a non-nil error if required production values are missing or invalid.
func LoadConfig() (*Config, error) {
	// Load .env file if present (local development). Ignore "file not found".
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		log.Printf("⚠️  Warning: could not parse .env file: %v", err)
	}

	env := getEnv("ENVIRONMENT", "development")

	jwtSecret := getEnv("JWT_SECRET", "")
	if jwtSecret == "" || jwtSecret == "your-secret-key-change-me" {
		if env == "production" {
			return nil, fmt.Errorf("JWT_SECRET must be set to a strong secret in production")
		}
		jwtSecret = "dev-secret-not-for-production"
		log.Println("⚠️  JWT_SECRET not set — using insecure dev default (not for production)")
	}

	rawOrigins := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
	allowedOrigins := make([]string, 0)
	for _, o := range strings.Split(rawOrigins, ",") {
		if trimmed := strings.TrimSpace(o); trimmed != "" {
			allowedOrigins = append(allowedOrigins, trimmed)
		}
	}

	cfg := &Config{
		Port:               getEnv("GATEWAY_PORT", "8080"),
		Environment:        env,
		CORSAllowedOrigins: allowedOrigins,
		PythonBackendURL:   getEnv("PYTHON_BACKEND_URL", "http://backend:8000"),
		JWTSecret:          jwtSecret,
		JWTExpiration:      getEnvInt("JWT_EXPIRATION", 3600),
		RedisURL:           getEnv("REDIS_URL", "redis://redis:6379/0"),
		CacheTTL:           getEnvInt("CACHE_TTL", 3600),
		RateLimitEnabled:   getEnv("RATE_LIMIT_ENABLED", "true") == "true",
		RateLimitRPS:       getEnvInt("RATE_LIMIT_RPS", 100),
		OpenRouterAPIKey:   getEnv("OPENROUTER_API_KEY", ""),
	}

	log.Printf("✅ Config loaded: Environment=%s, Port=%s, Backend=%s",
		cfg.Environment, cfg.Port, cfg.PythonBackendURL)

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultValue
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		log.Printf("⚠️  Invalid integer value for %s=%q, using default %d", key, v, defaultValue)
		return defaultValue
	}
	return n
}
