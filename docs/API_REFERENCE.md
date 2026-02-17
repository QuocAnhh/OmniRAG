# 📚 API Reference

Base URL: `http://localhost:8000/api/v1`

## Authentication

- `POST /auth/register` - Register a new tenant & user
- `POST /auth/login` - Login (returns JWT token)
- `GET /auth/me` - Get current user info

## Tenants

- `GET /tenants/me` - Get tenant info
- `PUT /tenants/me` - Update tenant settings

## Bots

- `POST /bots` - Create new bot
- `GET /bots` - List all bots
- `GET /bots/{id}` - Get bot details
- `PUT /bots/{id}` - Update bot configuration
- `DELETE /bots/{id}` - Delete bot

## Documents

- `POST /bots/{id}/documents` - Upload document (PDF/DOCX/PPTX/TXT)
- `GET /bots/{id}/documents` - List documents for a bot
- `DELETE /bots/{id}/documents/{doc_id}` - Delete a document

## Chat

- `POST /bots/{id}/chat` - Chat with a bot (RAG-powered)

---

## Interactive Documentation

Once the backend is running, you can access the full Swagger UI at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
