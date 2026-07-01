"""Seed script for Industry Pulse intelligence collections.

Generates realistic *sample* data across 8 industries × 14 modules following the
per-industry emphasis matrix specified in the product spec. Every seeded doc is
tagged `status: "sample_data"` so the UI can display the disclaimer badge and
the crawler (Phase 2) can safely replace these rows with real signals without
disturbing admin-approved records.

Idempotent: safe to run on every startup — clears + re-seeds only rows whose
`status == "sample_data"`. Manually approved rows (`status == "approved"`) are
preserved.
"""
from __future__ import annotations

import hashlib
import random
import uuid
from datetime import datetime, timedelta, timezone

# --- Canonical vocabularies ---------------------------------------------------
INDUSTRIES = [
    "Healthcare",
    "Financial Services",
    "Retail",
    "Technology",
    "Manufacturing",
    "Public Sector",
    "Higher Education",
    "Professional Services",
]

MODULES = [
    "Core HCM",
    "Payroll",
    "Financials",
    "Absence",
    "Recruiting",
    "Time Tracking",
    "Benefits",
    "Talent & Performance",
    "Learning",
    "Prism Analytics",
    "Workday Extend",
    "Workday AI / Illuminate",
    "Integrations",
    "Security",
]

ROLES = [
    "Workday HCM Consultant",
    "Workday Payroll Consultant",
    "Workday Integration Consultant",
    "Workday Security Analyst",
    "Workday Reporting Analyst",
    "Workday Financials Consultant",
    "Workday Extend Developer",
    "Workday AI / Prism Analyst",
]

# --- Per-industry emphasis map ------------------------------------------------
# Modules named here get boosted adoption scores (high_adoption ~65-80%). All
# other modules fall back to a broad distribution. Order is intentional and
# used to rank the "High demand modules" card.
INDUSTRY_HIGH_DEMAND: dict[str, list[str]] = {
    "Healthcare":            ["Core HCM", "Payroll", "Absence", "Benefits", "Security"],
    "Financial Services":    ["Financials", "Security", "Prism Analytics", "Talent & Performance", "Core HCM"],
    "Retail":                ["Recruiting", "Time Tracking", "Payroll", "Learning", "Talent & Performance"],
    "Manufacturing":         ["Time Tracking", "Payroll", "Learning", "Core HCM", "Integrations"],
    "Technology":            ["Workday Extend", "Workday AI / Illuminate", "Prism Analytics", "Integrations", "Security"],
    "Public Sector":         ["Core HCM", "Payroll", "Recruiting", "Security", "Prism Analytics"],
    "Higher Education":      ["Recruiting", "Learning", "Talent & Performance", "Payroll", "Security"],
    "Professional Services": ["Talent & Performance", "Financials", "Integrations", "Prism Analytics", "Time Tracking"],
}

# Second-tier: common but not featured. Falls between high demand and long tail.
INDUSTRY_MEDIUM_ADOPTION: dict[str, list[str]] = {
    "Healthcare":            ["Recruiting", "Time Tracking", "Talent & Performance"],
    "Financial Services":    ["Payroll", "Recruiting", "Integrations"],
    "Retail":                ["Core HCM", "Benefits", "Absence"],
    "Manufacturing":         ["Recruiting", "Security", "Benefits"],
    "Technology":            ["Core HCM", "Talent & Performance", "Recruiting"],
    "Public Sector":         ["Absence", "Benefits", "Time Tracking"],
    "Higher Education":      ["Core HCM", "Absence", "Prism Analytics"],
    "Professional Services": ["Core HCM", "Payroll", "Recruiting"],
}

