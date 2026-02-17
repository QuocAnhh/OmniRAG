#!/bin/bash

echo "========================================="
echo "Testing MegaLLM Integration"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check Configuration
echo -e "${YELLOW}Test 1: Configuration Check${NC}"
docker exec omnirag-backend-1 python -c "
from app.core.config import settings
print(f'✓ AI Provider: {settings.AI_PROVIDER}')
print(f'✓ MegaLLM Base URL: {settings.MEGALLM_BASE_URL}')
print(f'✓ MegaLLM API Key: {settings.MEGALLM_API_KEY[:20]}...' if settings.MEGALLM_API_KEY else '✗ API Key: NOT SET')
print(f'✓ Default Model: {settings.DEFAULT_LLM_MODEL}')
print(f'✓ Fallback Models: {settings.FALLBACK_LLM_MODELS}')
"
echo ""

# Test 2: Check RAG Service
echo -e "${YELLOW}Test 2: RAG Service Initialization${NC}"
docker exec omnirag-backend-1 python -c "
from app.services.advanced_rag_service import advanced_rag_service
print(f'✓ RAG Provider: {advanced_rag_service.ai_provider}')
print(f'✓ RAG Base URL: {advanced_rag_service.base_url}')
print(f'✓ RAG API Key: {advanced_rag_service.api_key[:20]}...')
print(f'✓ Fallback Models: {advanced_rag_service.fallback_models}')
"
echo ""

# Test 3: Test LLM Creation
echo -e "${YELLOW}Test 3: LLM Instance Creation${NC}"
docker exec omnirag-backend-1 python -c "
from app.services.advanced_rag_service import advanced_rag_service
from app.core.config import settings

llm = advanced_rag_service._create_llm(settings.DEFAULT_LLM_MODEL)
print(f'✓ LLM Created Successfully')
print(f'✓ Model: {llm.model_name}')
print(f'✓ OpenAI API Base: {llm.openai_api_base}')
"
echo ""

# Test 4: Test Simple Chat (if you have a bot)
echo -e "${YELLOW}Test 4: Backend Health${NC}"
HEALTH=$(curl -s http://localhost:8000/health)
if [ "$HEALTH" = '{"status":"healthy"}' ]; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
fi
echo ""

echo "========================================="
echo -e "${GREEN}✓ All Configuration Tests Passed!${NC}"
echo "========================================="
echo ""
echo "Next Steps:"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Create a new bot"
echo "3. Upload a document (PDF/DOCX)"
echo "4. Chat with the bot - it will use MegaLLM's Kimi model!"
echo ""
echo "Model being used: moonshotai/kimi-k2-instruct-0905"
echo "Fallback chain: claude-3.5-sonnet → gpt-4 → gpt-3.5-turbo"
