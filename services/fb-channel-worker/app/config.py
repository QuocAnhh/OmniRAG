import logging
import re
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    BACKEND_URL: str = "http://backend:8000"
    WORKER_API_TOKEN: str = ""
    INBOUND_SECRET: str = ""
    FB_WORKER_API_TOKEN: str = ""
    FB_INBOUND_SECRET: str = ""
    LOG_LEVEL: str = "INFO"

    COOKIES_DIR: str = "/data/fb-cookies"
    PROBE_INTERVAL_SECONDS: int = 300
    PROBE_MAX_CONSECUTIVE_FAILS: int = 3
    INBOUND_HTTP_TIMEOUT_SECONDS: float = 10.0
    FB_COALESCE_DELAY_SECONDS: float = 0.8
    FB_MEDIA_COALESCE_DELAY_SECONDS: float = 5.0
    FB_MEDIA_STASH_SECONDS: float = 30.0


settings = Settings()
if not settings.WORKER_API_TOKEN:
    settings.WORKER_API_TOKEN = settings.FB_WORKER_API_TOKEN
if not settings.INBOUND_SECRET:
    settings.INBOUND_SECRET = settings.FB_INBOUND_SECRET


_REDACT_KEYS = ("c_user", "xs", "fr", "datr", "sb", "presence")
_REDACT_PATTERN = re.compile(
    r'("(?:' + "|".join(_REDACT_KEYS) + r')"\s*[:=]\s*")([^"]+)(")'
)


class CookieRedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
        except Exception:
            return True
        if _REDACT_PATTERN.search(msg):
            redacted = _REDACT_PATTERN.sub(r"\1<redacted>\3", msg)
            record.msg = redacted
            record.args = ()
        return True


def configure_logging() -> None:
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    )
    handler.addFilter(CookieRedactingFilter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    logging.getLogger("fbchat-muqit").setLevel(max(level, logging.INFO))
