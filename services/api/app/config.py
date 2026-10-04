"""Settings from environment variables, with defaults read from the repo's git-ignored local.env."""
import os
import secrets
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
API_DIR = ROOT / "services" / "api"
DATA_DIR = API_DIR / "data"
DEMO_DIR = ROOT / "demo"


def _read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


_FILE = _read_env_file(ROOT / "local.env")


def _get(key: str, default: str = "") -> str:
    if key in os.environ:  # an empty environment variable deliberately overrides local.env (tests rely on this)
        return os.environ[key] or default
    return _FILE.get(key) or default


def _internal_secret() -> str:
    configured = _get("CAREBRIDGE_INTERNAL_SECRET")
    if configured:
        return configured
    path = DATA_DIR / "internal_secret"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(secrets.token_urlsafe(24))
        path.chmod(0o600)
    return path.read_text().strip()


@dataclass(frozen=True)
class Settings:
    bot_token: str = _get("TELEGRAM_BOT_TOKEN")
    bot_username: str = _get("CAREBRIDGE_BOT_USERNAME", "geeko_fsrs_bot")
    public_url: str = _get("CAREBRIDGE_PUBLIC_URL").rstrip("/")
    dev_auth: bool = _get("CAREBRIDGE_DEV_AUTH", "1") == "1"
    ollama_url: str = _get("OLLAMA_URL", "http://127.0.0.1:11434")
    model: str = _get("CAREBRIDGE_MODEL", "gemma4:e4b-mlx")
    laya_url: str = _get("LAYA_URL", "http://127.0.0.1:8888").rstrip("/")
    laya_api_key: str = _get("LAYA_API_KEY")
    telegram_ids: str = _get("CAREBRIDGE_TELEGRAM_IDS")
    db_path: Path = Path(_get("CAREBRIDGE_DB", str(DATA_DIR / "care-bridge.sqlite3")))


settings = Settings()
INTERNAL_SECRET = _internal_secret()
