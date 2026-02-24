import requests

# Test Login
login_url = "http://localhost:8000/api/v1/auth/login"
data = {
    "username": "quocanhnguyen@omnirag.com",
    "password": "12345678"
}

print("Logging in...")
response = requests.post(login_url, data=data)
if response.status_code != 200:
    print("Login failed:", response.status_code, response.text)
    exit(1)

token = response.json().get("access_token")
print("Login successful.")

# Fetch Bots
bots_url = "http://localhost:8000/api/v1/bots/"
headers = {
    "Authorization": f"Bearer {token}"
}

print("Fetching bots...")
bots_response = requests.get(bots_url, headers=headers)
if bots_response.status_code != 200:
    print("Failed to fetch bots:", bots_response.status_code, bots_response.text)
else:
    bots = bots_response.json()
    print(f"Found {len(bots)} bots:")
    for bot in bots:
        print(f"- {bot.get('name')} (Active: {bot.get('is_active')})")