INDUSTRY_SUMMARY: dict[str, str] = {
    "Healthcare": "Healthcare organizations continue to invest in people, finance, and analytics capabilities to drive efficiency, compliance, and patient-centric outcomes.",
    "Financial Services": "Banks, insurers, and asset managers are modernizing finance and workforce planning while doubling down on audit, controls, and analytics.",
    "Retail": "Retailers are competing on scheduling, hourly workforce management, and store-level talent development while modernizing payroll and learning.",
    "Manufacturing": "Manufacturers are investing in time tracking, learning, and integrations to connect shop-floor systems with global HCM and payroll platforms.",
    "Technology": "Tech companies lead adoption of Workday Extend, AI/Illuminate, Prism Analytics, and integrations — using Workday as a platform, not just a system of record.",
    "Public Sector": "Federal, state, and local government agencies focus on Core HCM modernization, payroll, recruiting, and audit-ready reporting under strict compliance requirements.",
    "Higher Education": "Universities and research institutions prioritize recruiting, learning, talent, and payroll for a mixed workforce of faculty, staff, and students.",
    "Professional Services": "Consulting, legal, and engineering firms center around resource management, financials, integrations, and utilization reporting to run the business.",
}

INDUSTRY_TRENDS: dict[str, list[dict]] = {
    "Healthcare": [
        {"title": "AI-driven workforce productivity", "description": "Growing investment in Illuminate and AI-driven automation.", "icon": "sparkles"},
        {"title": "Labor cost management", "description": "Strong focus on workforce planning and cost optimization.", "icon": "banknote"},
        {"title": "Regulatory & compliance", "description": "Increased demand for audit, privacy, and data governance.", "icon": "shield"},
        {"title": "Contingent workforce", "description": "Growing reliance on contingent clinicians and travel staff.", "icon": "users"},
    ],
    "Financial Services": [
        {"title": "Audit & SoD redesign", "description": "Segregation of duties and audit trails are top-of-mind for CFOs.", "icon": "shield"},
        {"title": "Financials modernization", "description": "Multi-entity consolidations moving from legacy to Workday Financials.", "icon": "banknote"},
        {"title": "Analytics & reporting maturity", "description": "Prism becoming the enterprise reporting layer for people + finance.", "icon": "chart"},
        {"title": "Regulatory compliance", "description": "Basel, SOX, and regional financial-services rules driving controls investment.", "icon": "gavel"},
    ],
    "Retail": [
        {"title": "Store scheduling", "description": "Time Tracking + scheduling seen as a hiring differentiator.", "icon": "clock"},
        {"title": "Frontline talent development", "description": "Learning + Talent replacing manual store training.", "icon": "sparkles"},
        {"title": "Payroll modernization", "description": "Consolidating payroll across geographies for hourly workforces.", "icon": "banknote"},
        {"title": "Recruiting velocity", "description": "Reducing time-to-hire for high-volume store roles.", "icon": "users"},
    ],
    "Manufacturing": [
        {"title": "Shop floor integrations", "description": "Time and attendance flowing into Workday from MES and IIoT.", "icon": "plug"},
        {"title": "Skills & learning", "description": "Skills-based workforce planning tied to manufacturing certifications.", "icon": "sparkles"},
        {"title": "Global payroll consolidation", "description": "Moving to a single payroll platform across regions.", "icon": "banknote"},
        {"title": "Safety compliance", "description": "Audit-ready training and certification tracking.", "icon": "shield"},
    ],
    "Technology": [
        {"title": "Workday as a platform", "description": "Heavy Extend adoption to build custom apps on top of Workday.", "icon": "code"},
        {"title": "AI / Illuminate pilots", "description": "Early adopters running Illuminate agents across HR workflows.", "icon": "sparkles"},
        {"title": "Data mesh with Prism", "description": "Prism as a shared analytics layer across HR + Finance.", "icon": "chart"},
        {"title": "Integration-first architecture", "description": "Workday as a hub in a broader integration fabric.", "icon": "plug"},
    ],
    "Public Sector": [
        {"title": "HCM modernization", "description": "Replacing decades-old HRIS with Workday Core HCM.", "icon": "building"},
        {"title": "Recruiting & talent pipelines", "description": "Public workforce shortages driving recruiting investment.", "icon": "users"},
        {"title": "Compliance-driven security", "description": "FedRAMP, StateRAMP, and mandate-driven security posture.", "icon": "shield"},
        {"title": "Position management rigor", "description": "Strict FTE / position-control workflows for headcount governance.", "icon": "gavel"},
    ],
    "Higher Education": [
        {"title": "Faculty + staff + student HR", "description": "One platform for mixed-population workforce management.", "icon": "users"},
        {"title": "Learning + credentialing", "description": "Continuing education and academic credential workflows.", "icon": "sparkles"},
        {"title": "Recruiting automation", "description": "Reducing manual work in academic hiring committees.", "icon": "users"},
        {"title": "Grant-funded position tracking", "description": "Finance-aware position management for funded roles.", "icon": "banknote"},
    ],
    "Professional Services": [
        {"title": "Resource management & utilization", "description": "PSA-style workforce planning tied to project financials.", "icon": "users"},
        {"title": "Client-billable time & expense", "description": "Time Tracking + Financials integrated for revenue recognition.", "icon": "clock"},
        {"title": "Prism-powered utilization reporting", "description": "Firm-wide dashboards for partners and practice leads.", "icon": "chart"},
        {"title": "Talent development for consultants", "description": "Skill graphs and career pathing at the individual level.", "icon": "sparkles"},
    ],
}

