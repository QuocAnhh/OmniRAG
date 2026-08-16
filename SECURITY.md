# Security

## Reporting a vulnerability

Email the maintainer rather than opening a public issue. Include what you did,
what happened, and what you expected.

## Deployment requirements

The base `docker-compose.yml` is secure by default and refuses to start without
its secrets. Two things are still on the operator:

**Generate secrets as hex.** `openssl rand -hex 32`. The Postgres, MongoDB and
Redis connection strings are built by raw interpolation with no
percent-encoding, so a password containing `@ : / ? # %` produces a wrong
connection string rather than an error.

**Rotating a datastore password needs two steps.** `POSTGRES_PASSWORD` and
`MONGO_INITDB_ROOT_PASSWORD` are read only by initdb. On an existing volume the
container starts happily with the old password still in effect and no warning,
so the change must also be made inside the database:

```bash
docker compose exec db psql -U postgres -d omnirag \
  -c "ALTER ROLE postgres WITH PASSWORD '<new>';"

docker compose exec mongodb mongosh -u admin -p '<old>' --authenticationDatabase admin \
  --eval "db.getSiblingDB('admin').changeUserPassword('admin','<new>')"
```

Stop `backend` and `celery_worker` first — SQLAlchemy's pool holds authenticated
connections, so the change appears to work until the pool recycles.

Verify with `python scripts/validate_env.py` before deploying.

## Design notes

**Tenant isolation.** Every bot-scoped route goes through `get_current_bot`,
which constrains `Bot.tenant_id` to the caller's tenant. Endpoints must not
accept a `bot_id` and query on it directly — that was the shape of the worst
vulnerability found in the August 2026 audit, and it is why the
`/api/v1/openrouter/*` router was removed rather than patched.

Qdrant is a single collection shared by all tenants and its search filter is
currently keyed on `bot_id` alone, so the endpoint-level check is the only
boundary. Adding a `tenant_id` payload field and filter is planned; until then,
treat any new Qdrant query path as security-critical.

**Channel credentials.** Telegram and Zalo bot tokens and webhook secrets live
in `Bot.config`. They are redacted on read (`app/core/bot_config.py`) and
client-supplied channel sub-objects are discarded on write. Only the
`/channels/*/connect` flows may write them. If you add a channel, add its key to
`CHANNEL_CONFIG_KEYS`.

**Webhooks fail closed.** All five channel webhooks reject when their shared
secret is unset. A blank secret disables the channel; it never opens it.

## Known history

A live OpenRouter key was committed in February 2026 (`2240a7b`) and reached the
public repository. It has been revoked and rotated. The history has deliberately
not been rewritten: force-pushing a public repository breaks every clone and
fork while GitHub keeps the blob reachable anyway, so it buys nothing for an
already-dead key. Prevention is handled by `.pre-commit-config.yaml` (gitleaks)
and the secret-scan CI job instead.

## Verifying a deployment

```bash
# From outside the server — every one of these must be closed
nmap -Pn -p 5433,27017,6380,9000,9001,6333,8001,5002 <host>

# Docs must not be reachable in production
curl -o /dev/null -w '%{http_code}\n' https://<host>/docs          # expect 404

# Bot reads must not carry credentials
curl -s https://<host>/api/v1/bots/ -H "Authorization: Bearer $TOKEN" \
  | grep -c '"bot_token": *"[^_]'                                   # expect 0

# Unsigned webhook must be rejected
curl -o /dev/null -w '%{http_code}\n' -X POST \
  https://<host>/api/v1/channels/zalo/hub-webhook -d '{}'           # expect 403
```
