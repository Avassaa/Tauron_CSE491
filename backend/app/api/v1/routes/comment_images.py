"""Upload and serve images embedded in news comments (URLs instead of huge base64 bodies)."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse

from app.config import settings
from app.core.security import get_current_user_id

router = APIRouter(prefix="/comment-images", tags=["Comment images"])

_MAX_BYTES = 5 * 1024 * 1024
_ALLOWED_CT = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})
_CT_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

_FILENAME_SAFE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    r"\.(jpg|jpeg|png|webp|gif)$",
    re.IGNORECASE,
)


def _storage_root() -> Path:
    raw = settings.COMMENT_IMAGE_STORAGE_DIR.strip()
    if raw:
        p = Path(raw).expanduser()
        return p.resolve() if p.is_absolute() else (Path.cwd() / p).resolve()
    backend_root = Path(__file__).resolve().parents[4]
    return (backend_root / "data" / "comment_images").resolve()


def _ensure_storage() -> Path:
    root = _storage_root()
    root.mkdir(parents=True, exist_ok=True)
    return root


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_comment_image(
    request: Request,
    file: UploadFile = File(...),
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Store one image; returns a public URL for markdown ``![](url)``."""
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct not in _ALLOWED_CT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type",
        )
    ext = _CT_EXT[ct]
    body = await file.read()
    if len(body) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image too large",
        )
    if len(body) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file",
        )

    name = f"{uuid.uuid4()}{ext}"
    dest = _ensure_storage() / name
    dest.write_bytes(body)

    base = str(request.base_url).rstrip("/")
    url = f"{base}/api/v1/comment-images/{name}"
    return {"url": url}


@router.get("/{filename}")
async def get_comment_image(filename: str):
    """Public read for ``<img src>`` (no JWT). Filename is a stored UUID image."""
    if not _FILENAME_SAFE.match(filename):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    root = _storage_root()
    path = (root / filename).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    media = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }
    sfx = path.suffix.lower()
    return FileResponse(path, media_type=media.get(sfx, "application/octet-stream"))
