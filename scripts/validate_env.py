#!/usr/bin/env python3
"""Validate the .env used by docker compose.

Checks values, not just key presence. The previous version compared
backend/.env against backend/.env.example — a file that never existed, because
.gitignore's `**/.env.*` rule silently swallowed it — so it always printed
"File not found", computed an empty diff, and exited 0. It could not fail.

Run from anywhere:
    python scripts/validate_env.py [path/to/.env]
"""
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Compose refuses to start without these (${VAR:?} in docker-compose.yml).
# Listed here too so problems surface before a deploy rather than during one.
REQUIRED = [
    "SECRET_KEY",
    "JWT_SECRET",
    "POSTGRES_PASSWORD",
    "MONGO_PASSWORD",
    "MINIO_ROOT_USER",
    "MINIO_ROOT_PASSWORD",
    "OPENROUTER_API_KEY",
]

# Secrets that must be long and unguessable. MINIO_ROOT_USER is a username.
MIN_LENGTH = {
    "SECRET_KEY": 32,
    "JWT_SECRET": 32,
    "POSTGRES_PASSWORD": 16,
    "MONGO_PASSWORD": 16,
    "MINIO_ROOT_PASSWORD": 16,
}

# Placeholders that look like a filled-in value but are not.
PLACEHOLDER = re.compile(
    r"^(change[_-]?me|changeme|your[_-]|xxx+|todo|placeholder|secret|password|admin|test)"
    r"|CHANGE_ME|YOUR_SUPER_SECRET_KEY",
    re.IGNORECASE,
)

# The datastore URIs are built by raw interpolation with no percent-encoding,
# so these characters silently produce a wrong connection string.
URI_UNSAFE = set("@:/?#[]% ")


def load_env(path: str) -> dict:
    values = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO_ROOT, ".env")

    if not os.path.exists(path):
        print(f"❌ {path} not found. Start from the template:\n   cp .env.example .env")
        return 1

    env = load_env(path)
    problems = []

    for key in REQUIRED:
        value = env.get(key, "")
        if not value:
            problems.append(f"{key} is missing or empty")
            continue
        if PLACEHOLDER.search(value):
            problems.append(f"{key} still holds a placeholder value ({value[:16]}...)")
            continue
        minimum = MIN_LENGTH.get(key)
        if minimum and len(value) < minimum:
            problems.append(f"{key} is only {len(value)} chars, need at least {minimum}")
        if key.endswith("PASSWORD") or key in ("SECRET_KEY", "JWT_SECRET"):
            bad = sorted(URI_UNSAFE & set(value))
            if bad:
                problems.append(
                    f"{key} contains {''.join(bad)!r}, which breaks the connection "
                    f"strings — regenerate with: openssl rand -hex 32"
                )

    if env.get("ENVIRONMENT") == "production" and "localhost" in env.get("CORS_ORIGINS", ""):
        problems.append("CORS_ORIGINS still allows localhost while ENVIRONMENT=production")

    if problems:
        print(f"❌ {path} has {len(problems)} problem(s):\n")
        for p in problems:
            print(f"  - {p}")
        print("\nGenerate secrets with: openssl rand -hex 32")
        return 1

    print(f"✅ {path} looks good ({len(REQUIRED)} required values checked).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
