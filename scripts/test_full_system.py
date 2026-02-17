import requests
import time
import os
import sys

# Configuration
API_URL = os.getenv("API_URL", "http://localhost:8000")
USERNAME = os.getenv("TEST_USER", "admin@omnirag.com")
PASSWORD = os.getenv("TEST_PASS", "admin123")

def print_result(name, success, message=""):
    symbol = "✅" if success else "❌"
    print(f"{symbol} {name}: {message}")
    if not success:
        sys.exit(1)

def main():
    print(f"🚀 Starting End-to-End Test against {API_URL}")
    session = requests.Session()
    
    # 1. Health Check
    try:
        resp = session.get(f"{API_URL}/health")
        if resp.status_code == 200:
            print_result("Health Check", True, "System is healthy")
        else:
            print_result("Health Check", False, f"Status {resp.status_code}")
    except Exception as e:
        print_result("Health Check", False, str(e))

    # 2. Login (This endpoint might vary, adjusting to common pattern)
    # Assuming standard OAuth2 or similar
    # For now, we'll strip this if no auth is set up, or assume a specific endpoint.
    # Looking at the code, there isn't a clear auth endpoint in the visible snippets.
    # But let's assume valid access for now or public endpoints for testing if dev mode.
    
    # 3. List Bot Templates
    print("\n📦 Testing Bot Templates...")
    try:
        resp = session.get(f"{API_URL}/api/v1/bot-templates/")
        if resp.status_code == 200:
            templates = resp.json()
            print_result("List Templates", True, f"Found {len(templates)} templates")
            if len(templates) > 0:
                template_id = templates[0]['id']
        else:
            print_result("List Templates", False, f"Status {resp.status_code}")
    except Exception as e:
        print_result("List Templates", False, str(e))

    # 4. Create Bot
    print("\n🤖 Testing Bot Management...")
    bot_id = None
    try:
        # Create a test bot
        bot_data = {
            "name": "E2E Test Bot",
            "description": "Created by test script",
            "config": {"model": "openai/gpt-4o-mini"}
        }
        # Note: Adjust endpoint if needed. Assuming /api/v1/bots/
        resp = session.post(f"{API_URL}/api/v1/bots/", json=bot_data)
        if resp.status_code in [200, 201]:
            bot = resp.json()
            bot_id = bot['id']
            print_result("Create Bot", True, f"Created bot {bot_id}")
        else:
            print(f"Create failed: {resp.text}")
            print_result("Create Bot", False, f"Status {resp.status_code}")

    except Exception as e:
        print_result("Create Bot", False, str(e))

    if not bot_id:
        print("❌ Skipping remaining tests due to bot creation failure")
        return

    # 5. Chat
    print("\n💬 Testing Chat...")
    try:
        chat_data = {
            "message": "Hello, are you working?",
            "history": []
        }
        resp = session.post(f"{API_URL}/api/v1/bots/{bot_id}/chat", json=chat_data)
        if resp.status_code == 200:
            answer = resp.json().get('response', '')
            print_result("Chat", True, f"Reply: {answer[:50]}...")
        else:
            print_result("Chat", False, f"Status {resp.status_code}")
    except Exception as e:
        print_result("Chat", False, str(e))

    # 6. Cleanup
    print("\n🧹 Cleanup...")
    try:
        resp = session.delete(f"{API_URL}/api/v1/bots/{bot_id}")
        if resp.status_code == 200:
            print_result("Delete Bot", True, "Cleaned up test bot")
        else:
            print_result("Delete Bot", False, f"Status {resp.status_code}")
    except Exception as e:
        print_result("Delete Bot", False, str(e))

    print("\n✨ All tests passed!")

if __name__ == "__main__":
    main()
