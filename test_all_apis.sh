#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:8000/api/v1"
TOKEN=""
TENANT_ID=""
BOT_ID=""
USER_ID=""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}OmniRAG API Testing - All Endpoints${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo -e "  Method: $method"
    echo -e "  Endpoint: $endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d "$data")
    else
        response=$(curl -s -X "$method" "$API_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN")
    fi
    
    # Check if response is valid JSON
    if echo "$response" | jq . > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Success${NC}"
        echo "$response" | jq '.' | head -20
    else
        echo -e "${RED}✗ Failed${NC}"
        echo "$response" | head -10
    fi
    echo ""
}

# ============= AUTHENTICATION TESTS (OLD) =============
echo -e "${BLUE}=== AUTHENTICATION TESTS (OLD) ===${NC}\n"

echo -e "${YELLOW}1. Register User${NC}"
register_response=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test_'$(date +%s)'@example.com",
        "password": "TestPassword123!",
        "full_name": "Test User",
        "tenant_name": "Test Tenant"
    }')

if echo "$register_response" | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Register Success${NC}"
    echo "$register_response" | jq '.'
    USER_ID=$(echo "$register_response" | jq -r '.user.id')
    TENANT_ID=$(echo "$register_response" | jq -r '.user.tenant_id')
else
    echo -e "${RED}✗ Register Failed${NC}"
    echo "$register_response"
fi
echo ""

echo -e "${YELLOW}2. Login User${NC}"
login_response=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=test_$(date +%s -d '1 second ago')@example.com&password=TestPassword123!")

if echo "$login_response" | jq . > /dev/null 2>&1; then
    TOKEN=$(echo "$login_response" | jq -r '.access_token // empty')
    if [ -z "$TOKEN" ]; then
        echo -e "${YELLOW}Note: Need to use registered email. Using register response token...${NC}"
        TOKEN=$(echo "$register_response" | jq -r '.access_token // empty')
    fi
    echo -e "${GREEN}✓ Login Success${NC}"
    echo "Token: ${TOKEN:0:20}..."
else
    echo -e "${YELLOW}⚠ Login with new user failed, will use register token${NC}"
    TOKEN=$(echo "$register_response" | jq -r '.access_token // empty')
fi
echo ""

if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗ Cannot get auth token. Stopping tests.${NC}"
    exit 1
fi

# ============= TENANTS TESTS (OLD) =============
echo -e "${BLUE}=== TENANTS TESTS (OLD) ===${NC}\n"

test_endpoint "GET" "/tenants/me" "" "Get Current Tenant"

# ============= BOTS TESTS (OLD) =============
echo -e "${BLUE}=== BOTS TESTS (OLD) ===${NC}\n"

echo -e "${YELLOW}1. Create Bot${NC}"
create_bot=$(curl -s -X POST "$API_URL/bots" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "name": "Test Bot",
        "description": "Testing bot",
        "config": {
            "llm_model": "gpt-3.5-turbo",
            "temperature": 0.7,
            "max_tokens": 500
        }
    }')

if echo "$create_bot" | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Create Bot Success${NC}"
    echo "$create_bot" | jq '.'
    BOT_ID=$(echo "$create_bot" | jq -r '.id // empty')
else
    echo -e "${RED}✗ Create Bot Failed${NC}"
    echo "$create_bot"
fi
echo ""

if [ -n "$BOT_ID" ]; then
    test_endpoint "GET" "/bots" "" "List Bots"
    test_endpoint "GET" "/bots/$BOT_ID" "" "Get Bot Details"
    test_endpoint "PUT" "/bots/$BOT_ID" '{
        "name": "Updated Test Bot",
        "description": "Updated description"
    }' "Update Bot"
fi

# ============= DOCUMENTS TESTS (OLD) =============
echo -e "${BLUE}=== DOCUMENTS TESTS (OLD) ===${NC}\n"

if [ -n "$BOT_ID" ]; then
    test_endpoint "GET" "/bots/$BOT_ID/documents" "" "List Documents"
fi

# ============= CHAT TESTS (OLD) =============
echo -e "${BLUE}=== CHAT TESTS (OLD) ===${NC}\n"

if [ -n "$BOT_ID" ]; then
    test_endpoint "POST" "/bots/$BOT_ID/chat" '{
        "message": "Hello, what can you do?",
        "history": [],
        "session_id": "'$(uuidgen)'"
    }' "Chat with Bot"
fi

# ============= DATA GRID TESTS (OLD) =============
echo -e "${BLUE}=== DATA GRID TESTS (OLD) ===${NC}\n"

