import json
import logging
from pathlib import Path
from typing import Optional

from ..config import STEMS_DIR
from ..schemas.models import StemResult

logger = logging.getLogger("musicouts.cache")

STEM_NAMES = ("vocals", "drums", "bass", "other")
SUPPORTED_EXTENSIONS = (".wav", ".mp3")


def get_stems_dir(track_id: str) -> Path:
    """Return the output directory path for a given track's stems."""
    return STEMS_DIR / track_id


def get_cached_stems(track_id: str) -> Optional[StemResult]:
    """
    Check if all 4 stems (vocals, drums, bass, other) exist in STEMS_DIR/<track_id>/.
    Returns a StemResult with is_cached=True if all exist, otherwise None.
    """
    stem_dir = get_stems_dir(track_id)
    if not stem_dir.exists() or not stem_dir.is_dir():
        return None

    manifest_file = stem_dir / "manifest.json"
    if manifest_file.exists():
        try:
            with open(manifest_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            vocals_path = Path(data.get("vocals_path", ""))
            drums_path = Path(data.get("drums_path", ""))
            bass_path = Path(data.get("bass_path", ""))
            other_path = Path(data.get("other_path", ""))

            if (
                vocals_path.exists()
                and drums_path.exists()
                and bass_path.exists()
                and other_path.exists()
            ):
                return StemResult(
                    id=track_id,
                    vocals_path=str(vocals_path.resolve()),
                    drums_path=str(drums_path.resolve()),
                    bass_path=str(bass_path.resolve()),
                    other_path=str(other_path.resolve()),
                    is_cached=True,
                )
        except Exception as e:
            logger.warning(f"Error reading stem manifest for {track_id}: {e}")

    # Fallback: Check individual file existence in stem_dir (.wav or .mp3)
    found_paths = {}
    for name in STEM_NAMES:
        matched = False
        for ext in SUPPORTED_EXTENSIONS:
            candidate = stem_dir / f"{name}{ext}"
            if candidate.exists() and candidate.is_file() and candidate.stat().st_size > 0:
                found_paths[name] = str(candidate.resolve())
                matched = True
                break
        if not matched:
            return None

    return StemResult(
        id=track_id,
        vocals_path=found_paths["vocals"],
        drums_path=found_paths["drums"],
        bass_path=found_paths["bass"],
        other_path=found_paths["other"],
        is_cached=True,
    )


def save_stem_manifest(track_id: str, stem_result: StemResult) -> Path:
    """Save stem metadata manifest JSON into the track's stem directory."""
    stem_dir = get_stems_dir(track_id)
    stem_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = stem_dir / "manifest.json"

    data = {
        "id": stem_result.id,
        "vocals_path": stem_result.vocals_path,
        "drums_path": stem_result.drums_path,
        "bass_path": stem_result.bass_path,
        "other_path": stem_result.other_path,
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return manifest_path


def is_stem_cached(track_id: str) -> bool:
    """Return True if all stems for the track ID are cached."""
    return get_cached_stems(track_id) is not None


def clear_stem_cache(track_id: str) -> bool:
    """Delete cached stems and manifest for a given track ID."""
    stem_dir = get_stems_dir(track_id)
    if stem_dir.exists() and stem_dir.is_dir():
        import shutil
        shutil.rmtree(stem_dir, ignore_errors=True)
        return True
    return False
