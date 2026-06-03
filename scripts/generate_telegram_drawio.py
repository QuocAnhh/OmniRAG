#!/usr/bin/env python3
"""Generate Telegram-specific Draw.io diagrams referenced by Decuong v4."""

from __future__ import annotations

from pathlib import Path

from drawio_kit import Arrow, Box, DrawioFile, Lane, Note, Title


OUT_DIR = Path("docs/diagrams/telegram")


def save(d: DrawioFile, name: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    d.save(str(OUT_DIR / name))


def telegram_message_flow() -> None:
    d = DrawioFile("Figure 3.1c - Telegram Bot Message Flow", 1600, 760)
    d.add(Title("Figure 3.1c - Telegram Bot Message Flow", 60, 24, 1480))
    d.add(Lane("Telegram platform", 60, 88, 340, 560, "online"))
    d.add(Lane("OmniRAG backend", 430, 88, 740, 560, "backend"))
    d.add(Lane("AI / storage services", 1200, 88, 340, 560, "offline"))

    user = d.add(Box("Telegram user\ntext / photo / document", 110, 170, 240, 70, "external", True))
    api = d.add(Box("Telegram Bot API\nWebhook Update", 110, 315, 240, 70, "online", True))
    webhook = d.add(Box("FastAPI webhook\n/channels/telegram/webhook/{bot_id}", 480, 145, 270, 80, "backend", True))
    verify = d.add(Box("Secret token verify\nX-Telegram-Bot-Api-Secret-Token", 820, 145, 280, 80, "warning", True))
    parse = d.add(Box("aiogram Update parse\ncustom routing", 480, 295, 250, 70, "backend", True))
    router = d.add(Box("Handler router\ntext | photo | document | voice", 820, 295, 280, 70, "backend", True))
    rag = d.add(Box("RAG chat core\nsession_id = tg_{chat_id}\nmemory enabled", 520, 455, 280, 90, "highlight", True))
    reply = d.add(Box("sendChatAction + sendMessage\nHTML parse mode", 850, 455, 260, 90, "backend", True))
    qdrant = d.add(Box("Qdrant v3\nretrieval + memory", 1250, 175, 240, 70, "offline", True))
    vision = d.add(Box("OpenRouter vision\nphoto description", 1250, 315, 240, 70, "offline", True))
    minio = d.add(Box("MinIO\nuploaded documents", 1250, 455, 240, 70, "offline", True))

    for src, dst, label in [
        (user, api, "message"),
        (api, webhook, "POST update"),
        (webhook, verify, "header"),
        (verify, parse, "accepted"),
        (parse, router, "Message"),
        (router, rag, "text query"),
        (rag, reply, "answer"),
        (reply, api, "Bot API"),
        (api, user, "response"),
    ]:
        d.add(Arrow(src, dst, label))
    d.add(Arrow(rag, qdrant, "retrieve", dashed=True))
    d.add(Arrow(router, vision, "photo", dashed=True))
    d.add(Arrow(router, minio, "document", dashed=True))
    d.add(Arrow(vision, rag, "description", dashed=True))
    d.add(Arrow(minio, rag, "metadata/text preview", dashed=True))
    d.add(Note("Voice messages currently return a clear unsupported-message response.", 460, 620, 640, 30))
    save(d, "fig_3_1c_telegram_message_flow.drawio")


def telegram_integration_flow() -> None:
    d = DrawioFile("Figure 3.5c - Telegram Bot Integration Flow", 1600, 740)
    d.add(Title("Figure 3.5c - Telegram Bot Integration Flow", 60, 24, 1480))
    d.add(Lane("Connect path", 70, 90, 690, 520, "online"))
    d.add(Lane("Inbound path", 840, 90, 690, 520, "backend"))

    ui = d.add(Box("BotConfigPage\npaste BotFather token", 120, 180, 230, 70, "online", True))
    connect = d.add(Box("POST /channels/telegram/connect\nBearer user auth", 430, 180, 260, 70, "backend", True))
    getme = d.add(Box("Telegram getMe\nverify token", 120, 345, 230, 70, "external", True))
    setwebhook = d.add(Box("Telegram setWebhook\nsecret_token + allowed_updates", 430, 345, 260, 80, "external", True))
    save_cfg = d.add(Box("bot.config.telegram\nbot_info, webhook_url,\nwebhook_secret, is_active", 270, 495, 300, 90, "offline", True))

    tg = d.add(Box("Telegram Bot API\nPOST update", 900, 180, 230, 70, "external", True))
    wh = d.add(Box("Webhook endpoint\npublic per-bot URL", 1210, 180, 240, 70, "backend", True))
    sec = d.add(Box("Constant-time\nsecret compare", 900, 345, 230, 70, "warning", True))
    task = d.add(Box("Background task\nhandle_webhook()", 1210, 345, 240, 70, "backend", True))
    core = d.add(Box("Text / photo / document\nhandlers -> RAG core", 1055, 495, 300, 80, "highlight", True))

    for src, dst, label in [
        (ui, connect, "bot_id + token"),
        (connect, getme, "getMe"),
        (connect, setwebhook, "setWebhook"),
        (getme, save_cfg, "bot_info"),
        (setwebhook, save_cfg, "webhook_url"),
        (tg, wh, "webhook"),
        (wh, sec, "secret header"),
        (sec, task, "accepted"),
        (task, core, "route update"),
    ]:
        d.add(Arrow(src, dst, label))
    save(d, "fig_3_5c_telegram_integration_flow.drawio")


def telegram_config_ui() -> None:
    d = DrawioFile("Figure 3.11c - Telegram Bot Configuration UI", 1450, 760)
    d.add(Title("Figure 3.11c - Telegram Bot Configuration UI Wireframe", 60, 24, 1330))
    d.add(Lane("Bot configuration page - Channels tab", 70, 90, 1310, 560, "online"))

    header = d.add(Box("Telegram Bot\nCONNECTED / NOT CONNECTED status badge", 130, 145, 330, 75, "online", True))
    token = d.add(Box("Token input\nBotFather token", 130, 285, 260, 65, "external", True))
    connect = d.add(Box("Connect Telegram Bot\ncalls getMe + setWebhook", 450, 285, 270, 65, "backend", True))
    card = d.add(Box("Connected state card\nbot username, webhook URL,\ncopy button", 800, 170, 300, 110, "backend", True))
    toggle = d.add(Box("AI auto-reply toggle\nconfig.telegram.is_active", 1160, 170, 170, 110, "warning", True))
    disconnect = d.add(Box("Disconnect\nremove webhook + config", 960, 380, 230, 70, "error", True))
    guide = d.add(Box("Quick setup guide\n1. Create with @BotFather\n2. Paste token\n3. Connect", 180, 455, 440, 110, "offline", True))

    d.add(Arrow(token, connect, "submit"))
    d.add(Arrow(connect, card, "connected"))
    d.add(Arrow(card, toggle, "enable/disable"))
    d.add(Arrow(card, disconnect, "cleanup"))
    d.add(Arrow(header, token, "not connected", dashed=True))
    d.add(Note("The actual UI lives in frontend/src/pages/BotConfigPage.tsx.", 110, 610, 900, 30))
    save(d, "fig_3_11c_telegram_config_ui.drawio")


def telegram_connect_flow() -> None:
    d = DrawioFile("Figure 4.5b - Telegram Bot Connect Flow", 1600, 720)
    d.add(Title("Figure 4.5b - Telegram Bot Connect Flow", 60, 24, 1480))
    labels = [
        ("user", "User\npaste token", 80, "user"),
        ("ui", "OmniRAG UI\nBotConfigPage", 325, "online"),
        ("backend", "Backend\nPOST /connect", 590, "backend"),
        ("getme", "Telegram getMe\nverify token", 870, "external"),
        ("webhook", "Telegram setWebhook\nsecret token", 1135, "external"),
        ("db", "PostgreSQL JSONB\nbot.config.telegram", 1390, "offline"),
    ]
    nodes = []
    for node_id, text, x, role in labels:
        nodes.append(d.add(Box(text, x, 250, 180, 80, role, True)))
    for src, dst, label in [
        (nodes[0], nodes[1], "token"),
        (nodes[1], nodes[2], "bot_id + token"),
        (nodes[2], nodes[3], "getMe"),
        (nodes[3], nodes[4], "bot_info ok"),
        (nodes[4], nodes[5], "webhook_url + secret"),
    ]:
        d.add(Arrow(src, dst, label))
    d.add(Note("Disconnect calls deleteWebhook, closes the aiogram Bot session, then removes config.telegram.", 120, 500, 1150, 40))
    save(d, "fig_4_5b_telegram_bot_connect_flow.drawio")


def telegram_multimodal_demo() -> None:
    d = DrawioFile("Figure 4.6c - Telegram Bot Multimodal Demo", 1600, 800)
    d.add(Title("Figure 4.6c - Telegram Bot Multimodal Demo", 60, 24, 1480))
    d.add(Lane("Text Q&A", 70, 110, 460, 560, "online"))
    d.add(Lane("Photo with vision", 570, 110, 460, 560, "backend"))
    d.add(Lane("Document upload", 1070, 110, 460, 560, "offline"))

    t1 = d.add(Box("User question", 150, 180, 240, 60, "external"))
    t2 = d.add(Box("RAG chat\nsession tg_{chat_id}", 150, 315, 240, 75, "highlight", True))
    t3 = d.add(Box("Answer with citations", 150, 465, 240, 60, "backend"))
    p1 = d.add(Box("Photo + caption", 650, 180, 240, 60, "external"))
    p2 = d.add(Box("Download file\ngetFile + download_file", 650, 300, 240, 70, "backend", True))
    p3 = d.add(Box("OpenRouter vision\ndescription in Vietnamese", 650, 430, 240, 80, "highlight", True))
    p4 = d.add(Box("RAG answer\nusing image description", 650, 560, 240, 70, "backend", True))
    d1 = d.add(Box("Document message\nPDF/DOCX/TXT/etc.", 1150, 170, 240, 70, "external", True))
    d2 = d.add(Box("Size check <= 20 MB\nupload to MinIO", 1150, 300, 240, 80, "backend", True))
    d3 = d.add(Box("Text preview for text/*\nmetadata for other files", 1150, 445, 240, 85, "offline", True))
    d4 = d.add(Box("RAG prompt includes\ncaption + file context", 1150, 585, 240, 70, "backend", True))

    for src, dst, label in [
        (t1, t2, "query"),
        (t2, t3, "response"),
        (p1, p2, "file_id"),
        (p2, p3, "image bytes"),
        (p3, p4, "description"),
        (d1, d2, "file"),
        (d2, d3, "stored object"),
        (d3, d4, "context"),
    ]:
        d.add(Arrow(src, dst, label))
    d.add(Note("Current Telegram document handler does not run full Knowledge Base ingestion; full PDF layout parsing still belongs to the normal upload pipeline.", 160, 705, 1220, 40))
    save(d, "fig_4_6c_telegram_multimodal_demo.drawio")


def conclusion_demo() -> None:
    d = DrawioFile("Figure KL.1 - Telegram Bot Demo Summary", 1450, 700)
    d.add(Title("Figure KL.1 - Telegram Bot Demo Summary", 60, 24, 1330))
    app = d.add(Box("Telegram App\nuser sends text/photo/document", 100, 260, 250, 90, "external", True))
    botapi = d.add(Box("Telegram Bot API\nwebhook + secret token", 430, 260, 250, 90, "online", True))
    backend = d.add(Box("OmniRAG Backend\nTelegramBotService", 760, 260, 250, 90, "backend", True))
    rag = d.add(Box("RAG Core\nQdrant v3 + OpenRouter", 1090, 260, 250, 90, "highlight", True))
    for src, dst, label in [
        (app, botapi, "message"),
        (botapi, backend, "update"),
        (backend, rag, "query/context"),
        (rag, backend, "answer"),
        (backend, botapi, "sendMessage"),
        (botapi, app, "reply"),
    ]:
        d.add(Arrow(src, dst, label))
    save(d, "fig_kl_1_telegram_bot_demo_summary.drawio")


def main() -> int:
    telegram_message_flow()
    telegram_integration_flow()
    telegram_config_ui()
    telegram_connect_flow()
    telegram_multimodal_demo()
    conclusion_demo()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
