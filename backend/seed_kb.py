"""Knowledge Base seed data. Idempotent — only inserts what's missing."""
import uuid
from datetime import datetime, timezone, timedelta


def iso(dt):
    return dt.isoformat()


CATEGORIES = [
    {"slug": "core-hcm", "name": "Core HCM", "icon": "👤",
     "description": "Business process framework, staffing models, org structures, worker profiles", "sort_order": 1},
    {"slug": "talent-acquisition", "name": "Talent Acquisition", "icon": "🎯",
     "description": "Recruiting, candidate experience, sourcing, hiring workflows, offer management", "sort_order": 2},
    {"slug": "talent-management", "name": "Talent Management", "icon": "🌱",
     "description": "Performance, goals, succession, careers, calibration, talent reviews", "sort_order": 3},
    {"slug": "compensation-benefits", "name": "Compensation & Benefits", "icon": "💼",
     "description": "Compensation plans, merit cycles, benefits eligibility, total rewards", "sort_order": 4},
    {"slug": "workforce-management", "name": "Workforce Management", "icon": "⏱️",
     "description": "Time tracking, absence, scheduling, accruals, work schedules", "sort_order": 5},
    {"slug": "payroll", "name": "Payroll", "icon": "🧾",
     "description": "US/UK payroll, Payroll Control Center, ECP, PECI, pay calculations, tax", "sort_order": 6},
    {"slug": "learning-employee-experience", "name": "Learning & Employee Experience", "icon": "🎓",
     "description": "Workday Learning, employee voice, journeys, help, onboarding experiences", "sort_order": 7},
    {"slug": "workforce-planning-analytics", "name": "Workforce Planning & Analytics", "icon": "📈",
     "description": "Workforce planning, headcount, people analytics, skills cloud", "sort_order": 8},
    {"slug": "finance-accounting", "name": "Finance & Accounting", "icon": "🏦",
     "description": "General ledger, accounting center, intercompany, banking, close, consolidation", "sort_order": 9},
    {"slug": "procurement-spend-management", "name": "Procurement & Spend Management", "icon": "🛒",
     "description": "Procurement, supplier management, expenses, spend, sourcing", "sort_order": 10},
    {"slug": "projects-professional-services", "name": "Projects & Professional Services", "icon": "📐",
     "description": "Projects, professional services automation (PSA), resource management, billing", "sort_order": 11},
    {"slug": "planning", "name": "Planning", "icon": "🗺️",
     "description": "Adaptive Planning — financial, workforce, sales, operational planning models", "sort_order": 12},
    {"slug": "analytics-reporting", "name": "Analytics & Reporting", "icon": "📊",
     "description": "BIRT, composite reports, calculated fields, dashboards, Prism Analytics", "sort_order": 13},
    {"slug": "integration-platform", "name": "Integration & Platform", "icon": "🔌",
     "description": "EIB, Studio, Core Connectors, REST/SOAP APIs, XSLT, OAuth, monitoring, Extend", "sort_order": 14},
    {"slug": "security-compliance", "name": "Security & Compliance", "icon": "🔒",
     "description": "Role design, SoD, domain security, access governance, audit readiness, controls", "sort_order": 15},
    {"slug": "ai-automation", "name": "AI & Automation", "icon": "🤖",
     "description": "Workday Illuminate, ML-driven recommendations, agents, intelligent automation", "sort_order": 16},
    {"slug": "industry-solutions", "name": "Industry Solutions", "icon": "🏭",
     "description": "Healthcare, higher education, government, financial services, retail, manufacturing", "sort_order": 17},
]


# Existing slugs in DB that map cleanly to a new slug. Run at every startup
# so DB taxonomies converge to the canonical 17 above.
LEGACY_SLUG_MIGRATION = {
    "integrations": "integration-platform",
    "security": "security-compliance",
    "reporting": "analytics-reporting",
    # core-hcm and payroll keep their slugs in the new taxonomy
}

# Old categories with no clean mapping — keep them visible-but-hidden so admins
# can manually re-bucket their docs from the Admin UI.
UNMAPPED_LEGACY_SLUGS = ["career-dev"]


