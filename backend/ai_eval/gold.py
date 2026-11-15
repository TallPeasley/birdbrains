"""Gold-set file format: one JSON object per line.

  id            unique, e.g. "G-001"
  course        "MTH1W" or "MPM2D"
  unit_topic    free text, same as the upload form
  images        photo paths relative to the gold file (runs Stage 1 and Stage 2), OR
  lines         the student's work typed out as LaTeX, one string per written line
                (skips Stage 1, so only the grading is tested)
  expected.root_codes           error codes a tutor would give; [] for fully correct work
  expected.carry_forward_steps  line numbers that are only wrong because of an earlier
                                mistake and must not lose marks
  notes         optional, for humans

Lines that start with # and blank lines are ignored. Never put a student's name
in this file or leave one visible in a photo.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from birdbrains.schemas import ERROR_CODE_PATTERN, CourseEnum

_CODE = re.compile(ERROR_CODE_PATTERN)


@dataclass(frozen=True)
class GoldSample:
    id: str
    course: CourseEnum
    unit_topic: str
    root_codes: frozenset[str]
    carry_forward_steps: tuple[int, ...] = ()
    images: tuple[Path, ...] = ()
    lines: tuple[str, ...] = ()
    notes: str = ""
    tags: tuple[str, ...] = field(default=())


def load_gold(path: str | Path) -> list[GoldSample]:
    path = Path(path)
    samples: list[GoldSample] = []
    seen: set[str] = set()
    for n, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        try:
            row = json.loads(raw)
            expected = row["expected"]
            codes = frozenset(expected["root_codes"])
            bad = [c for c in codes if not _CODE.match(c)]
            if bad:
                raise ValueError(f"unknown error code {bad}")
            images = tuple(path.parent / p for p in row.get("images", []))
            lines = tuple(row.get("lines", []))
            if bool(images) == bool(lines):
                raise ValueError("give exactly one of 'images' or 'lines'")
            missing = [str(p) for p in images if not p.exists()]
            if missing:
                raise ValueError(f"photo not found: {missing}")
            if row["id"] in seen:
                raise ValueError("duplicate id")
            seen.add(row["id"])
            samples.append(GoldSample(
                id=row["id"], course=CourseEnum(row["course"]), unit_topic=row["unit_topic"], root_codes=codes,
                carry_forward_steps=tuple(expected.get("carry_forward_steps", [])), images=images, lines=lines,
                notes=row.get("notes", ""), tags=tuple(row.get("tags", []))))
        except Exception as exc:
            raise ValueError(f"{path.name} line {n}: {exc}") from exc
    return samples
