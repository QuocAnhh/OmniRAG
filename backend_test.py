import requests
import json
import logging

logging.basicConfig(level=logging.DEBUG)

def fetch_bot_id():
    resp = requests.get("http://127.0.0.1:8000/api/v1/bots?skip=0&limit=1")
    if resp.status_code == 200:
        bots = resp.json()
        if bots:
            return bots[0]['id']
    return "38f9e5ad-8d44-46d3-8a9b-9c1d57d53c4f"  # fallback from logs

bot_id = fetch_bot_id()
print(f"Testing stream with Bot ID: {bot_id}")

# This will fail with 401 if we don't have token but user can test
print("Script ready. Run from frontend or with token.")
