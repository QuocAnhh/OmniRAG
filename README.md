# OmniRAG 🤖

OmniRAG is a production-ready RAG (Retrieval-Augmented Generation) platform that lets you create, manage, and chat with AI agents grounded in your own data.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- API Key (OpenAI, OpenRouter, or MegaLLM)

### 1. Configure
```bash
cd backend
cp .env.example .env
# Edit .env with your API keys
```

### 2. Run
```bash
# Return to root
cd ..
docker compose up -d --build
```

### 3. Access
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001 (User/Pass: minioadmin/minioadmin)

## 📚 Documentation
Detailed guides are in the `docs/` folder:
- [Startup Guide](docs/STARTUP_GUIDE.md) - Detailed setup instructions.
- [Features](docs/FEATURES.md) - List of all capabilities.
- [Architecture](docs/ARCHITECTURE.md) - System design and components.
- [API Reference](docs/API_REFERENCE.md) - API endpoints overview.
- [Postman Guide](docs/POSTMAN_GUIDE.md) - How to test API workflows.
- [Advanced RAG](docs/ADVANCED_RAG_FEATURES.md) - Explanation of internal RAG logic.
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common fixes.

## 🛠️ Scripts
Helper scripts in `scripts/`:
- `validate_env.py`: Check environment variables.
- `test_full_system.py`: Run end-to-end API tests.

## License
MIT
