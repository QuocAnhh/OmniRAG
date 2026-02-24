# 🗄️ OmniRAG Database Management Guide

Tài liệu này hướng dẫn cách kết nối và kiểm tra dữ liệu trong các loại database của dự án OmniRAG.

---

## 🏗️ 1. PostgreSQL (Cấu trúc & Cấu hình)
Lưu trữ thông tin: Bots, Users, Tenants, Documents (metadata), Folders.

### Truy cập qua Docker Terminal:
```bash
docker exec -it omnirag-db-1 psql -U postgres -d omnirag
```

### Các câu lệnh SQL hữu ích:
*   **Xem danh sách bot:** `SELECT name, id, is_active FROM bots;`
*   **Kiểm tra cấu hình Bot (JSONB):** `SELECT name, config->>'model' as model FROM bots;`
*   **Xem file đang lỗi:** `SELECT filename, error_message FROM documents WHERE status = 'failed';`
*   **Xem cấu trúc bảng:** `\dt` hoặc `\d <tên_bảng>`

### Kết nối qua DataGrip/DBeaver:
*   **Host:** `localhost` (hoặc IP Server)
*   **Port:** `5433` (Ánh xạ từ 5432)
*   **User:** `postgres`
*   **Password:** `password`
*   **Database:** `omnirag`

---

## 🍃 2. MongoDB (Lịch sử chat & Analytics)
Lưu trữ thông tin: Tin nhắn hội thoại (conversations), Phiên làm việc (sessions).

### Truy cập qua Docker Terminal:
```bash
docker exec -it omnirag-mongodb-1 mongosh -u admin -p password --authenticationDatabase admin
```

### Các câu lệnh MQL hữu ích:
*   **Chọn Database:** `use omnirag`
*   **Xem các bảng:** `show collections`
*   **Xem tin nhắn mới nhất:** `db.conversations.find().sort({timestamp: -1}).limit(1).pretty()`
*   **Tìm tin nhắn theo Bot ID:** `db.conversations.find({bot_id: "uuid-cua-bot"})`

### Kết nối qua DataGrip/MongoDB Compass:
*   **URI:** `mongodb://admin:password@localhost:27017`

---

## ⚡ 3. Redis (Cache & Session tạm)
Lưu trữ dữ liệu tạm thời, cache kết quả chat từ LLM để tăng tốc.

### Truy cập qua Docker Terminal:
```bash
docker exec -it omnirag-redis-1 redis-cli
```

### Các câu lệnh hữu ích:
*   **Liệt kê key:** `keys *`
*   **Xem nội dung một key:** `get <tên_key>`
*   **Xóa toàn bộ cache:** `FLUSHALL`

### Kết nối qua Redis Insight:
*   **Port:** `6380` (Ánh xạ từ 6379)

---

## 🧠 4. Qdrant (Database Vector)
Lưu trữ các đoạn văn bản (chunks) đã được chuyển hóa thành Vector để tìm kiếm ngữ nghĩa.

### Kiểm tra qua Browser/Curl:
*   **Dashboard:** [http://localhost:6333/dashboard](http://localhost:6333/dashboard)
*   **Xem danh sách Collection:**
```bash
curl http://localhost:6333/collections
```

---

## 📁 5. MinIO (Lưu trữ file vật lý)
Lưu trữ các file PDF, TXT gốc mà người dùng upload.

*   **Console UI:** [http://localhost:9001](http://localhost:9001)
*   **User:** `minioadmin`
*   **Password:** `minioadmin`

---

## 💡 Lưu ý về tên Container
Nếu chạy trên môi trường khác mà lệnh `docker exec` báo lỗi `No such container`, hãy dùng lệnh sau để kiểm tra chính xác tên container hiện tại:
```bash
docker ps --format "table {{.Names}}\t{{.Image}}"
```
