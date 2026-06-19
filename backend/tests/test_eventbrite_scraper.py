"""Unit tests for jobs/eventbrite_scraper.py — pure parsing helpers."""
from jobs.eventbrite_scraper import (
    EVENT_TYPE,
    ORGANIZER_URLS,
    STANDALONE_EVENT_URLS,
    _normalize_eventbrite_event,
    _organizer_id,
    _venue_to_location,
)


SAMPLE = {
    "name": {"text": "Workday Ireland RUG — Spring 2026"},
    "url": "https://www.eventbrite.com/e/workday-ireland-rug-spring-2026-tickets-9999999999",
    "start": {
        "utc": "2026-04-22T09:00:00Z",
        "local": "2026-04-22T10:00:00",
        "timezone": "Europe/Dublin",
        "formatted_time": "10:00 AM",
    },
    "end": {"utc": "2026-04-22T15:00:00Z", "local": "2026-04-22T16:00:00"},
    "description": {"text": "Insightful sessions and networking for the Workday community in Ireland."},
    "venue": {
        "name": "Fidelity Investments Ireland",
        "address": {"city": "Dublin", "region": "Leinster"},
    },
    "organizer": {"short_name": "Workday Regional User Group"},
    "is_online_event": False,
}


def test_curated_lists_are_present_and_typed():
    assert isinstance(ORGANIZER_URLS, list) and len(ORGANIZER_URLS) >= 2
    assert isinstance(STANDALONE_EVENT_URLS, list) and len(STANDALONE_EVENT_URLS) >= 1
    assert EVENT_TYPE == "RUG"


def test_organizer_id_parses_trailing_digits():
    assert _organizer_id("https://www.eventbrite.com/o/workday-regional-user-group-14235725376") == "14235725376"
    assert _organizer_id("https://www.eventbrite.com/o/denver-regional-user-group-9456554733/") == "9456554733"


def test_organizer_id_returns_none_for_invalid_url():
    assert _organizer_id("https://www.eventbrite.com/o/no-id-here") is None


def test_venue_to_location_joins_name_city_region():
    assert _venue_to_location({"name": "Fidelity Investments", "address": {"city": "Dublin", "region": "Leinster"}}) \
        == "Fidelity Investments, Dublin, Leinster"


def test_venue_to_location_handles_missing_pieces():
    assert _venue_to_location({"name": "Online HQ"}) == "Online HQ"
    assert _venue_to_location({"address": {"city": "Boston"}}) == "Boston"
    assert _venue_to_location(None) is None
    assert _venue_to_location({}) is None


def test_normalize_eventbrite_event_full():
    doc = _normalize_eventbrite_event(SAMPLE)
    assert doc is not None
    assert doc["event_type"] == "RUG"   # forced for this source
    assert doc["title"] == "Workday Ireland RUG — Spring 2026"
    assert doc["date"] == "2026-04-22"
    assert doc["time"] == "10:00 AM"
    assert doc["sponsor"] == "Workday Regional User Group"
    assert doc["location"] == "Fidelity Investments Ireland, Dublin, Leinster"
    assert "tickets-9999999999" in doc["register_url"]
    assert "Insightful sessions" in doc["description"]


def test_normalize_eventbrite_event_online():
    online = {**SAMPLE, "is_online_event": True, "venue": None}
    doc = _normalize_eventbrite_event(online)
    assert doc is not None
    assert doc["location"] == "Online"


def test_normalize_eventbrite_event_falls_back_to_iso_time():
    bare = {
        "name": {"text": "Bare event"},
        "url": "https://www.eventbrite.com/e/bare-tickets-1",
        "start": {"utc": "2026-05-01T17:00:00Z"},   # no formatted_time
    }
    doc = _normalize_eventbrite_event(bare)
    assert doc is not None
    assert doc["date"] == "2026-05-01"
    assert doc["time"] == "5:00 PM"


def test_normalize_rejects_missing_essentials():
    assert _normalize_eventbrite_event({"url": "x", "start": {"utc": "2026-01-01"}}) is None   # no name
    assert _normalize_eventbrite_event({"name": {"text": "x"}, "start": {"utc": "2026-01-01"}}) is None  # no url
    assert _normalize_eventbrite_event({"name": {"text": "x"}, "url": "https://x"}) is None    # no start
