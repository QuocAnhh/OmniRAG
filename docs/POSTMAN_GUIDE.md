# Postman Guide

Guide này dùng collection `docs/POSTMAN_COLLECTION.json` để test API hiện tại.

## Environment variables

Tạo Postman environment:

| Variable | Default |
| --- | --- |
| `base_url` | `http://localhost:8080` |
| `access_token` | để trống |
| `bot_id` | để trống |
| `doc_id` | để trống nếu cần delete document |

`base_url` mặc định là gateway. Nếu muốn bypass gateway:

- Docker direct backend: `http://localhost:8001`
- Local uvicorn: `http://localhost:8000`

## Workflow nhanh

### 1. Register

```http
POST {{base_url}}/api/v1/auth/register
Content-Type: application/json
```

```json
{
  "email": "admin@example.com",
  "password": "SecurePassword123!",
  "full_name": "Admin User",
  "tenant_name": "My Tenant"
}
```

### 2. Login

```http
POST {{base_url}}/api/v1/auth/login
Content-Type: application/x-www-form-urlencoded
```

Form fields:

```text
username=admin@example.com
password=SecurePassword123!
```

Lưu `access_token` vào environment. Collection đã có Bearer auth ở cấp collection.

### 3. Create Bot

```http
POST {{base_url}}/api/v1/bots/
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{
  "name": "My RAG Bot",
  "description": "Bot test bằng Postman",
  "config": {
    "model": "openai/gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 1000,
    "system_prompt": "Trả lời bằng tiếng Việt.",
    "chunking_strategy": "recursive"
  }
}
```

Lưu `id` từ response vào `bot_id`.

### 4. Upload Document

```http
POST {{base_url}}/api/v1/bots/{{bot_id}}/documents
Authorization: Bearer {{access_token}}
Content-Type: multipart/form-data
```

Form-data:

| Key | Type | Value |
| --- | --- | --- |
| `file` | File | Chọn `.pdf`, `.txt`, `.md`, `.csv`, `.docx`, `.pptx`, `.xlsx` |
| `chunking_strategy` | Text | `recursive` |
| `enable_knowledge_graph` | Text | `false` |

Ingestion chạy bất đồng bộ qua Celery. Nếu upload xong nhưng chat chưa thấy context, kiểm tra log `celery_worker`.

Legacy `.doc`, `.ppt`, `.xls` bị chặn bằng `415`; convert sang `.docx`, `.pptx`, `.xlsx` trước khi upload.

### 5. Chat

```http
POST {{base_url}}/api/v1/bots/{{bot_id}}/chat
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

```json
{
  "message": "Tóm tắt nội dung tài liệu",
  "session_id": "postman-demo"
}
```

## Notes

- Backend host port Docker là `8001`, không phải `8000`.
- Gateway cache chỉ áp dụng cho `GET`, không dùng để test cache chat.
- Không có endpoint document update/preview trong backend snapshot này.
