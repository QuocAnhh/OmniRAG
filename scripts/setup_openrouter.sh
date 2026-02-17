#!/bin/bash
# OpenRouter Quick Setup Script
# Automates the setup process for OpenRouter integration

set -e

echo "🚀 OmniRAG - OpenRouter Setup"
echo "=============================="
echo ""

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "❌ Error: backend/.env not found"
    echo "📝 Creating from example..."
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env"
fi

# Prompt for API key
echo ""
echo "📋 Please enter your OpenRouter API key"
echo "   (Get one free at: https://openrouter.ai/keys)"
echo ""
read -p "API Key (sk-or-v1-...): " api_key

if [[ $api_key == sk-or-v1-* ]]; then
    # Update .env with API key
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$api_key|" backend/.env
    else
        # Linux
        sed -i "s|OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$api_key|" backend/.env
    fi
    echo "✅ API key saved to backend/.env"
else
    echo "⚠️  Warning: API key doesn't look valid (should start with sk-or-v1-)"
    echo "   You can update it manually in backend/.env"
fi

# Ask about model preferences
echo ""
echo "📋 Select chat model:"
echo "   1. openai/gpt-4o-mini (Recommended - Fast & Cheap)"
echo "   2. openai/gpt-4o (High Quality)"
echo "   3. anthropic/claude-3.5-sonnet (Best Reasoning)"
echo "   4. google/gemini-2.0-flash-exp:free (FREE)"
echo ""
read -p "Choice [1-4] (default: 1): " chat_choice

case $chat_choice in
    2)
        chat_model="openai/gpt-4o"
        ;;
    3)
        chat_model="anthropic/claude-3.5-sonnet"
        ;;
    4)
        chat_model="google/gemini-2.0-flash-exp:free"
        ;;
    *)
        chat_model="openai/gpt-4o-mini"
        ;;
esac

# Update chat model
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|OPENROUTER_CHAT_MODEL=.*|OPENROUTER_CHAT_MODEL=$chat_model|" backend/.env
else
    sed -i "s|OPENROUTER_CHAT_MODEL=.*|OPENROUTER_CHAT_MODEL=$chat_model|" backend/.env
fi

echo "✅ Chat model set to: $chat_model"

# Summary
echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Configuration Summary:"
echo "   API Key: ${api_key:0:20}..."
echo "   Chat Model: $chat_model"
echo "   Embedding Model: openai/text-embedding-3-small"
echo ""
echo "🎯 Next Steps:"
echo "   1. Start backend: cd backend && docker-compose up -d"
echo "   2. Test integration: python test_openrouter.py"
echo "   3. Check docs: OPENROUTER_MIGRATION.md"
echo ""
echo "🔗 Resources:"
echo "   - Dashboard: https://openrouter.ai/dashboard"
echo "   - Models: https://openrouter.ai/models"
echo "   - Docs: https://openrouter.ai/docs"
echo ""
