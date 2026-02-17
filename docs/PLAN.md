BÁO CÁO CHI TIẾT ĐỒ ÁN: OMNIRAG - NỀN TẢNG CHATBOT THÔNG MINH ĐA KÊNH
I. TỔNG QUAN ĐỒ ÁN
Tên đồ án: OmniRAG - Multi-channel RAG Chatbot Platform
Mô tả:
Nền tảng SaaS cho phép doanh nghiệp và cá nhân tạo chatbot thông minh với kiến thức riêng (từ tài liệu nội bộ) và triển khai dễ dàng lên nhiều kênh (website, Telegram, Zalo, API, v.v.) mà không cần kiến thức lập trình.

Bài toán giải quyết:
Doanh nghiệp cần chatbot hiểu biết về sản phẩm/dịch vụ riêng

Khó khăn kỹ thuật trong việc tích hợp AI vào các kênh có sẵn

Chi phí cao khi thuê team AI/ML xây dựng từ đầu

Muốn có analytics tập trung cho chatbot trên mọi kênh

Giải pháp:
No-code Interface: Giao diện kéo thả để cấu hình chatbot

RAG Engine: Trích xuất thông tin từ tài liệu riêng

Multi-channel Adapters: Tích hợp với 5+ kênh phổ biến

Unified Management: Quản lý tập trung từ một dashboard

II. KIẾN TRÚC HỆ THỐNG
2.1 High-level Architecture
text
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Channels                               │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│   Web       │  Telegram   │    Zalo     │   REST API  │   Slack     │
│   Widget    │    Bot      │    OA       │             │   App       │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘
       │             │             │             │             │
┌──────▼─────────────▼─────────────▼─────────────▼─────────────▼──────┐
│                    Channel Gateway Layer                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ WebSocket│ │Telegram  │ │ Zalo     │ │ HTTP     │ │ Slack    │  │
│  │ Handler  │ │ Webhook  │ │ Webhook  │ │ Router   │ │ Bolt     │  │
│  │          │ │ Handler  │ │ Handler  │ │          │ │ Handler  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│                     API Gateway & Load Balancer                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Authentication │ Rate Limiting │ Request Routing │ Logging  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│                     Core Services Layer                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   Chat Service  │  │  Doc Processing │  │   Tenant        │     │
│  │   - RAG Engine  │  │  Service        │  │   Management    │     │
│  │   - LLM Proxy   │  │  - OCR/Extract  │  │   Service       │     │
│  │   - Cache       │  │  - Embedding    │  │                 │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│                     Data Storage Layer                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐    │
│  │ PostgreSQL   │ │   MongoDB    │ │   Vector Database        │    │
│  │ - Tenants    │ │ - Chat Logs  │ │   (Qdrant/Chroma)        │    │
│  │ - Users      │ │ - Analytics  │ │   - Tenant Collections   │    │
│  │ - Bots       │ │ - Documents  │ │   - Document Vectors     │    │
│  │ - Configs    │ │   Metadata   │ │                          │    │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘    │
│  ┌──────────────┐ ┌──────────────┐                                  │
│  │   Redis      │ │   MinIO/S3   │                                  │
│  │ - Cache      │ │ - File Store │                                  │
│  │ - Sessions   │ │ - Documents  │                                  │
│  │ - Rate Limiting│              │                                  │
│  └──────────────┘ └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
2.2 Component Details
A. Channel Gateway Layer
Web Widget Handler: Xử lý iframe/WebSocket từ website khách

Telegram Webhook Handler: Nhận update từ Telegram Bot API

Zalo Webhook Handler: Xử lý callback từ Zalo OA

REST API Handler: API endpoints cho developer

Slack Bolt Handler: Xử lý Slack Events API

B. Core Services
Chat Service:

RAG pipeline (retrieval + generation)

LLM integration (OpenAI/Anthropic/Local LLM)

Context management

Response caching

Document Processing Service:

File upload & validation

Text extraction (PDF, DOCX, PPTX, HTML, TXT)

Chunking & cleaning

Embedding generation

Vector storage indexing

Tenant Management Service:

Multi-tenancy isolation

Bot configuration management

Usage tracking & billing

API key management

C. Background Workers
Document Processing Worker: Async document ingestion

Embedding Worker: Batch embedding generation

Web Crawler Worker: Crawl website content

Analytics Worker: Process chat logs for insights

III. TÍNH NĂNG CỐT LÕI
3.1 Cho End-users (Người dùng chatbot)
Real-time Chat: Giao diện chat trực quan

File Upload: Gửi file để bot xử lý

Citation & Sources: Xem nguồn thông tin

Conversation History: Lưu lịch sử trò chuyện

Feedback: Đánh giá câu trả lời (thumbs up/down)

3.2 Cho Admin (Người quản lý bot)
A. Bot Management Dashboard
Bot Creation & Configuration:

Tên bot, avatar, mô tả

Welcome message, fallback message

Temperature, max tokens, stop sequences

Prompt templates customization

Knowledge Base Management:

Upload documents (PDF, DOCX, TXT, HTML)

Web crawling từ URLs

Chỉnh sửa/delete documents

Re-index documents

Preview document content

Channel Integration:

Website Widget: Copy-paste JavaScript code

Telegram: Nhập bot token, tự động setup webhook

Zalo: OA connection wizard

REST API: Generate API keys, download SDK

Slack: OAuth app installation guide

Advanced Settings:

Blacklist/Whitelist domains

Sensitive data filtering

Custom stop words

Response moderation

B. Analytics & Monitoring
Usage Analytics:

Số lượng tin nhắn theo thời gian

Active users, sessions

Response time metrics (p50, p95, p99)

Error rate monitoring

Conversation Analytics:

Most common questions

Failed questions (low confidence)

User feedback statistics

Conversation flow heatmap

Knowledge Base Analytics:

Most retrieved documents/chunks

Missing knowledge gaps

Document effectiveness score

3.3 Cho Platform Owner
Multi-tenancy Management:

Tenant onboarding/offboarding

Resource allocation per tenant

Billing & subscription management

Usage quota enforcement

System Monitoring:

Health checks cho tất cả services

Performance monitoring

Cost tracking (LLM API calls)

Alerting system

IV. FLOW TRIỂN KHAI CHO KHÁCH HÀNG
4.1 Onboarding Flow
text
1. ĐĂNG KÝ TÀI KHOẢN
   ↓
2. TẠO BOT MỚI
   ├─ Đặt tên bot
   ├─ Upload logo/avatar
   ├─ Cấu hình personality
   ↓
3. THÊM KIẾN THỨC
   ├─ Upload tài liệu (PDF, DOCX, v.v.)
   ├─ Thêm website URLs để crawl
   ├─ Chỉnh sửa nội dung nếu cần
   ↓
4. CẤU HÌNH BOT
   ├─ Chọn LLM (GPT-4, Claude, local LLM)
   ├─ Đặt parameters (temp, max_tokens)
   ├─ Tùy chỉnh prompt template
   ↓
5. TÍCH HỢP KÊNH
   ├─ Website: Copy JavaScript snippet
   ├─ Telegram: Nhập bot token → tự động setup
   ├─ Zalo: Kết nối OA qua OAuth
   ├─ API: Lấy API key & docs
   ↓
6. TEST & PUBLISH
   ├─ Test bot trong sandbox
   ├─ Xem preview trên các kênh
   ├─ Publish bot
   ↓
7. MONITOR & OPTIMIZE
   ├─ Xem analytics dashboard
   ├─ Thêm/training tài liệu mới
   ├─ Tối ưu prompt dựa trên feedback
4.2 Real-time Chat Flow
text
Người dùng gửi tin nhắn → Channel Gateway nhận
     ↓