test_endpoint "GET" "/data-grid/postgres/users" "" "List Users (Data Grid)"
test_endpoint "GET" "/data-grid/postgres/tenants" "" "List Tenants (Data Grid)"
test_endpoint "GET" "/data-grid/postgres/bots" "" "List Bots (Data Grid)"
test_endpoint "GET" "/data-grid/postgres/documents" "" "List Documents (Data Grid)"

# ============= DASHBOARD TESTS (NEW) =============
echo -e "${BLUE}=== DASHBOARD TESTS (NEW) ===${NC}\n"

test_endpoint "GET" "/dashboard/stats" "" "Get Dashboard Stats"
test_endpoint "GET" "/dashboard/quick-stats" "" "Get Quick Stats"
test_endpoint "GET" "/dashboard/activity" "" "Get Dashboard Activity"

# ============= ANALYTICS TESTS (NEW) =============
echo -e "${BLUE}=== ANALYTICS TESTS (NEW) ===${NC}\n"

test_endpoint "GET" "/analytics/stats" "" "Get Analytics Stats"
test_endpoint "GET" "/analytics/conversations?limit=5" "" "Get Recent Conversations"
test_endpoint "GET" "/analytics/messages-over-time?period=7d" "" "Get Messages Over Time"
test_endpoint "GET" "/analytics/bot-usage" "" "Get Bot Usage Stats"

# ============= USERS TESTS (NEW) =============
echo -e "${BLUE}=== USERS TESTS (NEW) ===${NC}\n"

test_endpoint "GET" "/users/me" "" "Get Current User Profile"

test_endpoint "PUT" "/users/me" '{
    "full_name": "Updated Test User",
    "email": "updated_'$(date +%s)'@example.com"
}' "Update User Profile"

echo -e "${YELLOW}3. Create API Key${NC}"
create_key=$(curl -s -X POST "$API_URL/users/me/api-keys" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "name": "Test API Key",
        "description": "Key for testing"
    }')

if echo "$create_key" | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Create API Key Success${NC}"
    echo "$create_key" | jq '.'
    API_KEY_ID=$(echo "$create_key" | jq -r '.id // empty')
else
    echo -e "${RED}✗ Create API Key Failed${NC}"
    echo "$create_key"
fi
echo ""

test_endpoint "GET" "/users/me/api-keys" "" "List API Keys"

if [ -n "$API_KEY_ID" ]; then
    test_endpoint "PATCH" "/users/me/api-keys/$API_KEY_ID/toggle" "" "Toggle API Key"
    test_endpoint "DELETE" "/users/me/api-keys/$API_KEY_ID" "" "Delete API Key"
fi

# ============= INTEGRATIONS TESTS (NEW) =============
echo -e "${BLUE}=== INTEGRATIONS TESTS (NEW) ===${NC}\n"

if [ -n "$BOT_ID" ]; then
    echo -e "${YELLOW}1. Create Integration${NC}"
    create_integration=$(curl -s -X POST "$API_URL/integrations" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "bot_id": "'$BOT_ID'",
            "type": "api",
            "name": "Test API Integration",
            "config": {
                "webhook_url": "https://example.com/webhook"
            }
        }')

    if echo "$create_integration" | jq . > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Create Integration Success${NC}"
        echo "$create_integration" | jq '.'
        INTEGRATION_ID=$(echo "$create_integration" | jq -r '.id // empty')
    else
        echo -e "${RED}✗ Create Integration Failed${NC}"
        echo "$create_integration"
    fi
    echo ""

    test_endpoint "GET" "/integrations?bot_id=$BOT_ID" "" "List Integrations"

    if [ -n "$INTEGRATION_ID" ]; then
        test_endpoint "GET" "/integrations/$INTEGRATION_ID" "" "Get Integration Details"
        test_endpoint "PUT" "/integrations/$INTEGRATION_ID" '{
            "name": "Updated Integration"
        }' "Update Integration"
        test_endpoint "POST" "/integrations/$INTEGRATION_ID/test" "" "Test Integration"
        test_endpoint "DELETE" "/integrations/$INTEGRATION_ID" "" "Delete Integration"
    fi
fi

# ============= SUMMARY =============
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Testing Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "\n${YELLOW}Summary:${NC}"
echo -e "  • User ID: $USER_ID"
echo -e "  • Tenant ID: $TENANT_ID"
echo -e "  • Bot ID: $BOT_ID"
echo -e "  • Token: ${TOKEN:0:20}..."
echo ""
echo -e "${GREEN}✓ All endpoint tests completed!${NC}"
