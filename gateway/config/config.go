package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	Port            string
	Environment     string
	
	// Backend
	PythonBackendURL string
	
	// JWT
	JWTSecret      string
	JWTExpiration  int
	
	// Redis
	RedisURL       string
	CacheTTL       int
	
	// Rate Limiting
	RateLimitEnabled bool
	RateLimitRPS     int
	
	// OpenRouter (passthrough)
	OpenRouterAPIKey string
}

var AppConfig *Config

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	// Load .env file if exists (for local development)
	_ = godotenv.Load()
	
	config := &Config{
		Port:             getEnv("GATEWAY_PORT", "8080"),
		Environment:      getEnv("ENVIRONMENT", "development"),
		PythonBackendURL: getEnv("PYTHON_BACKEND_URL", "http://backend:8000"),
		JWTSecret:        getEnv("JWT_SECRET", "your-secret-key-change-me"),
		JWTExpiration:    3600, // 1 hour
		RedisURL:         getEnv("REDIS_URL", "redis://redis:6379/0"),
		CacheTTL:         3600, // 1 hour
		RateLimitEnabled: getEnv("RATE_LIMIT_ENABLED", "true") == "true",
		RateLimitRPS:     100, // 100 requests per second per IP
		OpenRouterAPIKey: getEnv("OPENROUTER_API_KEY", ""),
	}
	
	AppConfig = config
	log.Printf("✅ Config loaded: Environment=%s, Port=%s, Backend=%s", 
		config.Environment, config.Port, config.PythonBackendURL)
	
	return config
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
