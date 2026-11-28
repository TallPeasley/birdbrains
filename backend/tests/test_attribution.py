"""Where visitors and accounts come from (attribution.py and its routes)."""
from datetime import datetime, timezone

import pytest

from birdbrains import attribution as A

from conftest import auth

KEY = {"X-Growth-Key": "g-key"}


@pytest.fixture
def growth(deps):
    deps.growth_key = "g-key"
    return deps


@pytest.mark.parametrize("touch, expected", [
    (None, "Direct"),
    ({}, "Direct"),
    ({"ref": "ABC1234", "source": "google", "medium": "cpc"}, "Referral code"),
    ({"source": "google", "medium": "cpc"}, "Paid"),
    ({"clickIds": ["gclid"]}, "Paid"),
    ({"source": "newsletter", "medium": "email"}, "Email"),
    ({"source": "instagram"}, "Social"),
    ({"referrerHost": "l.facebook.com"}, "Social"),
    ({"referrerHost": "www.google.com"}, "Organic search"),
    ({"referrerHost": "schoolboard.example.ca"}, "Referral link"),
    ({"source": "flyer", "campaign": "fall"}, "Campaign"),
])
def test_channel(touch, expected):
    assert A.channel(touch) == expected


def test_signup_keeps_touches_and_referrer(client, growth):
    inviter = client.post("/me", json={"role": "parent", "name": "Pat"}, headers=auth("pat")).json()
    code = inviter["referralCode"]
    assert code and client.get("/me", headers=auth("pat")).json()["referralCode"] == code

    body = {"role": "student", "name": "Sam", "course": "ccss.g8.math", "attribution": {
        "first": {"source": "instagram", "medium": "social", "campaign": "back-to-school",
                  "landingPath": "/", "at": "2026-11-01T10:00:00Z"},
        "last": {"ref": code, "landingPath": "/plans"}}}
    r = client.post("/me", json=body, headers=auth("sam"))
    assert r.status_code in (200, 201), r.text
    stored = growth.store.get("users", "sam")
    assert stored["attribution"]["channel"] == "Social"  # credited to the first touch
    assert stored["attribution"]["first"]["campaign"] == "back-to-school"
    assert stored["referredBy"] == "pat"


def test_bad_touch_values_are_refused(client):
    body = {"role": "parent", "name": "X", "attribution": {"first": {"ref": "<script>"}}}
    assert client.post("/me", json=body, headers=auth("x")).status_code == 422


def test_visits_are_anonymous_and_once_a_day(client, growth):
    touch = {"source": "google", "medium": "cpc", "campaign": "launch", "landingPath": "/"}
    for _ in range(3):
        assert client.post("/attribution/visit", json={"visitorId": "v_" + "a" * 16, "touch": touch}).status_code == 204
    client.post("/attribution/visit", json={"visitorId": "v_" + "b" * 16, "touch": {"referrerHost": "www.bing.com"}})
    visits = growth.store.query_since("visits", "at", "2000-01-01")
    assert len(visits) == 2 and {v["channel"] for v in visits} == {"Paid", "Organic search"}
    assert all("ip" not in v and "userAgent" not in v for v in visits)
    assert client.post("/attribution/visit", json={"visitorId": "nope", "touch": {}}).status_code == 422


def test_dashboard_needs_the_growth_key(client, deps):
    assert client.get("/internal/attribution").status_code == 503  # not configured
    deps.growth_key = "g-key"
    assert client.get("/internal/attribution").status_code == 401
    assert client.get("/internal/attribution", headers={"X-Growth-Key": "wrong"}).status_code == 401
    # A signed-in user's token is not enough.
    assert client.get("/internal/attribution", headers=auth("someone")).status_code == 401


def test_dashboard_summary(client, growth):
    client.post("/attribution/visit", json={"visitorId": "v_" + "c" * 16,
                                            "touch": {"source": "google", "medium": "cpc", "campaign": "launch"}})
    client.post("/attribution/visit", json={"visitorId": "v_" + "d" * 16, "touch": {}})
    client.post("/me", json={"role": "parent", "name": "Ann", "attribution": {
        "first": {"source": "google", "medium": "cpc", "campaign": "launch"}}}, headers=auth("ann"))
    client.post("/me", json={"role": "student", "name": "Old", "course": "MPM2D"}, headers=auth("old"))
    s = client.get("/internal/attribution?days=7", headers=KEY).json()
    assert s["totals"]["visits"] == 2 and s["totals"]["signups"] == 2 and s["totals"]["conversion"] == 1.0
    ch = {c["channel"]: c for c in s["channels"]}
    assert ch["Paid"]["visits"] == 1 and ch["Paid"]["signups"] == 1 and ch["Paid"]["conversion"] == 1.0
    assert ch["Direct"]["signups"] == 1  # no attribution sent
    assert s["campaigns"][0]["campaign"] == "launch"
    assert s["daily"][-1]["signups"] == 2
    recent = s["recentSignups"]
    assert len(recent) == 2 and all("name" not in r and "uid" not in r for r in recent)
    assert client.get("/internal/attribution?days=0", headers=KEY).status_code == 422


def test_summary_window_and_paid():
    now = datetime(2026, 11, 28, 12, tzinfo=timezone.utc)
    users = [
        {"createdAt": "2026-11-27T10:00:00+00:00", "role": "parent", "plan": "pro",
         "attribution": {"first": {"ref": "ABC1234"}}},
        {"createdAt": "2026-10-01T10:00:00+00:00", "role": "student"},  # outside 7 days
    ]
    s = A.summary(users, [], 7, now)
    assert s["totals"]["signups"] == 1 and s["totals"]["paid"] == 1
    assert s["referralCodes"] == [{"code": "ABC1234", "signups": 1, "paid": 1}]
    assert s["totals"]["conversion"] is None  # no visits to divide by
    assert len(s["daily"]) == 8