Xác thực & định tuyến đến đúng bot
     ↓
Chat Service xử lý:
    1. Preprocess query
    2. Search vector DB → top_k relevant chunks
    3. Construct context + query
    4. Call LLM với context
    5. Post-process response
    6. Log conversation
     ↓
Trả response về channel tương ứng
4.3 Document Processing Flow
text
Upload document → Store in MinIO/S3
     ↓
Document Processing Service:
    1. Detect file type
    2. Extract text (PyPDF2, python-docx, v.v.)
    3. Clean text (remove headers, footers)
    4. Chunk text (overlapping chunks)
    5. Generate embeddings
    6. Store in Vector DB
     ↓
Update bot knowledge base status
V. TECH STACK CHI TIẾT
5.1 Backend Services
API Framework: FastAPI (Python) - async, auto-docs, high performance

Task Queue: Celery + Redis (background jobs)

API Gateway: Traefik / Nginx

Authentication: JWT, OAuth 2.0

WebSockets: WebSocket for real-time chat

5.2 AI/ML Stack
RAG Framework: LangChain / LlamaIndex

Embedding Models:

Local: sentence-transformers/all-MiniLM-L6-v2

Cloud: OpenAI text-embedding-3-small

LLM Options:

Cloud: OpenAI GPT-4/3.5, Anthropic Claude

Local: Llama 2/3, Mistral (via Ollama/vLLM)

Vector Database: Qdrant (production-ready) / Chroma (dev)

OCR: Tesseract, PaddleOCR (cho ảnh/PDF scan)

5.3 Databases
PostgreSQL:

Schema: tenants, users, bots, configurations

Extensions: pgvector (alternative vector storage)

MongoDB:

Chat logs, analytics events, unstructured data

Redis:

Cache, session storage, rate limiting, Celery broker

MinIO/S3:

Document storage, file uploads

5.4 Frontend
Admin Dashboard: React + TypeScript + Vite

UI Library: Ant Design / Material-UI + TailwindCSS

State Management: Redux Toolkit / Zustand

Real-time: Socket.io Client

Charting: Recharts / Chart.js

Web Widget: Vanilla JS + Web Components

5.5 DevOps & Deployment
Containerization: Docker

Orchestration: Docker Compose (dev), Kubernetes (prod)

CI/CD: GitHub Actions / GitLab CI

Monitoring:

Metrics: Prometheus + Grafana

Logs: ELK Stack / Loki

Tracing: Jaeger

Reverse Proxy: Nginx + Let's Encrypt

5.6 Third-party Integrations
Telegram: python-telegram-bot / aiogram

Zalo: Zalo OA API SDK

Slack: Slack Bolt SDK

Facebook: Facebook Graph API

Payment: Stripe / PayPal (cho subscription)

VI. DATABASE SCHEMA CHÍNH
6.1 PostgreSQL Schema
sql
-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bots table
CREATE TABLE bots (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    api_key VARCHAR(64) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    bot_id UUID REFERENCES bots(id),
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'processing',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);
6.2 MongoDB Collections
chat_logs: {session_id, bot_id, messages, timestamp, feedback}

analytics_events: {event_type, bot_id, metadata, timestamp}

user_sessions: {session_id, user_info, channel, started_at}

VII. API DESIGN
7.1 Core Endpoints
text
GET    /api/v1/bots                 # List bots
POST   /api/v1/bots                 # Create bot
GET    /api/v1/bots/{id}           # Get bot details
PUT    /api/v1/bots/{id}           # Update bot
DELETE /api/v1/bots/{id}           # Delete bot

POST   /api/v1/bots/{id}/documents # Upload document
GET    /api/v1/bots/{id}/chat      # Chat endpoint (REST)
WS     /ws/v1/bots/{id}/chat       # WebSocket chat