DOCS = [
    {
        "slug": "integration-platform", "author": "elena_carter", "is_featured": True,
        "title": "EIB shows \"Success\" but file never reached the vendor — diagnosing silent delivery failures",
        "doc_type": "fix_guide", "difficulty": "intermediate", "workday_version": "2026 R1",
        "summary": "A green EIB completion status does not confirm downstream delivery. Three patterns to catch silent failures before your vendor calls you first.",
        "tags": ["EIB", "SFTP", "monitoring", "silent-failure", "debugging"],
        "body": """## The problem

Workday EIB reports "Completed Successfully" but the vendor never received the file. You only find out two days later when payroll calls. The integration log shows green checkmarks the whole way through.

EIB's "Success" status confirms *Workday-side execution* — it does not validate that the file was accepted, read, or processed by the vendor system. Three failure modes hide behind a green status.

## Cause 1 — SFTP put succeeded but vendor folder was wrong

The most common case. Your EIB writes to `/inbound/payroll/` but the vendor expects `/inbound/payroll/incoming/`. SFTP `put` succeeded — the file is sitting in the wrong folder, picked up by nobody.

:::mistake
Trusting the vendor's onboarding document. We've seen 4 vendors in a row hand over the wrong path, then ask "why didn't you send the file?" two weeks later.
:::

**Fix:** SFTP into the vendor as Workday's integration system user. Run `ls -la` on the target folder. If you see only your test files and nothing the vendor processes, the path is wrong.

## Cause 2 — Encoding mismatch silently corrupted the payload

Workday writes UTF-8 by default. Many legacy vendors expect ISO-8859-1 or Windows-1252. The file lands intact but every special character (é, ñ, £) becomes garbage. The vendor's parser rejects every row containing one — and never tells you.

**Fix:** Add `<delivery-method-attributes>` to your EIB delivery step specifying the encoding. Confirm with `file --mime-encoding output.csv` after the EIB runs.

## Cause 3 — File written but never closed

When Workday's connection to the SFTP server drops mid-write, the file lands as a partial. The vendor's automated processor sees a file ending mid-row and either rejects the whole thing or — worse — processes everything up to the broken row.

**Fix:** Configure your EIB to write to a temporary filename (`payroll.csv.tmp`) and rename on completion. The vendor's processor should only watch for the final filename.

## The monitoring pattern we use

```python
# Post-EIB verification stub
def verify_delivery(filename, expected_size, vendor_sftp):
    listing = vendor_sftp.listdir_attr("/inbound/")
    f = next((x for x in listing if x.filename == filename), None)
    assert f, f"File {filename} not found on vendor"
    assert f.st_size == expected_size, "Size mismatch — possible truncation"
    return True
```

:::tip
Run this as a separate scheduled report 10 minutes after the EIB. If it fails, page the on-call. Don't trust the green checkmark.
:::

## Verification

Look for these three things after every EIB run:
1. File appears in the vendor's expected folder
2. File size matches what Workday wrote
3. File encoding matches what the vendor expects

Until all three are green, the EIB is not done — no matter what the status says.""",
    },
    {
        "slug": "integration-platform", "author": "ana_lopez", "is_featured": False,
        "title": "XSLT encoding errors in Workday EIB — the complete diagnostic guide",
        "doc_type": "fix_guide", "difficulty": "beginner", "workday_version": "2025 R2",
        "summary": "Encoding mismatches between ISO-8859-1 and UTF-8 cause garbled characters and failed transformations. Where to look, what to change, how to test the fix.",
        "tags": ["XSLT", "encoding", "UTF-8", "EIB", "transformation"],
        "body": """## What you'll see

The EIB completes successfully. The downstream parser fails with an error like `Invalid character 0xC3 0xA9 at line 42` or — worse — the data appears to load but employee names like "François Lévesque" appear as "Fran�ois L�vesque".

This is almost always an encoding mismatch in the XSLT transformation step.

## Why it happens

Workday produces XML as UTF-8 by default. Many legacy vendor systems — especially older payroll and benefits platforms — expect ISO-8859-1 (Latin-1) or Windows-1252. When you transform Workday output with XSLT that doesn't declare its output encoding, the bytes pass through unchanged but the receiving system interprets them with the wrong character set.

## Step 1 — Identify what the vendor actually wants

Before changing anything, get a sample file the vendor has successfully processed in the past. Run:

```bash
file --mime-encoding sample.csv
```

If you see `utf-8`, the vendor accepts UTF-8 (rare for legacy systems). If you see `iso-8859-1` or `unknown`, treat it as Latin-1.

## Step 2 — Update the XSLT output declaration

At the top of your XSLT, the `xsl:output` element controls what gets written. Most templates ship with:

```xml
<xsl:output method="text" indent="no"/>
```

This omits encoding entirely and defaults to whatever the runtime decides. Change it explicitly:

```xml
<xsl:output method="text" indent="no" encoding="ISO-8859-1"/>
```

:::warning
Setting `encoding="ISO-8859-1"` does not transcode UTF-8 characters into Latin-1 — it tells the XSLT processor to assume the output is already Latin-1. If your source data has characters outside the Latin-1 range (Cyrillic, Chinese, etc.), they will be silently replaced with `?`.
:::

## Step 3 — Transcode in the EIB delivery step

If you have characters outside Latin-1, transcode at the delivery layer instead of in XSLT. In the EIB delivery configuration, set `Character Encoding` to the vendor's expected encoding. Workday will perform a real transcode, replacing unmappable characters with the encoding's substitution character.

## Step 4 — Test in three layers

1. Run the XSLT against a sample worker with international characters in their name
2. Save the output and run `file --mime-encoding` on it — confirm the encoding matches what you expect
3. Open the file in a UTF-8-aware editor (VS Code with the encoding indicator visible) and verify the characters render correctly

## Common mistakes

:::mistake
Setting `encoding="UTF-8"` in XSLT but then writing the file via SFTP without setting the SFTP transfer mode to binary. ASCII mode SFTP transfers can mangle UTF-8 byte sequences.
:::

If problems persist, the issue is usually upstream in the source data — check whether the calculated field producing the name has its own encoding behaviour.""",
    },
    {
        "slug": "integration-platform", "author": "raj_n", "is_featured": False,
        "title": "PECI payroll integration — the 150K worker limit and how to design around it",
        "doc_type": "reference", "difficulty": "advanced", "workday_version": "2026 R1",
        "summary": "PECI has hard limits most architects discover mid-implementation. Design patterns for large global payrolls before you hit the wall.",
        "tags": ["PECI", "payroll", "integration", "limits", "global-payroll"],
        "body": """## The limits you need to know

PECI (Payroll Effective Change Interface) is Workday's primary outbound integration for third-party payroll providers. It is excellent — until you hit the limits.

| Limit | Threshold | What happens |
|-------|-----------|--------------|
| Worker count per run | ~150,000 | Run times exceed window; some runs fail |
| Pay groups per integration | No hard limit, but >50 degrades performance | Output files grow unwieldy |
| Effective-dated events per worker per run | ~200 | Truncation in event detail |
| Generated file size | ~2 GB | Vendor SFTP rejects |

These are not documented limits — they are empirical thresholds we and other architects have hit in production.

## Why the 150K limit hits hardest

PECI consolidates worker, position, organization, compensation, time off, and pay component data. For each worker, it generates an event list since the last successful run. For an enterprise with 150K active workers and biweekly changes, that's roughly 800K rows per run.

PECI's underlying generation is *not* incremental at the database level — it computes the full delta from scratch each run. Past a certain worker count, the integration system user's session times out before the file is complete.

## Design patterns for >150K workers

### Pattern 1 — Pay group sharding

Split your single PECI into 3–5 separate PECIs, each scoped to a subset of pay groups. Each runs in its own window and writes to its own vendor folder.

**Tradeoff:** The vendor must support consolidated processing of multiple files. Most enterprise vendors do.

### Pattern 2 — Geographic sharding

Split by country or region. North America runs at 02:00 ET, EMEA at 02:00 GMT, APAC at 02:00 JST. Each shard is a separate PECI.

:::tip
Pattern 2 is usually cleaner than Pattern 1 because it aligns with payroll cycles. EMEA payrolls run on different dates than NA payrolls anyway.
:::

### Pattern 3 — Custom integration with PECI structure

For workforces above 500K, neither sharding pattern is sustainable. Build a custom integration using Studio + REST that mirrors the PECI output structure but is fully incremental at the database query level.

:::warning
Pattern 3 is a 6–12 month engineering effort. Do not start it until both sharding patterns have failed.
:::

## Validation checklist before go-live

- Confirm peak worker count for next 24 months — not today
- Stress test with synthetic worker data at 1.5× expected peak
- Validate each shard runs within its window with 30% headroom
- Document the operational runbook for shard failure scenarios
- Get sign-off from the vendor on multi-file ingestion timing

## When to escalate to Workday

If you cannot stay under 150K per shard and Pattern 3 is not viable, Workday's solution architects can in some cases configure increased session limits for your tenant. This is rare and requires a business case.""",
    },
    {
        "slug": "analytics-reporting", "author": "tomek_v", "is_featured": True,
        "title": "Calculated fields returning null when used as LTV type — causes and step-by-step fix",
        "doc_type": "fix_guide", "difficulty": "intermediate", "workday_version": "2026 R1",
        "summary": "LTV calculated fields fail silently in specific conditions. Three most common causes and exact configuration steps to resolve each one.",
        "tags": ["calculated-fields", "LTV", "reporting", "null-values", "BIRT"],
        "body": """## The symptom

You build a Lookup Translation Value (LTV) calculated field. It works fine in the test mode — returns the expected value. The moment you drop it into a report, the column shows nulls for some workers and correct values for others. No pattern at first glance.

## Cause 1 — The lookup target is effective-dated and your "As Of" date is wrong

LTVs that reference effective-dated objects (compensation, position, organization) need an explicit `As Of` date. If you leave it as default, the LTV evaluates against the report's effective date — which may not match the field you're translating.

:::warning
This is the cause in roughly 70% of "intermittent null" LTV cases we've debugged.
:::

**Fix:** Open the calculated field. In the LTV configuration, set the `As Of Date` explicitly. For most worker reports, use `Worker | Effective Date for Current Position`.

## Cause 2 — The source field returns a multi-instance value

LTVs cannot resolve a multi-instance source. If the source calculated field returns `[Manager A, Manager B, Manager C]`, the LTV evaluates the first instance and silently drops the rest — but only if the first instance has a successful lookup. If it doesn't, the entire LTV returns null.

**Fix:** Wrap the source in a single-instance calculated field first. Use `Lookup Single Instance` to pick a deterministic one (most-recent, highest-priority, etc.) before feeding it into the LTV.

```
Step 1: Build "Primary Manager" using Lookup Single Instance
Step 2: Use "Primary Manager" as the LTV source
```

## Cause 3 — Translation table doesn't include all possible source values

LTVs return null when the source value is not in the translation table. If your translation table maps `Country = US → "United States"` but the source produces `Country = "USA"` (different string), the LTV returns null — no warning.

**Fix:** Audit the source field's distinct values:

1. Build a report showing the source field only, distinct
2. Compare to the LTV translation table
3. Add any missing entries
4. Add a default value for "unknown" cases — never leave the default blank

:::tip
Always set a non-null default like `"(Unmapped)"`. This way unmapped source values show up clearly in the report instead of looking like a data problem.
:::

## Verification

After fixing, test with three workers known to have produced nulls. If all three return the expected value, the fix is solid. Schedule a one-time audit report 7 days later to catch any new unmapped values.""",
    },
    {
        "slug": "security-compliance", "author": "raj_n", "is_featured": True,
        "title": "Pre go-live security audit — 47 things to verify before you hand over the keys",
        "doc_type": "checklist", "difficulty": "intermediate", "workday_version": "2026 R1",
        "summary": "A complete security validation checklist covering role assignments, SoD conflicts, integration system user permissions, domain security, and business process security.",
        "tags": ["checklist", "go-live", "security", "audit", "SoD"],
        "body": """## How to use this checklist

Run this checklist no earlier than 7 days before go-live, after all role assignments are finalised. Every item is binary — pass or fail. Track failures in a single sheet and assign owners. Do not go live with any item unresolved.

## Role assignments (12 items)

- [ ] Every active worker has at least one role assigned
- [ ] No worker has more than 10 roles (review > 10 individually)
- [ ] All HR Partner roles are assigned to current HR staff only
- [ ] All Manager roles match the position management hierarchy
- [ ] No terminated workers retain active role assignments
- [ ] All custom roles have descriptions populated
- [ ] Role expiration dates set for temporary access (contractor coverage)
- [ ] Cross-tenant roles documented and approved
- [ ] Delegation roles tested with at least one round-trip
- [ ] Role-from-organization assignments validated
- [ ] No production roles assigned to test/QA accounts
- [ ] Emergency access role exists with logged justification process

## SoD conflicts (8 items)

- [ ] Pay-Process and Pay-Setup not held by same individual
- [ ] HR Partner and Compensation Partner not held by same individual
- [ ] Time-Approver and Time-Process not held by same individual
- [ ] No worker can both create and approve their own expense reports
- [ ] No worker can both create and approve their own purchase requisitions
- [ ] All SoD exceptions documented with mitigating controls
- [ ] SoD report runs cleanly with zero unaddressed conflicts
- [ ] CFO/CHRO has signed off on remaining mitigated exceptions

:::warning
Item 14 (HR + Comp Partner) is the most common audit finding. Reviewers will check this first.
:::

## Integration system users (9 items)

- [ ] Every integration has its own dedicated ISU (no shared ISUs)
- [ ] Every ISU has minimum required domain access — nothing more
- [ ] No ISU has access to `Worker Data: Personal Information` unless required
- [ ] No ISU has `Modify Worker Data` access for read-only integrations
- [ ] Passwords stored in secrets manager — not in documentation
- [ ] OAuth tokens scoped to specific endpoints where supported
- [ ] All ISUs have rotation schedule documented (recommend 90 days)
- [ ] ISUs flagged as such in worker profile for audit clarity
- [ ] No ISU has manager assignment

## Domain security (10 items)

- [ ] Every domain in the tenant has at least one owner assigned
- [ ] No security group has access to all domains
- [ ] Compensation domains restricted to comp partners only
- [ ] Personal information domains restricted with explicit justification
- [ ] Financial domains restricted to finance roles only
- [ ] Reporting domains do not grant transactional access
- [ ] Workday-delivered roles audited for over-permissioning
- [ ] Domain access matrix exported and reviewed by CISO
- [ ] No "Modify" access granted where "Get" is sufficient
- [ ] Domain change request workflow operational

## Business process security (8 items)

- [ ] All BP step approvers exist and are active
- [ ] No BP has "Routing Restrictions" set to "None"
- [ ] Termination BP requires Legal review for severance
- [ ] Pay change BP requires Comp Partner approval above threshold
- [ ] BP delegations expire and don't grant permanent access
- [ ] Audit trail enabled on all sensitive BPs
- [ ] Initiation Restrictions defined for sensitive BPs
- [ ] BP exception reports running daily

:::tip
Print this checklist. Sign each section as it's completed. Auditors love physical sign-offs.
:::

## Post go-live (recurring)

Run this checklist again at 30, 60, and 90 days post-go-live. Most role drift happens in the first 90 days as exceptions are granted and never revoked.""",
    },
    {
        "slug": "core-hcm", "author": "elena_carter", "is_featured": False,
        "title": "Workday Business Process Framework — how it actually works (not the documentation version)",
        "doc_type": "learning_bite", "difficulty": "beginner", "workday_version": "2026 R1",
        "summary": "A practitioner-written explanation of BPF that covers what the documentation skips — routing logic, condition rules, notification patterns, and the most common configuration mistakes.",
        "tags": ["BPF", "business-process", "core-hcm", "beginners", "routing"],
        "body": """## What BPF really is

The Business Process Framework (BPF) is the engine that drives every transaction in Workday — hires, promotions, terminations, comp changes, time off, expense reports. Every one of them is a BP. If you've ever wondered why one configuration change cascades into 17 unexpected behaviours, the answer is almost always: a BP touched it.

The documentation describes BPF as a "configurable workflow engine." That's accurate but unhelpful. Here's what's actually happening.

## The four primitives

Every BP is built from four things:

**1. Steps.** Atomic actions: an approval, a to-do, a sub-process, an integration trigger. Each step has a participant (who acts) and an outcome (what happens next).

**2. Routing rules.** Logic that decides who the participant is. The most common is "Manager of the subject worker" — but routing can also be by organization role, by calculated field, or by exact-named individual.

**3. Conditions.** Boolean expressions that determine whether a step executes at all. Most BP configuration disasters come from conditions being too permissive or too restrictive.

**4. Notifications.** What people receive when a step lands in their inbox, or after a step completes.

## The mental model that helps

BPs are *not* sequential workflows in the traditional sense. They're parallel-eligible trees with conditional branches. A BP step can:
- Execute (condition met, routing finds a participant)
- Skip (condition not met)
- Stall (condition met but routing found no one)

The "stall" case is the source of 80% of BP support tickets.

:::mistake
Configuring a step with "Routing: HR Partner" but the affected worker has no HR Partner assigned at their organization. The step stalls indefinitely with no error visible to the initiator.
:::

## How routing actually resolves

Workday walks the organization hierarchy upward looking for a role match. If "HR Partner" is not assigned at the worker's home organization, Workday checks the parent, then the parent's parent, until it either finds one or hits the top of the hierarchy.

If it reaches the top with no match, the step stalls. There is no error log entry by default.

:::tip
Always set a "Routing Restrictions" fallback role — typically a `Pool of HR Partners` security group that includes everyone. This guarantees the step never stalls; it just routes to a wider pool.
:::

## The most common BP mistakes

1. **No fallback routing.** Steps stall in production.
2. **Conditions referencing fields that don't exist for the subject type.** Returns false silently — the step skips.
3. **Notifications without expiry dates.** Inboxes fill with stale items nobody acts on.
4. **Sub-process triggers without their own conditions.** Sub-processes execute on every transaction, slowing everything down.
5. **Editing the delivered version of a BP instead of cloning it first.** Breaks future Workday updates.

## What to look at next

Once you understand the four primitives, the best follow-up reading is:
- `Maintain Business Process Definitions` — see all configured BPs in your tenant
- `View Business Process` for any in-flight transaction — see exactly where it is
- BP step audit reports — historical analysis of where stalls happen

BPF makes more sense the moment you stop thinking of it as a workflow and start thinking of it as a routing engine.""",
    },
    {
        "slug": "career-dev", "author": "raj_n", "is_featured": False,
        "title": "Workday architect interview preparation — the complete question bank with model answers",
        "doc_type": "reference", "difficulty": "beginner", "workday_version": "2026 R1",
        "summary": "40 real interview questions asked at architect-level Workday interviews, with model answer frameworks for each. Technical, functional, and behavioural categories.",
        "tags": ["interview-prep", "architect", "career", "questions", "STAR"],
        "body": """## How to use this guide

The questions below are drawn from actual Workday Solution Architect interviews at Big 4, boutique consulting firms, and large enterprise clients between 2024 and 2026. Use this as preparation — not as a script. Interviewers spot rehearsed answers in under 30 seconds.

For every question, the *model answer framework* tells you what the interviewer is actually evaluating. Adapt it to your own experience.

## Technical category (15 questions)

**1. Walk me through how you'd architect Workday security for a global org with 80K employees and 3 unionized populations.**

Framework: scope the question first (what regulatory contexts? which unions?). Outline an archetype-and-intersection role model. Highlight SoD constraints upfront. Acknowledge what you don't know rather than fabricate.

**2. A client wants to migrate from SAP HCM to Workday in 8 months. Walk us through your risk register on day one.**

Framework: name *specific* risks (parallel payroll variance > 0.5%, role mapping signoff from CFO not secured by week 4, historical data >7 years requires legacy access during cutover). Generic risks ("scope creep") signal junior thinking.

**3. How do you decide between Studio and EIB for a given integration?**

Framework: complexity, data volume, frequency, transformation needs, error handling requirements. Specific decision rules — not "it depends."

**4. Describe how PECI handles a worker who moves between pay groups mid-cycle.**

**5. When would you use BIRT instead of a Composite Report?**

**6. Explain how calculated field caching works and when stale values appear.**

**7. How would you handle a 5x increase in EIB execution time after a Workday release?**

**8. Walk me through the OAuth flow for a custom integration consuming Workday's REST APIs.**

**9. Explain the difference between Domain Security and Business Process Security with examples.**

**10. How do you debug a stalled BP step?**

**11. Design the data model for a custom object tracking employee certifications.**

**12. What's the trade-off between using Workday-delivered roles vs custom roles?**

**13. Describe how you'd implement zero-downtime tenant configuration changes.**

**14. Explain how Position Management interacts with Headcount Plans after R1 2026.**

**15. When would you choose a Core Connector over a REST API call?**

## Functional category (15 questions)

**16. A CHRO asks you to "fix" their org structure. How do you scope the engagement?**

Framework: ask why the structure feels broken before proposing changes. Common drivers: cost allocation issues, reporting alignment, M&A integration. The intervention is different for each.

**17. Walk through a position management vs job management decision for a 5K-employee retail company.**

**18. How would you redesign comp grades for a company merging two pay philosophies?**

**19. Describe a Workday best practice you've pushed back on and how you justified it.**

Framework: this is a culture-fit signal. Show the framing "here's the principle, here's the constraint, here's the compromise" rather than caving or digging in.

**20-30:** [Standard functional questions on absence, benefits, talent, recruiting, comp cycles, perf reviews, succession, onboarding, offboarding, M&A]

## Behavioural category (10 questions)

**31. Tell me about a project that failed.**

Framework: STAR format. Acknowledge what *you* missed — not blame distribution. End on the lesson and how it changed your subsequent work.

**32. Describe a time you disagreed with a client decision.**

**33. How do you mentor junior consultants?**

**34. Tell me about a time you missed a deadline.**

**35-40:** [Standard behavioural: difficult stakeholder, ethical dilemma, scope creep, technical debate, hiring decision, team conflict]

## Closing the loop

After the interview, send a thank-you within 24 hours referencing one specific technical point discussed. This signals you were listening and you care.""",
    },
    {
        "slug": "security-compliance", "author": "raj_n", "is_featured": False,
        "title": "Designing intersection security groups for a shared services model across multiple business units",
        "doc_type": "how_to", "difficulty": "advanced", "workday_version": "2025 R2",
        "summary": "Step-by-step guide to structuring Workday security roles when a shared services centre supports 3 or more business units with different access requirements.",
        "tags": ["security", "intersection-groups", "SoD", "shared-services", "role-design"],
        "body": """## What you'll be able to do

After following this guide, you'll have a security model that:
- Cleanly separates persona (what someone does) from scope (which BU they do it for)
- Avoids role explosion when adding new business units
- Survives audit without manual SoD reconciliation
- Onboards new shared services analysts in under 30 minutes

## When this pattern applies

Use this pattern when:
- You have 3+ business units sharing a tenant
- A shared services team supports all of them with role-based scoping
- Different analysts have different scope (some are BU-specific, others cross-BU)
- You expect to add more BUs over time

If you have 2 BUs or fewer, this is overkill — direct role assignment with org-scoped roles is fine.

## Step 1 — Define personas, not roles

Start by listing every job function — *not* job title. For a shared services HR team you might have:

- HR Operations Analyst
- Comp Analyst
- Benefits Coordinator
- Payroll Specialist
- Time & Absence Administrator

These become your **archetype personas**. They are scope-agnostic: an HR Operations Analyst does the same work whether they support BU A or BU C.

## Step 2 — Create one base role per persona

For each persona, create one Workday security role with no organization scoping. Name them consistently:

```
HRSS - HR Operations Analyst
HRSS - Comp Analyst
HRSS - Benefits Coordinator
...
```

Each role gets all the domain access required to perform that function.

:::tip
Use a consistent prefix (`HRSS - `) for every role in this pattern. It makes audit reports trivially filterable.
:::

## Step 3 — Define BU scoping groups

For each business unit, create one security group that defines its organizational scope. These are typically organization-based groups:

```
SCOPE - Business Unit A
SCOPE - Business Unit B
SCOPE - Business Unit C
```

Each `SCOPE - ` group contains the relevant organizations (top-level org + all descendants).

## Step 4 — Build intersection groups only where needed

Now combine. An HR Ops Analyst who supports only BU A gets the intersection of `HRSS - HR Operations Analyst` ∩ `SCOPE - Business Unit A`.

Name intersection groups with both inputs visible:

```
HRSS - HR Operations Analyst | BU A
HRSS - HR Operations Analyst | BU B
HRSS - Comp Analyst | BU A + BU C
```

A Comp Analyst who supports two BUs gets a single intersection group with both scopes — not two separate assignments.

:::mistake
Creating one intersection group per BU per persona pre-emptively. You'll have 50+ groups before anyone uses 80% of them. Create intersections on demand, not in advance.
:::

## Step 5 — Bake in SoD constraints

Define your SoD conflict pairs at the persona level, not the intersection level. Use Workday's `Maintain Segregation of Duties` to declare:

```
HRSS - Comp Analyst incompatible with HRSS - Payroll Specialist
HRSS - HR Operations Analyst incompatible with HRSS - Audit Reviewer
```

Because intersection groups inherit from base personas, SoD checks run automatically.

## Step 6 — Migration plan

If you're migrating from a role-explosion model, sequence it:

1. Build the new base personas
2. Build the scope groups
3. Build intersection groups for current users only (not theoretical future combinations)
4. Migrate users role-by-role with parallel verification
5. Once all users are migrated, sunset the old role tree

Plan 8-12 weeks for a 1000-user migration with this pattern.

## Verification

Run these queries weekly post-migration:
- Workers with no role assignment
- Workers with more than 5 intersection assignments
- Intersection groups assigned to zero workers (clean these up)
- SoD conflict report

Clean numbers means the pattern is healthy.""",
    },
]


