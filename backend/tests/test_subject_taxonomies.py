"""Checks for the draft non-maths taxonomies in birdbrains/subjects/."""
import json
from pathlib import Path

import pytest

from birdbrains import subjects

SUBJECTS = subjects.subject_ids()
FIELDS = {"id", "pillar", "name", "plain_name", "student_help", "description",
          "example", "tell_apart", "remediation", "legacy_ids"}
MATHS_FILE = Path(subjects.__file__).parent.parent / "error_codes.json"


def test_expected_subjects_present():
    assert {"chemistry", "physics", "biology", "english", "history_geography"} <= set(SUBJECTS)


@pytest.mark.parametrize("subject", SUBJECTS)
def test_pillars(subject):
    t = subjects.load(subject)
    assert t["subject"] == subject
    assert [p["id"] for p in t["pillars"]] == list(subjects.PILLAR_IDS)
    assert sum(p["max_score"] for p in t["pillars"]) == 10
    for p in t["pillars"]:
        assert p["name"] and p["scope"]
    assert len(t["decision_order"]) == 6


@pytest.mark.parametrize("subject", SUBJECTS)
def test_codes(subject):
    codes = subjects.load(subject)["codes"]
    ids = [c["id"] for c in codes]
    assert len(ids) == len(set(ids)), "duplicate code id"
    per_pillar = {p: 0 for p in subjects.PILLAR_IDS}
    for c in codes:
        assert set(c) == FIELDS, c["id"]
        assert c["id"] == c["id"].upper() and "-" not in c["id"], c["id"]
        assert c["id"].split("_", 1)[0] == c["pillar"], c["id"]
        for k in ("name", "plain_name", "student_help", "description", "example", "remediation"):
            assert c[k].strip(), f"{c['id']} has empty {k}"
        assert c["tell_apart"], f"{c['id']} has no tell_apart"
        for ta in c["tell_apart"]:
            assert ta["how"].strip()
            assert ta["code"] is None or ta["code"] in ids, f"{c['id']} -> {ta['code']}"
            assert ta["code"] != c["id"]
        per_pillar[c["pillar"]] += 1
    assert all(n >= 6 for n in per_pillar.values()), per_pillar


def test_shared_ids_mean_the_same_everywhere():
    """An id used in two subjects (or in maths) must have the same name and student text."""
    seen: dict[str, tuple] = {}
    sources = [(s, subjects.load(s)["codes"]) for s in SUBJECTS]
    if MATHS_FILE.is_file():
        sources.append(("maths", json.loads(MATHS_FILE.read_text())["codes"]))
    for where, codes in sources:
        for c in codes:
            key = (c["name"], c["plain_name"], c["student_help"])
            if c["id"] in seen:
                assert seen[c["id"]][1] == key, f"{c['id']} differs between {seen[c['id']][0]} and {where}"
            else:
                seen[c["id"]] = (where, key)


@pytest.mark.parametrize("subject", SUBJECTS)
def test_taxonomy_text(subject):
    text = subjects.taxonomy_text(subject)
    for c in subjects.load(subject)["codes"]:
        assert c["id"] in text