# Realistic customer archetypes (no real trademarks). Format: (customer, region).
GO_LIVE_ARCHETYPES: dict[str, list[tuple[str, str]]] = {
    "Healthcare": [
        ("Major Regional Health System", "Americas"), ("Northern Medical Network", "Americas"),
        ("Coastal Public Hospitals", "EMEA"), ("Southern Health Alliance", "Americas"),
        ("Pediatric Research Center", "Americas"), ("National Care Group", "EMEA"),
        ("Metropolitan Health Trust", "EMEA"), ("Pacific Health Systems", "APAC"),
        ("Cardiovascular Institute", "Americas"), ("Community Health Network", "Americas"),
        ("Rural Hospitals Consortium", "Americas"), ("Regional Cancer Alliance", "EMEA"),
        ("Urban Medical Group", "Americas"), ("Wellness Health Partners", "APAC"),
        ("Continental Care Systems", "EMEA"), ("Integrated Care Network", "Americas"),
    ],
    "Financial Services": [
        ("Regional Bank Corp", "Americas"), ("National Insurance Group", "EMEA"),
        ("Global Asset Managers", "Americas"), ("Community Credit Union", "Americas"),
        ("Continental Insurance", "EMEA"), ("Wealth Advisory Partners", "Americas"),
        ("Investment Services Ltd", "EMEA"), ("Cross-Border Payments Co", "APAC"),
        ("Retail Banking Holdings", "Americas"), ("Reinsurance Group Intl", "EMEA"),
        ("Fintech Growth Ventures", "Americas"), ("Sovereign Wealth Trust", "APAC"),
        ("Mutual Life Insurance", "Americas"), ("Trade Finance Partners", "EMEA"),
        ("Merchant Banking Ltd", "APAC"), ("Regional Credit Group", "Americas"),
    ],
    "Retail": [
        ("National Grocery Chain", "Americas"), ("Fashion Retail Holdings", "EMEA"),
        ("Home Improvement Co-op", "Americas"), ("Specialty Sports Retailers", "Americas"),
        ("Beauty & Wellness Group", "APAC"), ("Continental Retail Alliance", "EMEA"),
        ("Discount Retail Corp", "Americas"), ("Luxury Goods Holdings", "EMEA"),
        ("Convenience Store Network", "Americas"), ("Electronics Retail Group", "APAC"),
        ("Pet & Home Retail", "Americas"), ("Regional Grocery Alliance", "EMEA"),
        ("Fast-Fashion Global", "APAC"), ("Outdoor Adventure Retail", "Americas"),
        ("Departmental Store Group", "EMEA"), ("Digital-First Retail Co", "Americas"),
    ],
    "Manufacturing": [
        ("Aerospace Components Ltd", "Americas"), ("Automotive Parts Group", "EMEA"),
        ("Industrial Automation Co", "APAC"), ("Consumer Electronics Mfg", "APAC"),
        ("Chemicals & Polymers Intl", "EMEA"), ("Precision Instruments Co", "Americas"),
        ("Food & Beverage Producers", "Americas"), ("Steel & Metals Holdings", "EMEA"),
        ("Semiconductor Fab Group", "APAC"), ("Packaging Systems Ltd", "EMEA"),
        ("Machinery Manufacturing Co", "Americas"), ("Textile Producers Group", "APAC"),
        ("Building Materials Corp", "Americas"), ("Electrical Equipment Ltd", "EMEA"),
        ("Renewable Energy Systems", "Americas"), ("Advanced Composites Co", "APAC"),
    ],
    "Technology": [
        ("Cloud Platform Ventures", "Americas"), ("SaaS Growth Group", "Americas"),
        ("Cybersecurity Holdings", "EMEA"), ("Devops Tools Ltd", "Americas"),
        ("AI Research Labs", "Americas"), ("Semiconductor Design Co", "APAC"),
        ("Enterprise Software Corp", "Americas"), ("Cloud Infrastructure Ltd", "EMEA"),
        ("Data Platform Ventures", "Americas"), ("Mobile Apps Holdings", "APAC"),
        ("Fintech Software Group", "Americas"), ("Gaming Studios Intl", "EMEA"),
        ("Digital Advertising Co", "Americas"), ("Video Streaming Ventures", "Americas"),
        ("Analytics Startups Group", "APAC"), ("Cloud Security Ltd", "EMEA"),
    ],
    "Public Sector": [
        ("State Government Agency", "Americas"), ("Federal Services Bureau", "Americas"),
        ("Municipal Services Authority", "EMEA"), ("Regional Transit Authority", "Americas"),
        ("Public Safety Department", "Americas"), ("National Statistics Office", "EMEA"),
        ("Ministry of Health Systems", "APAC"), ("Environmental Agency", "EMEA"),
        ("Public Utilities Commission", "Americas"), ("City Government Services", "Americas"),
        ("National Postal Service", "EMEA"), ("Immigration Services Dept", "Americas"),
        ("Public Works Authority", "APAC"), ("Regional Housing Board", "Americas"),
        ("National Archives Bureau", "EMEA"), ("Public Library System", "Americas"),
    ],
    "Higher Education": [
        ("State Public University", "Americas"), ("Regional Community College", "Americas"),
        ("Private Research University", "Americas"), ("Continental University Network", "EMEA"),
        ("Technical Institute Group", "APAC"), ("Liberal Arts College Consortium", "Americas"),
        ("Metropolitan University", "EMEA"), ("Medical School Alliance", "Americas"),
        ("Business School Holdings", "APAC"), ("Engineering Institute", "EMEA"),
        ("Arts & Design College", "Americas"), ("Agricultural University", "Americas"),
        ("Online Learning Network", "Americas"), ("Graduate Studies Ltd", "EMEA"),
        ("Community College District", "Americas"), ("Polytechnic Institute", "APAC"),
    ],
    "Professional Services": [
        ("Global Consulting Group", "Americas"), ("Legal Services Partners", "EMEA"),
        ("Engineering Consultants Ltd", "Americas"), ("Advisory Services Intl", "EMEA"),
        ("Audit & Tax Partners", "Americas"), ("Management Consulting Co", "APAC"),
        ("Architecture Firm Group", "EMEA"), ("Technology Consultants Ltd", "Americas"),
        ("Marketing Services Holdings", "Americas"), ("Design Studio Network", "EMEA"),
        ("Talent Consulting Partners", "Americas"), ("Financial Advisory Ltd", "APAC"),
        ("Real Estate Advisory", "EMEA"), ("Public Relations Group", "Americas"),
        ("Research & Strategy Ltd", "APAC"), ("Executive Search Partners", "Americas"),
    ],
}