POST   /api/v1/bots/{id}/integrations/telegram # Setup Telegram
POST   /api/v1/bots/{id}/integrations/zalo     # Setup Zalo
7.2 Webhook Endpoints
text
POST   /webhook/telegram/{bot_token}
POST   /webhook/zalo/{app_id}
POST   /webhook/slack/{team_id}
7.3 JavaScript Widget API
javascript
// Example usage
<script>
  window.omniRAGConfig = {
    botId: 'bot_abc123',
    position: 'bottom-right',
    primaryColor: '#007bff',
    welcomeMessage: 'Xin chào! Tôi có thể giúp gì cho bạn?'
  };
</script>
<script src="https://cdn.omnirag.com/widget.v1.js" async></script>
VIII. DEPLOYMENT ARCHITECTURE
8.1 Development Environment
text
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: omnirag
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
  
  mongodb:
    image: mongo:6
  
  redis:
    image: redis:7-alpine
  
  qdrant:
    image: qdrant/qdrant
  
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - mongodb
      - redis
      - qdrant
  
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
  
  celery-worker:
    build: ./backend
    command: celery -A worker worker --loglevel=info
    depends_on:
      - redis
      - backend
8.2 Production Architecture
Kubernetes Cluster với các namespaces:

omnirag-system: Core services

tenant-{id}: Isolated per enterprise customer

Horizontal Pod Autoscaling cho chat service

Database clustering (PostgreSQL streaming replication)

CDN cho static assets (widget.js, dashboard)

IX. ROADMAP TRIỂN KHAI
Phase 1: MVP (6-8 tuần)
Core RAG Engine với document upload

Basic Web Widget embeddable

Simple Dashboard để quản lý bot

Telegram Integration cơ bản

Local deployment với Docker Compose

Phase 2: Production Ready (8-10 tuần)
Multi-tenancy hoàn chỉnh

Advanced Analytics Dashboard

Zalo & Slack Integration

API Management (rate limiting, keys)

Performance Optimization (caching, async)

Phase 3: Scaling & Enterprise (6-8 tuần)
Kubernetes deployment

Advanced Features:

Human handoff

Conversation flows

Custom functions/actions

SSO integration

White-label Solution

Mobile Apps (React Native)

X. THÁCH THỨC & GIẢI PHÁP
10.1 Technical Challenges
Vector Search Performance: Index optimization, approximate nearest neighbor

LLM Cost Management: Caching, response optimization, model selection

Multi-tenant Isolation: Resource quotas, data separation

Real-time at Scale: WebSocket management, connection pooling

10.2 Business Challenges
Onboarding Simplification: Step-by-step wizard, templates

Pricing Strategy: Freemium + enterprise tiers

Competitive Differentiation: Focus on multi-channel + no-code

10.3 Security Considerations
Data Encryption: At rest & in transit

API Security: Rate limiting, DDoS protection

Compliance: GDPR, data residency options

Access Control: RBAC per tenant

XI. TÀI LIỆU THAM KHẢO
RAG Papers: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"

Vector Databases: Qdrant, Pinecone, Weaviate documentation

LLM Frameworks: LangChain, LlamaIndex

Multi-tenant SaaS: Best practices from Auth0, Stripe

Chatbot Platforms: Dialogflow, Rasa, Botpress architectures

XII. KẾT LUẬN
OmniRAG là một đồ án toàn diện bao gồm:

✅ AI/ML: RAG, embeddings, LLM integration

✅ Backend Engineering: Microservices, APIs, databases

✅ Frontend: Dashboard phức tạp, real-time updates

✅ DevOps: Containerization, monitoring, scaling

✅ Product Thinking: User flows, multi-tenancy, business model

Ưu điểm của đồ án này:

Thực tế & ứng dụng cao: Giải quyết nhu cầu thực tế của doanh nghiệp

Kỹ thuật phong phú: Cover đa dạng công nghệ

Scalable: Kiến trúc mở rộng được

Demo impressive: Có thể show nhiều tính năng

Có thể phát triển tiếp: Startup tiềm năng