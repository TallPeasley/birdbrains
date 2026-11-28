"""Curriculums, grades, subjects and the K-12 topic catalog (birdbrains/curricula)."""
import json
from pathlib import Path

import pytest
from pydantic import BaseModel, ValidationError

from birdbrains import curricula as C
from birdbrains.pipeline import SubmissionContext, course_line, stage1_course_text
from birdbrains.schemas import CourseEnum
from birdbrains.taxonomy import CURRICULUM, strand_for

from conftest import auth, photo, upload


def test_registry_and_catalogs_are_consistent():
    """Prerequisites exist and come earlier, error codes exist in their taxonomy, no
    cycles, every grade offers a subject, every topic has goals, concepts,
    misconceptions and example problems."""
    assert C.validate() == []


def test_catalog_covers_every_grade_for_math_and_each_science():
    for subject in C.CATALOG_SUBJECTS:
        levels = {lv for t in C.catalog(subject)["topics"] for lv in range(t["levels"][0], t["levels"][1] + 1)}
        assert levels == set(range(13)), f"{subject} misses grade levels {set(range(13)) - levels}"


def test_everything_is_marked_for_review():
    """Nothing in the catalog claims to be an official standard yet."""
    for t in C.all_topics().values():
        assert t["review_status"] == "needs_review"
    for c in C.REGISTRY["curricula"]:
        assert c["review_status"] == "needs_review" and c["notes"]


def test_requested_curriculums_are_present():
    names = {c["id"] for c in C.REGISTRY["curricula"]}
    assert {"on", "bc", "ab", "qc", "ca_other", "ccss", "ngss", "eng", "ib", "ap"} <= names


def test_legacy_ontario_courses_keep_their_codes():
    for code, level in (("MTH1W", 9), ("MPM2D", 10)):
        info = C.parse_course(code)
        assert info.legacy and info.curriculum == "on" and info.level == level and info.subject == "math"
        assert C.new_course_id("on", info.grade, "math") == code
    # One course, one id: the long form of Ontario Grade 9 math is refused.
    assert not C.is_valid_course("on.g9.math")
    assert C.is_valid_course("on.g8.math") and C.is_valid_course("on.g11.math")


@pytest.mark.parametrize("bad", ["", "XYZ", "ccss.g7.physics", "ngss.g4.math", "zz.g1.math", "eng.y0.math",
                                 "ccss.g7.math.extra"])
def test_unknown_courses_are_refused(bad):
    assert not C.is_valid_course(bad)
    with pytest.raises(ValueError):
        CourseEnum(bad)


def test_every_picker_choice_is_a_valid_course():
    for cur in C.REGISTRY["curricula"]:
        for g in cur["grades"]:
            for s in C.grade_subjects(cur["id"], g["id"]):
                cid = C.new_course_id(cur["id"], g["id"], s)
                info = C.parse_course(cid)
                assert info.level == g["level"] and C.topics_for(cid)


def test_course_type_keeps_the_old_enum_interface():
    assert CourseEnum.MPM2D == "MPM2D" and CourseEnum("MTH1W").value == "MTH1W"
    assert CourseEnum(CourseEnum.MPM2D) == CourseEnum.MPM2D

    class M(BaseModel):
        course: CourseEnum

    m = M(course="eng.y9.math")
    assert isinstance(m.course, CourseEnum) and m.course.info.curriculum == "eng"
    assert m.model_dump(mode="json") == {"course": "eng.y9.math"}
    assert json.loads(m.model_dump_json()) == {"course": "eng.y9.math"}
    with pytest.raises(ValidationError):
        M(course="MPM3X")


def test_only_math_is_gradable_for_now():
    assert C.parse_course("ccss.g7.math").gradable
    assert not C.parse_course("ngss.g7.science").gradable
    assert not C.parse_course("ap.chem.chemistry").gradable


def test_topic_matching_and_strands():
    assert C.match_topic("ccss.g10.math", "Factoring trinomials")["id"] == "math.algebra.factoring"
    assert C.match_topic("eng.y10.math", "Pythagorean theorem practice")["id"] == "math.geometry.pythagorean"
    assert C.match_topic("ccss.g7.math", "nothing like a topic") is None
    assert strand_for(CourseEnum("ccss.g10.math"), "Factoring trinomials") == "Algebra"
    assert strand_for(CourseEnum("ccss.g7.math"), "nothing like a topic") == "Other"
    # Ontario's original courses still use their own strands.
    assert strand_for(CourseEnum.MPM2D, "Completing the Square") == "Quadratic Relations"
    assert strand_for(CourseEnum.MTH1W, "Linear Relations") == "Algebra"


def test_ontario_prompts_keep_their_course_lists():
    ctx = SubmissionContext("sub_x", CourseEnum.MPM2D, "Completing the Square")
    text = stage1_course_text(ctx)
    assert "detected_course" not in text and "Principles of Mathematics" in text
    for units in CURRICULUM[CourseEnum.MPM2D].values():
        for u in units:
            assert u in text
    assert "Financial Literacy" not in text  # MTH1W's units are not offered to an MPM2D student
    line = course_line(ctx)
    assert line.startswith("Course: MPM2D (") and "misconceptions" not in line