def _det_rand(*keys) -> random.Random:
    """Deterministic RNG per key tuple — same input yields same output every run."""
    h = hashlib.sha256(("|".join(str(k) for k in keys)).encode()).hexdigest()
    return random.Random(int(h[:16], 16))


def _split_100(rng: random.Random, high_lo: int, high_hi: int, adopting_lo: int, adopting_hi: int) -> tuple[int, int, int]:
    """Pick high/adopting/early triple that sums to 100."""
    high = rng.randint(high_lo, high_hi)
    adopting = rng.randint(adopting_lo, min(adopting_hi, 100 - high - 3))
    early = 100 - high - adopting
    return high, adopting, max(0, early)


def _demand_from_high(high: int) -> str:
    if high >= 65: return "Very High"
    if high >= 50: return "High"
    if high >= 30: return "Medium"
    return "Emerging"


def _trend_from_scores(rng: random.Random, high: int) -> str:
    """Trend arrow: up/flat/down. Higher-adoption modules trend up more often."""
    r = rng.random()
    if high >= 60:
        return "up" if r < 0.75 else "flat"
    if high >= 35:
        return "up" if r < 0.55 else ("flat" if r < 0.85 else "down")
    return "up" if r < 0.6 else ("flat" if r < 0.85 else "down")


# --- Public entrypoint -------------------------------------------------------
async def seed_intel(db, now_iso_fn):
    """Idempotent — clears sample rows and regenerates. Preserves approved rows."""
    now = now_iso_fn()

    # 1) Module adoption scores — 14 modules × 8 industries = 112 records.
    await db.intel_module_scores.delete_many({"status": "sample_data"})
    # Preserve admin-overridden (approved) rows: skip (industry, module) pairs
    # that already exist with status != sample_data.
    approved_pairs = set()
    async for r in db.intel_module_scores.find({"status": {"$ne": "sample_data"}}, {"industry": 1, "module": 1, "_id": 0}):
        approved_pairs.add((r["industry"], r["module"]))
    module_docs = []
    for industry in INDUSTRIES:
        high_set = INDUSTRY_HIGH_DEMAND[industry]
        med_set = INDUSTRY_MEDIUM_ADOPTION[industry]
        for module in MODULES:
            if (industry, module) in approved_pairs:
                continue
            rng = _det_rand("adoption", industry, module)
            if module in high_set:
                high, adopting, early = _split_100(rng, 60, 80, 15, 30)
            elif module in med_set:
                high, adopting, early = _split_100(rng, 40, 55, 25, 35)
            else:
                high, adopting, early = _split_100(rng, 15, 30, 22, 34)
            module_docs.append({
                "id": str(uuid.uuid4()),
                "industry": industry,
                "module": module,
                "high_adoption_percent": high,
                "adopting_percent": adopting,
                "early_adoption_percent": early,
                "demand_level": _demand_from_high(high),
                "trend_direction": _trend_from_scores(rng, high),
                "confidence_score": rng.randint(55, 82),
                "status": "sample_data",
                "last_calculated_at": now,
            })
    if module_docs:
        await db.intel_module_scores.insert_many(module_docs)

    # 2) Customer go-lives — 15-20 per industry.
    await db.intel_go_lives.delete_many({"status": "sample_data"})
    go_live_docs = []
    for industry in INDUSTRIES:
        archetypes = GO_LIVE_ARCHETYPES[industry]
        high_set = INDUSTRY_HIGH_DEMAND[industry]
        med_set = INDUSTRY_MEDIUM_ADOPTION[industry]
        for i, (customer, region) in enumerate(archetypes):
            rng = _det_rand("golive", industry, i, customer)
            # 2-4 modules from high-set + occasional medium
            n_modules = rng.randint(2, 4)
            pool = high_set + med_set
            modules = rng.sample(pool, min(n_modules, len(pool)))
            days_ago = rng.randint(7, 240)
            announce_date = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d")
            go_live_docs.append({
                "id": str(uuid.uuid4()),
                "customer_name": customer,
                "industry": industry,
                "region": region,
                "modules": modules,
                "source_url": f"https://example.com/press/{industry.lower().replace(' ', '-')}/{i}",
                "source_name": rng.choice(["Press Release", "Partner Announcement", "Customer Story", "Public Blog"]),
                "announcement_date": announce_date,
                "confidence_score": rng.randint(60, 88),
                "status": "sample_data",
                "created_at": now,
            })
    if go_live_docs:
        await db.intel_go_lives.insert_many(go_live_docs)

    # 3) Hiring signals — 8 roles × 8 industries, aggregated demand.
    await db.intel_hiring_signals.delete_many({"status": "sample_data"})
    hiring_docs = []
    # Role → the module it most strongly signals for
    role_module = {
        "Workday HCM Consultant": "Core HCM",
        "Workday Payroll Consultant": "Payroll",
        "Workday Integration Consultant": "Integrations",
        "Workday Security Analyst": "Security",
        "Workday Reporting Analyst": "Prism Analytics",
        "Workday Financials Consultant": "Financials",
        "Workday Extend Developer": "Workday Extend",
        "Workday AI / Prism Analyst": "Workday AI / Illuminate",
    }
    for industry in INDUSTRIES:
        high_set = INDUSTRY_HIGH_DEMAND[industry]
        med_set = INDUSTRY_MEDIUM_ADOPTION[industry]
        for role, module in role_module.items():
            rng = _det_rand("hire", industry, role)
            if module in high_set:
                job_count = rng.randint(180, 480)
                demand = rng.choice(["Very High", "High"])
            elif module in med_set:
                job_count = rng.randint(80, 200)
                demand = rng.choice(["High", "Medium"])
            else:
                job_count = rng.randint(20, 90)
                demand = rng.choice(["Medium", "Emerging"])
            hiring_docs.append({
                "id": str(uuid.uuid4()),
                "industry": industry,
                "role": role,
                "primary_module": module,
                "job_count": job_count,
                "demand_level": demand,
                "trend_direction": _trend_from_scores(rng, 60 if module in high_set else 40),
                "confidence_score": rng.randint(55, 80),
                "status": "sample_data",
                "last_calculated_at": now,
            })
    if hiring_docs:
        await db.intel_hiring_signals.insert_many(hiring_docs)

    # 4) Trends per industry.
    await db.intel_trends.delete_many({"status": "sample_data"})
    trend_docs = []
    for industry, trends in INDUSTRY_TRENDS.items():
        for rank, t in enumerate(trends, start=1):
            trend_docs.append({
                "id": str(uuid.uuid4()),
                "industry": industry,
                "rank": rank,
                "title": t["title"],
                "description": t["description"],
                "icon": t["icon"],
                "status": "sample_data",
                "created_at": now,
            })
    if trend_docs:
        await db.intel_trends.insert_many(trend_docs)

    # 5) Events — 12 total, industry-tagged (some cross-industry).
    await db.intel_events.delete_many({"status": "sample_data"})
    upcoming_base = datetime.now(timezone.utc) + timedelta(days=20)
    events_seed = [
        ("Workday Rising 2026", "Conference", 0, "Las Vegas, NV", False, INDUSTRIES),
        ("Healthcare Workday RUG Meetup", "RUG", 14, "Virtual", True, ["Healthcare"]),
        ("Financial Services Workday Summit", "Partner Event", 22, "New York, NY", False, ["Financial Services"]),
        ("Retail Workforce Innovation Webinar", "Webinar", 8, "Virtual", True, ["Retail"]),
        ("Manufacturing Time & Attendance Best Practices", "Webinar", 35, "Virtual", True, ["Manufacturing"]),
        ("Workday Extend Developer Days", "Conference", 45, "San Francisco, CA", False, ["Technology"]),
        ("Public Sector Compliance Workshop", "Workshop", 60, "Washington, DC", False, ["Public Sector"]),
        ("Higher Ed Workday User Group", "RUG", 30, "Chicago, IL", False, ["Higher Education"]),
        ("Professional Services Firms Roundtable", "Roundtable", 42, "Virtual", True, ["Professional Services"]),
        ("Workday AI/Illuminate Deep Dive", "Webinar", 12, "Virtual", True, ["Technology", "Healthcare", "Financial Services"]),
        ("Prism Analytics Workshop", "Workshop", 28, "Boston, MA", False, ["Financial Services", "Technology", "Professional Services"]),
        ("Global Payroll Community Summit", "Conference", 55, "London, UK", False, ["Manufacturing", "Retail", "Public Sector"]),
    ]
    event_docs = []
    for title, ev_type, day_offset, loc, virtual, ind_tags in events_seed:
        start = upcoming_base + timedelta(days=day_offset)
        rng = _det_rand("event", title)
        event_docs.append({
            "id": str(uuid.uuid4()),
            "title": title,
            "event_type": ev_type,
            "start_date": start.strftime("%Y-%m-%d"),
            "end_date": (start + timedelta(days=rng.randint(0, 3))).strftime("%Y-%m-%d"),
            "location": loc,
            "virtual": virtual,
            "registration_url": f"https://example.com/events/{title.lower().replace(' ', '-').replace('/', '-')}",
            "source_url": f"https://example.com/events/{title.lower().replace(' ', '-').replace('/', '-')}",
            "industry_tags": ind_tags,
            "module_tags": [],
            "status": "sample_data",
            "created_at": now,
        })
    if event_docs:
        await db.intel_events.insert_many(event_docs)

    # 6) Source registry — seed 8 example public sources.
    await db.intel_sources.delete_many({"status": "sample_data"})
    sources_seed = [
        ("Workday Press Releases", "press_release", "https://www.workday.com/en-us/company/newsroom/press-releases.html", "weekly", True),
        ("Workday Blog", "blog", "https://blog.workday.com/", "weekly", True),
        ("Workday Rising Events", "event", "https://www.workday.com/en-us/events/workday-rising.html", "weekly", True),
        ("Workday Community RUG Directory (Public)", "rug", "https://community.workday.com/rugs-public", "weekly", False),
        ("Workday Partner Announcements", "partner", "https://www.workday.com/en-us/partners.html", "weekly", True),
        ("LinkedIn Public Jobs (Workday)", "job_board", "https://www.linkedin.com/jobs/search/?keywords=workday", "daily", False),
        ("Indeed Public Jobs (Workday)", "job_board", "https://www.indeed.com/jobs?q=Workday", "daily", False),
        ("Workday Customer Stories (Public)", "customer_story", "https://www.workday.com/en-us/customer-stories.html", "weekly", True),
    ]
    source_docs = []
    for name, s_type, url, freq, enabled in sources_seed:
        source_docs.append({
            "id": str(uuid.uuid4()),
            "source_name": name,
            "source_type": s_type,
            "source_url": url,
            "crawl_frequency": freq,
            "enabled": enabled,
            "last_crawled_at": None,
            "last_status": "never_run",
            "reliability_score": 85 if s_type in ("press_release", "customer_story", "event") else 65,
            "notes": "Phase 2 target — pending crawler implementation.",
            "status": "sample_data",
            "created_at": now,
            "updated_at": now,
        })
    if source_docs:
        await db.intel_sources.insert_many(source_docs)
