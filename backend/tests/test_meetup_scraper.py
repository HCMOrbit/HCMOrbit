"""Unit tests for jobs/meetup_scraper.py — parsing + relevance filter only."""
from jobs.meetup_scraper import (
    _finalize_doc,
    _is_relevant,
    _normalize_graphql_event,
    _parse_jsonld_events_from_html,
)

JSONLD_HTML = """
<html><body>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Event",
 "name":"Workday HCM User Meetup",
 "startDate":"2026-04-22T18:00:00.000Z",
 "url":"https://www.meetup.com/workday-hcm-group/events/12345/",
 "organizer":{"@type":"Organization","name":"Workday HCM Group"},
 "location":{"@type":"Place","name":"Online"}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Event",
 "name":"Random Yoga Meetup",
 "startDate":"2026-04-23T10:00:00.000Z",
 "url":"https://www.meetup.com/yoga/events/67890/",
 "organizer":{"@type":"Organization","name":"Calm Yoga"}}
</script>
</body></html>
"""


def test_is_relevant_picks_workday_and_hcm_signals():
    assert _is_relevant("Workday user meetup", None, None) is True
    assert _is_relevant("HCM monthly chapter", None, None) is True
    assert _is_relevant("Generic meetup", "Workday HCM Group", None) is True
    assert _is_relevant("Generic", None, "Quarterly People Analytics review") is True


def test_is_relevant_filters_out_unrelated():
    assert _is_relevant("Yoga Meetup", "Calm Yoga", "morning poses") is False
    assert _is_relevant("Cooking class", None, None) is False


def test_parse_jsonld_events_from_html_finds_two():
    events = _parse_jsonld_events_from_html(JSONLD_HTML)
    assert len(events) == 2
    names = {e["name"] for e in events}
    assert "Workday HCM User Meetup" in names
    assert "Random Yoga Meetup" in names


def test_normalize_graphql_event_flattens_nested_fields():
    ev = {
        "title": "Boston Workday Meetup",
        "dateTime": "2026-05-01T17:00:00Z",
        "eventUrl": "https://www.meetup.com/boston-workday/events/999/",
        "description": "Quarterly Boston chapter.",
        "venue": {"name": "WeWork", "city": "Boston", "state": "MA"},
        "group": {"name": "Boston Workday Users", "urlname": "boston-workday"},
    }
    out = _normalize_graphql_event(ev)
    assert out["title"] == "Boston Workday Meetup"
    assert out["date"] == "2026-05-01"
    assert out["time"] == "5:00 PM"
    assert out["sponsor"] == "Boston Workday Users"
    assert out["location"] == "WeWork, Boston, MA"
    assert out["register_url"].endswith("/events/999/")


def test_finalize_doc_rejects_missing_essentials():
    assert _finalize_doc({"title": "X", "register_url": "https://x"}) is None  # no date
    assert _finalize_doc({"title": "X", "date": "2026-01-01"}) is None         # no url
    assert _finalize_doc({"register_url": "https://x", "date": "2026-01-01"}) is None  # no title


def test_finalize_doc_inserts_event_type():
    doc = _finalize_doc({"title": "Workday HCM Meetup", "date": "2026-05-01", "register_url": "https://example.com/e"})
    assert doc is not None
    # "meetup" keyword in title triggers RUG bucket
    assert doc["event_type"] == "RUG"