def test_other_courses_get_curriculum_and_topic_context():
    ctx = SubmissionContext("sub_x", CourseEnum("eng.y10.math"), "Factoring quadratics")
    s1 = stage1_course_text(ctx)
    assert "detected_course" not in s1 and "Factoring" in s1 and "MPM2D" not in s1
    line = course_line(ctx)
    assert "National Curriculum in England" in line and "Year 10" in line
    assert "PRC_FACTORING_ERROR" in line  # the topic's misconceptions and their codes


def test_site_imports_the_same_registry():
    """The site's picker reads curricula.json directly; keep the import in place."""
    ts = (Path(__file__).parents[2] / "lib" / "curricula.ts").read_text(encoding="utf-8")
    assert "@/backend/birdbrains/curricula/curricula.json" in ts


def test_site_subject_rule_matches_backend():
    """lib/curricula.ts offers every subject a grade allows, without loading the topic
    catalogs. That only holds while no allowed subject lacks topics at a grade."""
    for cur in C.REGISTRY["curricula"]:
        for g in cur["grades"]:
            allowed = g.get("subjects") or list(C.SUBJECTS)
            assert C.grade_subjects(cur["id"], g["id"]) == [s for s in C.SUBJECTS if s in allowed]


# ------------------------------------------------------------------ API
def test_student_can_register_with_any_curriculum(client):
    r = client.post("/me", json={"role": "student", "name": "Sam Lee", "course": "ccss.g7.math"}, headers=auth("sam"))
    assert r.status_code in (200, 201), r.text
    bad = client.post("/me", json={"role": "student", "name": "X", "course": "nope"}, headers=auth("nope"))
    assert bad.status_code == 422


def test_upload_for_a_math_course_outside_ontario_is_graded(client):
    student = client.post("/me", json={"role": "student", "name": "Sam Lee", "course": "eng.y10.math"},
                          headers=auth("sam")).json()
    r = upload(client, student["studentId"], uid="sam", data={"course": "eng.y10.math"})
    assert r.status_code == 201, r.text
    done = client.post(f"/submissions/{r.json()['submissionId']}/process", headers=auth("sam")).json()
    assert done["submission"]["status"] == "GRADED"
    assert done["submission"]["course"] == "eng.y10.math"


def test_upload_for_a_science_course_is_refused_with_a_code(client):
    student = client.post("/me", json={"role": "student", "name": "Sam Lee", "course": "ngss.g8.science"},
                          headers=auth("sam")).json()
    r = upload(client, student["studentId"], uid="sam", data={"course": "ngss.g8.science"})
    assert r.status_code == 422 and r.json()["code"] == 109


def test_course_is_never_read_from_the_page(client, family):
    """An MTH1W student keeps MTH1W, even uploading work that looks like Grade 10."""
    assert client.patch("/me", json={"name": "Alex Mercer", "course": "MTH1W"}, headers=auth("alex")).status_code == 200
    files = [("files", ("p1.jpg", photo(), "image/jpeg"))]
    r = client.post("/submissions", data={"studentId": family["studentId"], "sharpnessScore": "82"},
                    files=files, headers=auth("alex"))
    done = client.post(f"/submissions/{r.json()['submissionId']}/process", headers=auth("alex")).json()
    assert done["submission"]["course"] == "MTH1W"


def test_student_can_switch_course_in_settings(client, family):
    r = client.patch("/me", json={"name": "Alex Mercer", "course": "bc.g8.math"}, headers=auth("alex"))
    assert r.status_code == 200 and r.json()["course"] == "bc.g8.math"
    assert client.patch("/me", json={"name": "Alex", "course": "bogus"}, headers=auth("alex")).status_code == 422
    # Parents have no course of their own; the field is ignored.
    r = client.patch("/me", json={"name": "Jordan", "course": "bc.g8.math"}, headers=auth("jordan"))
    assert r.status_code == 200 and not r.json().get("course")


@pytest.mark.parametrize("course, name", [
    ("MPM2D", "EQAO achievement level"), ("bc.g7.math", "BC proficiency scale"),
    ("ab.g9.math", "Alberta provincial standard"), ("qc.sec4.math", "Quebec mark"),
    ("ccss.g6.math", "State math test level"), ("eng.y6.math", "Key Stage 1–2 standard"),
    ("eng.y11.math", "GCSE grade (9 to 1)"), ("eng.y8.math", "Score range"),
    ("ib.dp1.math", "IB grade (1 to 7)"), ("ib.pyp3.math", "Score range"),
    ("ap.calc_bc.math", "AP score (1 to 5)"), ("ca_other.g5.math", "Score range"),
])
def test_forecast_uses_each_curriculums_own_scale(course, name):
    scale = C.forecast_scale(course)
    assert scale["name"] == name and len(scale["labels"]) == 4
