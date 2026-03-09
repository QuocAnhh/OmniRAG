package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadConfig_Defaults(t *testing.T) {
	clearEnv()

	cfg, err := LoadConfig()
	require.NoError(t, err)

	assert.Equal(t, "8080", cfg.Port)
	assert.Equal(t, "development", cfg.Environment)
	assert.Equal(t, "http://backend:8000", cfg.PythonBackendURL)
	assert.Equal(t, 3600, cfg.JWTExpiration)
	assert.Equal(t, "redis://redis:6379/0", cfg.RedisURL)
	assert.Equal(t, 3600, cfg.CacheTTL)
	assert.True(t, cfg.RateLimitEnabled)
	assert.Equal(t, 100, cfg.RateLimitRPS)
	assert.Equal(t, "dev-secret-not-for-production", cfg.JWTSecret)
}

func TestLoadConfig_EnvOverride(t *testing.T) {
	clearEnv()
	t.Setenv("GATEWAY_PORT", "9090")
	t.Setenv("ENVIRONMENT", "staging")
	t.Setenv("PYTHON_BACKEND_URL", "http://mybackend:8000")
	t.Setenv("JWT_SECRET", "my-strong-secret")
	t.Setenv("JWT_EXPIRATION", "7200")
	t.Setenv("REDIS_URL", "redis://myredis:6379/1")
	t.Setenv("CACHE_TTL", "600")
	t.Setenv("RATE_LIMIT_ENABLED", "false")
	t.Setenv("RATE_LIMIT_RPS", "50")

	cfg, err := LoadConfig()
	require.NoError(t, err)

	assert.Equal(t, "9090", cfg.Port)
	assert.Equal(t, "staging", cfg.Environment)
	assert.Equal(t, "http://mybackend:8000", cfg.PythonBackendURL)
	assert.Equal(t, "my-strong-secret", cfg.JWTSecret)
	assert.Equal(t, 7200, cfg.JWTExpiration)
	assert.Equal(t, "redis://myredis:6379/1", cfg.RedisURL)
	assert.Equal(t, 600, cfg.CacheTTL)
	assert.False(t, cfg.RateLimitEnabled)
	assert.Equal(t, 50, cfg.RateLimitRPS)
}

func TestLoadConfig_CORSAllowedOrigins(t *testing.T) {
	clearEnv()
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com, https://admin.example.com")

	cfg, err := LoadConfig()
	require.NoError(t, err)

	assert.Equal(t, []string{"https://app.example.com", "https://admin.example.com"}, cfg.CORSAllowedOrigins)
}

func TestLoadConfig_CORSDefaultOrigins(t *testing.T) {
	clearEnv()

	cfg, err := LoadConfig()
	require.NoError(t, err)

	assert.Contains(t, cfg.CORSAllowedOrigins, "http://localhost:5173")
	assert.Contains(t, cfg.CORSAllowedOrigins, "http://localhost:3000")
}

func TestLoadConfig_ProductionRejectsDefaultJWTSecret(t *testing.T) {
	clearEnv()
	t.Setenv("ENVIRONMENT", "production")
	// JWT_SECRET deliberately not set

	_, err := LoadConfig()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_SECRET")
}

func TestLoadConfig_ProductionRejectsPlaceholderJWTSecret(t *testing.T) {
	clearEnv()
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("JWT_SECRET", "your-secret-key-change-me")

	_, err := LoadConfig()
	assert.Error(t, err)
}

func TestGetEnvInt_InvalidFallsBackToDefault(t *testing.T) {
	t.Setenv("TEST_INT_KEY", "not-a-number")
	result := getEnvInt("TEST_INT_KEY", 42)
	assert.Equal(t, 42, result)
}

func TestGetEnvInt_ValidParsed(t *testing.T) {
	t.Setenv("TEST_INT_KEY2", "99")
	result := getEnvInt("TEST_INT_KEY2", 42)
	assert.Equal(t, 99, result)
}

// clearEnv unsets all environment variables that LoadConfig reads so tests
// do not interfere with each other.
func clearEnv() {
	keys := []string{
		"GATEWAY_PORT", "ENVIRONMENT", "CORS_ALLOWED_ORIGINS",
		"PYTHON_BACKEND_URL", "JWT_SECRET", "JWT_EXPIRATION",
		"REDIS_URL", "CACHE_TTL", "RATE_LIMIT_ENABLED", "RATE_LIMIT_RPS",
		"OPENROUTER_API_KEY",
	}
	for _, k := range keys {
		os.Unsetenv(k)
	}
}
