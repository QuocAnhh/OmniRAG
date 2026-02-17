# 🧪 Testing with Postman

## 1. Import Collection
Import the provided Postman collection JSON file (see `docs/POSTMAN_COLLECTION.json`).

## 2. Environment Setup
Create a new Environment in Postman with these variables:
- `base_url`: `http://localhost:8000`
- `access_token`: (Leave empty initially)
- `bot_id`: (Leave empty initially)

## 3. Workflow

### Step 1: Register User
**POST** `{{base_url}}/api/v1/auth/register`
```json
{
  "email": "admin@example.com",
  "password": "SecurePassword123!",
  "full_name": "Admin User",
  "tenant_name": "My Tenant"
}
```

### Step 2: Login
**POST** `{{base_url}}/api/v1/auth/login`
- Body (x-www-form-urlencoded):
  - `username`: admin@example.com
  - `password`: SecurePassword123!
- **Action**: Copy `access_token` from response to Environment variable `access_token`.

### Step 3: Create Bot
**POST** `{{base_url}}/api/v1/bots`
- Headers: `Authorization: Bearer {{access_token}}`
```json
{
  "name": "My RAG Bot",
  "config": {
    "llm_model": "gpt-4o-mini"
  }
}
```
- **Action**: Copy `id` to Environment variable `bot_id`.

### Step 4: Upload Document
**POST** `{{base_url}}/api/v1/bots/{{bot_id}}/documents`
- Body (form-data):
  - `file`: (Select file)
  - `chunking_strategy`: `recursive`

### Step 5: Chat
**POST** `{{base_url}}/api/v1/bots/{{bot_id}}/chat`
```json
{
  "message": "What is in the document?"
}
```
