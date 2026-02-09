"""Settings management endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.ai.openai_provider import OpenAIProvider
from backend.database import get_session
from backend.models import Setting

router = APIRouter(prefix="/api/settings", tags=["settings"])


class APIKeyRequest(BaseModel):
    api_key: str


class SettingsUpdate(BaseModel):
    exclude_patterns: list[str] | None = None
    file_limit: int | None = None
    language_filters: list[str] | None = None
    daily_limit: int | None = None
    ai_model: str | None = None


@router.post("/api-key")
async def set_api_key(req: APIKeyRequest, session: AsyncSession = Depends(get_session)):
    """Validate and store OpenAI API key."""
    if not req.api_key.strip():
        raise HTTPException(status_code=400, detail="API key cannot be empty")

    # Validate with test call
    provider = OpenAIProvider(api_key=req.api_key.strip())
    is_valid = await provider.validate_key()
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid API key")

    # Store
    existing = await session.execute(select(Setting).where(Setting.key == "openai_api_key"))
    setting = existing.scalar_one_or_none()
    if setting:
        setting.value = req.api_key.strip()
    else:
        session.add(Setting(key="openai_api_key", value=req.api_key.strip()))

    await session.commit()
    return {"valid": True, "message": "API key saved successfully"}


@router.get("")
async def get_settings(session: AsyncSession = Depends(get_session)):
    """Return current settings."""
    result = await session.execute(select(Setting))
    settings = result.scalars().all()

    settings_dict = {s.key: s.value for s in settings}

    # Mask API key
    api_key = settings_dict.get("openai_api_key", "")
    masked_key = ""
    if api_key:
        masked_key = api_key[:8] + "..." + api_key[-4:] if len(api_key) > 12 else "***"

    return {
        "api_key_set": bool(api_key),
        "api_key_masked": masked_key,
        "ai_model": settings_dict.get("ai_model", "gpt-4o-mini"),
        "exclude_patterns": _parse_json_setting(settings_dict.get("exclude_patterns")),
        "file_limit": int(settings_dict.get("file_limit", "500")),
        "language_filters": _parse_json_setting(settings_dict.get("language_filters")),
        "daily_limit": int(settings_dict.get("daily_limit", "0")),
        "daily_usage": int(settings_dict.get("daily_usage", "0")),
    }


@router.put("")
async def update_settings(req: SettingsUpdate, session: AsyncSession = Depends(get_session)):
    """Update settings."""
    import json

    updates = {}
    if req.exclude_patterns is not None:
        updates["exclude_patterns"] = json.dumps(req.exclude_patterns)
    if req.file_limit is not None:
        updates["file_limit"] = str(req.file_limit)
    if req.language_filters is not None:
        updates["language_filters"] = json.dumps(req.language_filters)
    if req.daily_limit is not None:
        updates["daily_limit"] = str(req.daily_limit)
    if req.ai_model is not None:
        updates["ai_model"] = req.ai_model

    for key, value in updates.items():
        existing = await session.execute(select(Setting).where(Setting.key == key))
        setting = existing.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            session.add(Setting(key=key, value=value))

    await session.commit()
    return {"updated": list(updates.keys())}


def _parse_json_setting(value: str | None) -> list | None:
    if not value:
        return None
    import json
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None
