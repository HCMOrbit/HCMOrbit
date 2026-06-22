"""Tests for the recurring / on-demand event behavior (the DMV-monthly fix)."""
from datetime import date

import pytest
from fastapi import HTTPException

from routes.ecosystem import (
    _annotate_event,
    _sort_key,
    _validate_event_temporal,
    compute_next_occurrence,
)


# ── compute_next_occurrence ────────────────────────────────────────────────

def test_next_weekly_rolls_forward_to_first_future_occurrence():
    # Seed: Wednesday 2026-01-07. Today: Friday 2026-01-30 → next Wednesday is 2026-02-04.
    assert compute_next_occurrence("2026-01-07", "weekly", today=date(2026, 1, 30)) == "2026-02-04"


def test_next_monthly_handles_day_clamp():
    # Seed: Jan 31. Today: Feb 1. Next: Feb 28 (clamped — Feb has no 31st).
    assert compute_next_occurrence("2026-01-31", "monthly", today=date(2026, 2, 1)) == "2026-02-28"


def test_next_monthly_nth_weekday_preserves_nth_position():
    # Seed: 2026-01-13 — 2nd Tuesday of Jan. Today: Feb 1. Next 2nd Tuesday = 2026-02-10.
    assert compute_next_occurrence("2026-01-13", "monthly_nth_weekday", today=date(2026, 2, 1)) == "2026-02-10"


def test_next_returns_seed_when_seed_is_in_future():
    assert compute_next_occurrence("2030-01-01", "monthly", today=date(2026, 1, 1)) == "2030-01-01"


# ── _validate_event_temporal ──────────────────────────────────────────────

def test_validation_rejects_event_with_no_date_and_no_on_demand():
    with pytest.raises(HTTPException) as exc:
        _validate_event_temporal({"date": "", "is_on_demand": False, "is_recurring": False})
    assert "date is required" in exc.value.detail


def test_validation_allows_on_demand_with_no_date():
    _validate_event_temporal({"date": "", "is_on_demand": True, "is_recurring": False})


def test_validation_rejects_recurring_without_rule():
    with pytest.raises(HTTPException):
        _validate_event_temporal({
            "date": "2026-06-17", "is_recurring": True,
            "recurrence_rule": None, "is_on_demand": False,
        })


def test_validation_rejects_recurring_and_on_demand_together():
    with pytest.raises(HTTPException):
        _validate_event_temporal({
            "date": "2026-06-17", "is_recurring": True,
            "recurrence_rule": "monthly", "is_on_demand": True,
        })


def test_validation_clears_recurrence_fields_when_not_recurring():
    doc = {
        "date": "2026-06-17", "is_recurring": False,
        "recurrence_rule": "monthly", "recurrence_end": "2027-01-01",
        "is_on_demand": False,
    }
    _validate_event_temporal(doc)
    assert doc["recurrence_rule"] is None
    assert doc["recurrence_end"] is None


# ── DMV monthly forum acceptance test ─────────────────────────────────────

def test_dmv_monthly_forum_stays_upcoming_with_correct_next_date():
    """DMV Workday community monthly forum: 1st Tuesday of every month, no end date.
    Stored seed 2026-01-06 (Tue). On 2026-02-20, must still be Upcoming and the
    next computed date is the first Tuesday of March 2026 = 2026-03-03.
    """
    ev = {
        "id": "evt_dmv", "title": "DMV monthly forum", "event_type": "RUG",
        "date": "2026-01-06", "is_recurring": True,
        "recurrence_rule": "monthly_nth_weekday", "recurrence_end": None,
        "is_on_demand": False, "is_published": True,
    }
    annotated = _annotate_event(ev, today=date(2026, 2, 20))
    assert annotated["is_past"] is False
    assert annotated["next_date"] == "2026-03-03"


def test_on_demand_event_never_falls_into_past():
    ev = {"id": "evt_x", "title": "Recorded webinar", "event_type": "Webinar",
          "date": None, "is_on_demand": True, "is_recurring": False, "is_published": True}
    annotated = _annotate_event(ev, today=date(2030, 1, 1))
    assert annotated["is_past"] is False
    assert annotated["next_date"] is None


def test_sort_pushes_on_demand_to_end():
    items = [
        {"id": "a", "is_on_demand": True},
        {"id": "b", "is_on_demand": False, "date": "2026-08-01", "next_date": "2026-08-01"},
        {"id": "c", "is_on_demand": False, "date": "2026-07-01", "next_date": "2026-07-01"},
    ]
    items.sort(key=_sort_key)
    assert [i["id"] for i in items] == ["c", "b", "a"]


def test_recurring_with_past_recurrence_end_is_past():
    ev = {
        "id": "evt_x", "title": "Ended series", "event_type": "RUG",
        "date": "2024-01-01", "is_recurring": True,
        "recurrence_rule": "monthly", "recurrence_end": "2025-06-01",
        "is_on_demand": False, "is_published": True,
    }
    annotated = _annotate_event(ev, today=date(2026, 1, 1))
    assert annotated["is_past"] is True
