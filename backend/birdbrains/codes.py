"""The error-code list, loaded from ``error_codes.json``.

That file is the single source of truth for every error code: the backend reads it
here and the site imports the same file (``lib/errorCodes.ts``). Each code has a
readable id whose first three letters are its pillar (CON, STR, PRC, FAC, COM, TST).

Ids are stable. Gradings stored with older ids (the four-pillar ``CON-01`` style) are
upgraded on load through ``LEGACY_CODES``; an old id is never reused.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

_DATA = json.loads((Path(__file__).with_name("error_codes.json")).read_text(encoding="utf-8"))


@dataclass(frozen=True)
class TellApart:
    code: Optional[str]
    how: str


@dataclass(frozen=True)
class ErrorCode:
    id: str
    pillar: str
    name: str
    plain_name: str
    student_help: str
    description: str
    example: str
    tell_apart: tuple[TellApart, ...]
    remediation: str
    legacy_ids: tuple[str, ...]


CODES: dict[str, ErrorCode] = {
    c["id"]: ErrorCode(
        id=c["id"], pillar=c["pillar"], name=c["name"], plain_name=c["plain_name"],
        student_help=c["student_help"], description=c["description"], example=c["example"],
        tell_apart=tuple(TellApart(t["code"], t["how"]) for t in c["tell_apart"]),
        remediation=c["remediation"], legacy_ids=tuple(c["legacy_ids"]),
    )
    for c in _DATA["codes"]
}

# Old id -> current id.
LEGACY_CODES: dict[str, str] = {old: c.id for c in CODES.values() for old in c.legacy_ids}

ERROR_CODE_PATTERN = "^(" + "|".join(CODES) + ")$"


def current_code(code: Optional[str]) -> Optional[str]:
    """The current id for ``code`` (old ids are remapped; others pass through)."""
    if code is None:
        return None
    return LEGACY_CODES.get(code, code)
