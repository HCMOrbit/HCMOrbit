"""Unit tests for the event URL auto-fill scraper."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from event_scraper import (
    _format_location,
    _format_organizer,
    _infer_event_type,
    _iso_date,
    _meta,
    _parse_jsonld_events,
    _regex_date_from_text,
    _time_from_iso,
)


def test_parse_jsonld_event_extracts_all_fields():
    html = """<script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"Workday Rising 2026","startDate":"2026-09-15T08:00:00-07:00",
     "location":{"@type":"Place","name":"Mandalay Bay","address":{"addressLocality":"Las Vegas","addressRegion":"NV"}},
     "organizer":{"@type":"Organization","name":"Workday Inc."}}
    </script>"""
    events = _parse_jsonld_events(html)
    assert len(events) == 1
    e = events[0]
    assert e["name"] == "Workday Rising 2026"
    assert _iso_date(e["startDate"]) == "2026-09-15"
    assert _time_from_iso(e["startDate"]) == "8:00 AM"
    assert _format_location(e["location"]) == "Mandalay Bay, Las Vegas, NV"
    assert _format_organizer(e["organizer"]) == "Workday Inc."


def test_parse_jsonld_handles_graph_wrapper():
    html = """<script type="application/ld+json">
    {"@graph":[{"@type":"Event","name":"Inner Event","startDate":"2026-01-01"}]}
    </script>"""
    events = _parse_jsonld_events(html)
    assert any(e.get("name") == "Inner Event" for e in events)


def test_parse_jsonld_ignores_non_events():
    html = """<script type="application/ld+json">{"@type":"Organization","name":"Workday"}</script>"""
    assert _parse_jsonld_events(html) == []


def test_parse_jsonld_swallows_bad_json():
    html = "<script type=\"application/ld+json\">{ not valid json }</script>"
    assert _parse_jsonld_events(html) == []


def test_meta_finds_og_tags_in_both_orderings():
    html_a = '<meta property="og:title" content="Hello">'
    html_b = '<meta content="World" property="og:title">'
    assert _meta(html_a, "property", "og:title") == "Hello"
    assert _meta(html_b, "property", "og:title") == "World"


def test_regex_date_picks_iso_first():
    assert _regex_date_from_text("Event on 2026-04-22 starts at noon") == "2026-04-22"


def test_regex_date_textual_long_month():
    assert _regex_date_from_text("Join us on March 15, 2026 at 4PM") == "2026-03-15"


def test_regex_date_textual_short_month_no_comma():
    assert _regex_date_from_text("Mark your calendar for Sep 3 2026 — see you there") == "2026-09-03"


def test_regex_date_ordinal_suffix():
    assert _regex_date_from_text("on January 3rd, 2026") == "2026-01-03"


def test_event_type_inference():
    assert _infer_event_type("Denver Workday RUG") == "RUG"
    assert _infer_event_type("Free webinar: Extend") == "Webinar"
    assert _infer_event_type("Workday Rising 2026") == "Conference"
    assert _infer_event_type("Some random title") == "Conference"  # default


def test_format_location_string_passthrough():
    assert _format_location("Online") == "Online"
    assert _format_location([{"@type": "VirtualLocation", "name": "Zoom"}]) == "Zoom"
    assert _format_location(None) is None


def test_iso_date_invalid_returns_none():
    assert _iso_date("not a date") is None
    assert _iso_date(None) is None
