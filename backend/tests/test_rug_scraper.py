"""Unit tests for jobs/rug_scraper.py (parsing helpers only — no live HTTP)."""
from bs4 import BeautifulSoup

from jobs.rug_scraper import (
    _build_event_doc,
    _format_location,
    _format_organizer,
    _heuristic_extract,
    _infer_event_type,
    _iso_date,
    _parse_jsonld_events,
    _time_from_iso,
)


JSONLD_FIXTURE = """
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Denver Workday RUG — Spring",
  "description": "Quarterly Denver chapter meetup for the Workday community.",
  "startDate": "2026-04-22T16:00:00-06:00",
  "url": "https://wdbeacon.com/events/denver-rug-spring-2026",
  "location": {
    "@type": "Place",
    "name": "Vail Resorts HQ",
    "address": {"@type": "PostalAddress", "addressLocality": "Broomfield", "addressRegion": "CO"}
  },
  "organizer": {"@type": "Organization", "name": "Syssero"}
}
</script>
</head><body></body></html>
"""

GRAPH_FIXTURE = """
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
  {"@type":"WebSite","name":"WDBeacon"},
  {"@type":"Event","name":"Dallas RUG","startDate":"2026-07-10","url":"https://wdbeacon.com/events/dallas-rug-2026"}
]}
</script>
"""

HEURISTIC_FIXTURE = """
<html><body>
<article>
  <h3>Chicago Workday User Group — Fall</h3>
  <p>Join us on October 14, 2026 at the Alight HQ for the autumn chapter meetup.</p>
  <a href="/events/chicago-rug-fall-2026">Register</a>
</article>
<article>
  <h3>Some Non-Event Link</h3>
  <a href="/about/team">About us</a>
</article>
</body></html>
"""


def test_iso_date_textual_and_iso():
    assert _iso_date("2026-04-22T16:00:00-06:00") == "2026-04-22"
    assert _iso_date("March 15, 2026") == "2026-03-15"
    assert _iso_date("Sep 3 2026") == "2026-09-03"
    assert _iso_date(None) is None
    assert _iso_date("nothing useful") is None


def test_time_from_iso():
    assert _time_from_iso("2026-04-22T16:00:00-06:00") == "4:00 PM"
    assert _time_from_iso("2026-04-22T09:30:00Z") == "9:30 AM"
    assert _time_from_iso(None) is None
    assert _time_from_iso("2026-04-22") is None  # no time portion


def test_event_type_inference_defaults_to_rug():
    assert _infer_event_type("Denver Workday RUG") == "RUG"
    assert _infer_event_type("Workday Extend Webinar") == "Webinar"
    assert _infer_event_type("Workday Rising 2026") == "Conference"
    assert _infer_event_type("Some neutral title") == "RUG"  # source default


def test_format_location_handles_dict_and_string():
    assert _format_location("Online") == "Online"
    assert _format_location({"name": "Vail Resorts", "address": {"addressLocality": "Broomfield", "addressRegion": "CO"}}) == "Vail Resorts, Broomfield, CO"
    assert _format_location(None) is None


def test_format_organizer_handles_dict_and_string():
    assert _format_organizer({"name": "Syssero"}) == "Syssero"
    assert _format_organizer("Workday Inc.") == "Workday Inc."
    assert _format_organizer(None) is None


def test_parse_jsonld_single_event():
    soup = BeautifulSoup(JSONLD_FIXTURE, "lxml")
    events = _parse_jsonld_events(soup)
    assert len(events) == 1
    assert events[0]["name"] == "Denver Workday RUG — Spring"


def test_parse_jsonld_graph_wrapper_picks_event_only():
    soup = BeautifulSoup(GRAPH_FIXTURE, "lxml")
    events = _parse_jsonld_events(soup)
    assert len(events) == 1
    assert events[0]["name"] == "Dallas RUG"


def test_build_event_doc_full_extraction():
    soup = BeautifulSoup(JSONLD_FIXTURE, "lxml")
    parsed = _parse_jsonld_events(soup)[0]
    doc = _build_event_doc(parsed, "https://wdbeacon.com/events")
    assert doc is not None
    assert doc["title"] == "Denver Workday RUG — Spring"
    assert doc["date"] == "2026-04-22"
    assert doc["time"] == "4:00 PM"
    assert doc["event_type"] == "RUG"
    assert doc["sponsor"] == "Syssero"
    assert doc["location"] == "Vail Resorts HQ, Broomfield, CO"
    assert doc["register_url"] == "https://wdbeacon.com/events/denver-rug-spring-2026"


def test_build_event_doc_missing_date_returns_none():
    doc = _build_event_doc({"name": "Some event", "url": "https://x.com/e/1"}, "https://x.com")
    assert doc is None


def test_heuristic_extract_finds_event_anchor():
    soup = BeautifulSoup(HEURISTIC_FIXTURE, "lxml")
    results = _heuristic_extract(soup, "https://wdbeacon.com/events")
    assert len(results) == 1
    r = results[0]
    assert r["register_url"] == "https://wdbeacon.com/events/chicago-rug-fall-2026"
    assert r["date"] == "2026-10-14"
    assert "Chicago" in r["title"]
    assert r["event_type"] == "RUG"
