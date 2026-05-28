# Frontend Integration

Tài liệu này là integration map của frontend hiện tại, không phải scaffold guide.

## Stack

| Mục | Hiện tại |
| --- | --- |
| Framework | React 19 |
| Router | React Router 7 |
| State | Zustand |
| Styling | Tailwind CSS 4 |
| Build | Vite |
| API client | Axios + native `fetch` cho stream |

## Runtime config

`frontend/src/utils/constants.ts` đọc:

```ts
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
```

Docker Compose set:

```env
VITE_API_URL=http://localhost:8080
```

Vì vậy API client sẽ gọi gateway:

```text
http://localhost:8080/api/v1/...
```

Nếu muốn bypass gateway khi chạy Docker, set `VITE_API_URL=http://localhost:8001`. Khi backend chạy local uvicorn, dùng `http://localhost:8000`.

## Routes thật trong app

Nguồn đối chiếu: `frontend/src/App.tsx`.

| Route | Access | Page |
| --- | --- | --- |
| `/` | public | Landing page |
| `/auth` | public | Login/register |
| `/docs/zalo-bot` | public | Zalo Bot guide page |
| `/dashboard` | protected | Dashboard |
| `/bots` | protected | Bot list |
| `/bots/new` | protected | Bot wizard |
| `/bots/:id/edit` | protected | Bot config |
| `/bots/:id/config` | protected | Bot config |
| `/bots/:id/chat` | protected | Chat |
| `/bots/:id/graph` | protected | Knowledge Graph |
| `/bots/:id/zalo-accounts` | protected | Zalo Personal accounts |
| `/bots/:id` | protected redirect | Redirect to `chat` |
| `/settings` | protected | Settings |

Không dùng route frontend `/bots/:id/knowledge-graph`. Backend API vẫn là `/api/v1/bots/{bot_id}/knowledge-graph`.

## Auth flow

- `authStore` lưu token trong `localStorage`.
- `apiClient` tự gắn `Authorization: Bearer <token>`.
- Response interceptor xóa auth state và redirect về `/auth` khi nhận `401`.
- `ProtectedRoute` chờ `initializeAuth()` trước khi render để tránh flash redirect.

## API clients

| Client | Backend routes |
| --- | --- |
| `auth.ts` | `/api/v1/auth/login`, `/register`, `/me` |
| `dashboard.ts` | `/api/v1/dashboard/stats`, `/quick-stats`, `/activity` |
| `analytics.ts` | `/api/v1/analytics/*` |
| `bots.ts` | `/api/v1/bots/*`, graph, memory, prompt generation |
| `chat.ts` | chat, chat-stream, history, sessions, feedback, debug retrieval |
| `documents.ts` | bot document list/upload/delete plus known gap calls |
| `botTemplates.ts` | `/api/v1/bot-templates/*` |
| `tenants.ts` | `/api/v1/tenants/me` |
| `users.ts` | `/api/v1/users/me` và API keys |
| `integrations.ts` | `/api/v1/integrations/*` |
| `channelAccounts.ts` | `/api/v1/channels/zalo-personal/*` |
| `retrieval.ts` | `/api/v1/bots/{bot_id}/retrieve` |
| `folders.ts` | intended folders API, xem known gaps |

## Streaming chat

`frontend/src/api/chat.ts` dùng native `fetch` cho:

```text
POST /api/v1/bots/{bot_id}/chat-stream
```

Gateway hỗ trợ long-lived SSE bằng `WriteTimeout=0` và stream client riêng. Gateway không cache stream.

## Known gaps frontend/backend

Không sửa code trong đợt docs refresh này, nhưng cần ghi nhận để tránh document nhầm:

- `documents.ts` có `PUT /api/v1/bots/{bot_id}/documents/{doc_id}` và `GET /api/v1/bots/{bot_id}/documents/{doc_id}/preview`, nhưng backend snapshot này chưa có endpoint tương ứng.
- `folders.ts` đang gọi `/folders/*` không có prefix `/api/v1`, trong khi backend router nằm dưới `/api/v1/folders/*`. Nếu UI folder gặp 404 qua gateway, đây là điểm cần sửa code ở đợt riêng.
- `frontend/src/utils/constants.ts` còn một số route constant legacy như `/login`, `/analytics`, `/integrations`, nhưng router thật trong `App.tsx` mới là nguồn đúng.

## Integration checklist cho dev

1. Chạy stack bằng Docker.
2. Mở `http://localhost:5173`.
3. Đăng ký/đăng nhập qua `/auth`.
4. Xác nhận frontend gọi gateway `http://localhost:8080`.
5. Test `/dashboard`, `/bots`, `/bots/:id/chat`, `/bots/:id/graph`.
6. Nếu bật Zalo Personal, test `/bots/:id/zalo-accounts` với `VITE_ENABLE_ZALO_PERSONAL=true`.
7. Nếu upload tài liệu xong nhưng chat chưa thấy context, kiểm tra `celery_worker`.
8. Nếu graph page 404, kiểm tra route UI là `/bots/:id/graph`.