async def seed_kb(db):
    # Categories — upsert canonical taxonomy
    for c in CATEGORIES:
        existing = await db.kb_categories.find_one({"slug": c["slug"]})
        if not existing:
            await db.kb_categories.insert_one({
                "id": str(uuid.uuid4()),
                "slug": c["slug"], "name": c["name"], "icon": c["icon"],
                "description": c["description"], "sort_order": c["sort_order"],
                "doc_count": 0, "total_views": 0, "avg_helpful_pct": 0,
                "is_hidden": False,
                "created_at": iso(datetime.now(timezone.utc)),
            })
        else:
            # Keep canonical name/icon/description/sort_order in sync with code
            await db.kb_categories.update_one(
                {"slug": c["slug"]},
                {"$set": {
                    "name": c["name"], "icon": c["icon"],
                    "description": c["description"], "sort_order": c["sort_order"],
                    "is_hidden": False,
                }},
            )

    # --- Migration: re-bucket docs from legacy slugs to canonical ones ---
    for old_slug, new_slug in LEGACY_SLUG_MIGRATION.items():
        old_cat = await db.kb_categories.find_one({"slug": old_slug})
        new_cat = await db.kb_categories.find_one({"slug": new_slug})
        if not old_cat or not new_cat:
            continue
        moved = await db.kb_docs.update_many(
            {"category_id": old_cat["id"]},
            {"$set": {"category_id": new_cat["id"], "category_slug": new_slug}},
        )
        if moved.modified_count:
            print(f"[seed_kb] Migrated {moved.modified_count} docs: {old_slug} -> {new_slug}")
        # Hide the old category so it disappears from the public taxonomy
        await db.kb_categories.update_one(
            {"slug": old_slug}, {"$set": {"is_hidden": True, "doc_count": 0}}
        )

    # Surface any old categories that still hold docs and have no mapping
    for orphan_slug in UNMAPPED_LEGACY_SLUGS:
        cat = await db.kb_categories.find_one({"slug": orphan_slug})
        if not cat:
            continue
        doc_count = await db.kb_docs.count_documents({"category_id": cat["id"]})
        if doc_count > 0:
            print(f"[seed_kb] MANUAL REVIEW: legacy category '{orphan_slug}' "
                  f"still has {doc_count} doc(s) with no clean mapping to the new taxonomy.")
        # Hide from public taxonomy but keep docs intact for admin re-bucketing
        await db.kb_categories.update_one(
            {"slug": orphan_slug}, {"$set": {"is_hidden": True}}
        )

    # Recompute doc_count per category (covers both fresh seeds and migrations)
    async for cat in db.kb_categories.find({}, {"_id": 0, "id": 1}):
        count = await db.kb_docs.count_documents({"category_id": cat["id"], "is_published": True})
        await db.kb_categories.update_one({"id": cat["id"]}, {"$set": {"doc_count": count}})

    # Docs — only seed if empty
    if await db.kb_docs.count_documents({}) > 0:
        return
    cats_by_slug = {c["slug"]: c async for c in db.kb_categories.find({}, {"_id": 0})}
    users_by_username = {u["username"]: u async for u in db.users.find({}, {"_id": 0, "password_hash": 0})}
    now = datetime.now(timezone.utc)
    for i, d in enumerate(DOCS):
        cat = cats_by_slug.get(d["slug"])
        author = users_by_username.get(d["author"])
        if not cat or not author:
            continue
        doc_id = str(uuid.uuid4())
        helpful = 14 + (i * 7) % 40
        not_helpful = max(0, (i * 3) % 5)
        await db.kb_docs.insert_one({
            "id": doc_id,
            "category_id": cat["id"],
            "category_slug": cat["slug"],
            "author_id": author["user_id"],
            "title": d["title"], "summary": d["summary"], "body": d["body"],
            "doc_type": d["doc_type"], "difficulty": d["difficulty"],
            "target_groups": ["aspirant", "practitioner", "employer"],
            "tags": d["tags"], "workday_version": d.get("workday_version"),
            "view_count": 120 + i * 37,
            "helpful_count": helpful,
            "not_helpful_count": not_helpful,
            "is_published": True,
            "is_featured": d.get("is_featured", False),
            "created_at": iso(now - timedelta(days=20 + i)),
            "updated_at": iso(now - timedelta(days=5 + i)),
        })
        await db.kb_categories.update_one({"id": cat["id"]}, {"$inc": {"doc_count": 1, "total_views": 120 + i * 37}})

    # Compute avg helpful pct per category
    async for cat in db.kb_categories.find({}, {"_id": 0}):
        docs = await db.kb_docs.find({"category_id": cat["id"]}, {"_id": 0, "helpful_count": 1, "not_helpful_count": 1}).to_list(500)
        total_h = sum(d["helpful_count"] for d in docs)
        total_nh = sum(d["not_helpful_count"] for d in docs)
        pct = int(round(100 * total_h / max(1, total_h + total_nh)))
        await db.kb_categories.update_one({"id": cat["id"]}, {"$set": {"avg_helpful_pct": pct}})
