"""Tests for the Workday relevance scorer."""
import pytest

from services.news_scoring import compute_workday_score, status_for_score


def score_only(**kw):
    s, _ = compute_workday_score(**kw)
    return s


class TestPublishTier:
    """Score >= 80 → auto-publish."""

    def test_workday_owned_blog_publishes(self):
        s = score_only(
            title="Workday launches new HCM Payroll module",
            summary="Workday today announced a new Payroll experience for HCM customers.",
            url="https://blog.workday.com/en-us/2026/hcm-payroll.html",
        )
        assert s >= 80, f"expected publish tier, got {s}"
        assert status_for_score(s) == "published"

    def test_partner_customer_go_live(self):
        s = score_only(
            title="Kainos delivers Workday HCM go-live for global bank",
            summary="Kainos completed a Workday HCM and Payroll implementation for a Fortune 500 bank, marking a major customer go-live.",
            url="https://kainos.com/insights/workday-bank-go-live",
        )
        assert status_for_score(s) == "published"


class TestReviewTier:
    """Score 60..79 → pending admin review."""

    def test_workday_title_generic_source(self):
        s = score_only(
            title="Workday earnings beat Wall Street forecasts",
            summary="Software maker reports strong quarterly results.",
            url="https://uctoday.com/news/workday-earnings/",
        )
        assert 60 <= s <= 79, f"expected review tier, got {s}"
        assert status_for_score(s) == "pending_review"


class TestRejectTier:
    """Score < 60 → reject."""

    def test_generic_hr_tech_no_workday(self):
        s = score_only(
            title="How AI is reshaping HR technology in 2026",
            summary="Artificial intelligence and machine learning are transforming HR tech, cloud computing, and employee experience across industries.",
            url="https://hrexecutive.com/how-ai-hr-tech/",
        )
        assert s < 60, f"expected reject tier, got {s}"
        assert status_for_score(s) == "rejected"

    def test_competitor_focus_rejects(self):
        s = score_only(
            title="SAP SuccessFactors rolls out new Recruiting module",
            summary="SAP announced new Recruiting features for its SuccessFactors platform.",
            url="https://hrexecutive.com/sap-successfactors-recruiting/",
        )
        assert s < 60, f"expected reject tier for competitor story, got {s}"

    def test_generic_partner_blog_without_workday_rejects(self):
        # Deloitte is a partner domain but the article is about generic HR tech.
        s = score_only(
            title="The future of work in the age of AI",
            summary="Cloud computing, digital transformation, remote work, and DEI define the new employee experience.",
            url="https://deloitte.com/insights/future-of-work",
        )
        assert s < 60


class TestBreakdownIsPresent:
    def test_breakdown_reasons_are_returned(self):
        score, br = compute_workday_score(
            title="Workday launches Extend Marketplace",
            summary="Workday's Extend platform now supports third-party integrations.",
            url="https://blog.workday.com/en-us/extend-marketplace.html",
        )
        assert "_reasons" in br and isinstance(br["_reasons"], list)
        assert br["_reasons"], "reasons should not be empty for a high-scoring article"
        # Score signals we expect on this article
        assert br.get("title_workday") == 50
        assert br.get("workday_owned_source") == 50


class TestHardCap:
    def test_no_workday_mention_capped_at_25(self):
        # No Workday mention anywhere → cannot exceed 25 regardless of signals.
        score, _ = compute_workday_score(
            title="Payroll and HCM systems modernized at global retailer",
            summary="A major retailer implemented new payroll and HCM software.",
            url="https://uctoday.com/payroll-modernization",
        )
        assert score <= 25, f"expected hard cap ≤ 25, got {score}"


class TestScoreClamping:
    def test_score_never_exceeds_100(self):
        # Even a maximally-Workday-y article should clamp to 100.
        score, _ = compute_workday_score(
            title="Workday launches Workday Extend, Workday Prism, Workday HCM, Workday Payroll",
            summary=(
                "Workday today announced Workday Extend, Workday Prism, Workday HCM, "
                "Workday Payroll, Workday Recruiting, Workday Financials. Workday customers "
                "including Workday partners will benefit from this Workday product launch."
            ),
            url="https://blog.workday.com/mega-launch",
        )
        assert score == 100

    def test_score_never_below_zero(self):
        # Heavy penalties should still clamp to 0.
        score, _ = compute_workday_score(
            title="SuccessFactors, Oracle HCM, and Dayforce compared: AI in HR tech",
            summary="Artificial intelligence, cloud computing, DEI, remote work, HR tech, digital transformation.",
            url="https://example.com/competitor-piece",
        )
        assert 0 <= score < 60
