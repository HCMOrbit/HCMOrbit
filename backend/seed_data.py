"""Seed data for HCMOrbit. Idempotent — only inserts what's missing."""
import uuid
from datetime import datetime, timezone, timedelta


def iso(dt):
    return dt.isoformat()


SPACES = [
    {"slug": "core-hcm", "name": "Core HCM", "icon": "Users",
     "description": "Staffing models, org structures, business process framework, worker profiles"},
    {"slug": "integrations", "name": "Integrations", "icon": "Network",
     "description": "Studio, EIB, Core Connectors, REST/SOAP APIs, XSLT, error handling"},
    {"slug": "security", "name": "Security & Roles", "icon": "Shield",
     "description": "Role design, SoD, domain security, access governance, audit readiness"},
    {"slug": "reporting", "name": "Reporting & Analytics", "icon": "BarChart3",
     "description": "BIRT, composite reports, dashboards, Prism, calculated fields"},
    {"slug": "compensation", "name": "Compensation", "icon": "CircleDollarSign",
     "description": "Comp plans, grades, benchmarks, merit cycles, advanced comp"},
    {"slug": "payroll", "name": "Payroll", "icon": "Wallet",
     "description": "US/UK payroll, payroll control center, ECP, pay calculations"},
    {"slug": "financials", "name": "Financials", "icon": "Landmark",
     "description": "GL, procurement, expenses, accounting center, financial reporting"},
    {"slug": "career-lounge", "name": "Career Lounge", "icon": "Coffee",
     "description": "Interview prep, salary talk, career transitions, job search strategies"},
]


USERS = [
    # Aspirants (4)
    {"username": "priya_hcm", "full_name": "Priya Raghavan", "group_type": "aspirant",
     "bio": "Career switcher from HR Ops moving into Workday consulting. Studying Core HCM and Compensation.",
     "workday_modules": ["Core HCM", "Compensation"], "years_experience": 2, "location": "Bangalore, India",
     "reputation_score": 84},
    {"username": "marcus_t", "full_name": "Marcus Tate", "group_type": "aspirant",
     "bio": "Recent grad, working towards Pro certification. Strong on Reporting fundamentals.",
     "workday_modules": ["Reporting", "Core HCM"], "years_experience": 1, "location": "Austin, TX",
     "reputation_score": 41},
    {"username": "ana_lopez", "full_name": "Ana Lopez", "group_type": "aspirant",
     "bio": "Transitioning from SAP HCM. Curious about Workday Integrations.",
     "workday_modules": ["Integrations", "Security"], "years_experience": 3, "location": "Madrid, Spain",
     "reputation_score": 62},
    {"username": "kenji_w", "full_name": "Kenji Watanabe", "group_type": "aspirant",
     "bio": "HRIS analyst building Workday muscle. Focus: Absence, Time Tracking.",
     "workday_modules": ["Absence", "Core HCM"], "years_experience": 2, "location": "Tokyo, Japan",
     "reputation_score": 27},
    # Practitioners (4)
    {"username": "elena_carter", "full_name": "Elena Carter", "group_type": "practitioner",
     "bio": "Workday Integration architect, 9 years. Studio, EIB, Core Connectors, REST.",
     "workday_modules": ["Integrations", "Security", "Reporting"], "years_experience": 9,
     "location": "Seattle, WA", "reputation_score": 4280},
    {"username": "raj_n", "full_name": "Rajesh Nair", "group_type": "practitioner",
     "bio": "Solution Architect, multi-tenant deployments. Deep on Security & Domain governance.",
     "workday_modules": ["Security", "Core HCM", "Financials"], "years_experience": 11,
     "location": "Toronto, Canada", "reputation_score": 6112},
    {"username": "sara_devlin", "full_name": "Sara Devlin", "group_type": "practitioner",
     "bio": "Independent Workday Payroll & Comp consultant. UK + EMEA.",
     "workday_modules": ["Payroll", "Compensation", "Benefits"], "years_experience": 7,
     "location": "London, UK", "reputation_score": 2940},
    {"username": "tomek_v", "full_name": "Tomek Vance", "group_type": "practitioner",
     "bio": "Reporting & Prism specialist. BIRT, calculated fields, exec dashboards.",
     "workday_modules": ["Reporting", "Core HCM"], "years_experience": 6,
     "location": "Warsaw, Poland", "reputation_score": 1980},
    # Employers (2)
    {"username": "northbridge_talent", "full_name": "Mira Halberg", "group_type": "employer",
     "bio": "Talent lead at Northbridge HR Tech. We hire mid-senior Workday consultants for FS clients.",
     "workday_modules": [], "years_experience": 12, "company_name": "Northbridge HR Tech",
     "location": "New York, NY", "reputation_score": 380},
    {"username": "axiom_partners", "full_name": "David Okafor", "group_type": "employer",
     "bio": "Partner at Axiom Workday Partners. Boutique consulting, AMER + EMEA.",
     "workday_modules": [], "years_experience": 18, "company_name": "Axiom Workday Partners",
     "location": "Chicago, IL", "reputation_score": 615},
]


POSTS = [
    {
        "space_slug": "integrations", "type": "question",
        "author_username": "ana_lopez",
        "title": "EIB inbound transformation fails when employee has no manager assigned — XSLT returns null node",
        "body": "Working on an inbound EIB for a worker data load. The transformation fails silently when an employee record has no manager populated. The XSLT `<xsl:value-of select=\"manager/wd:ID\"/>` returns an empty node, but downstream the load throws a generic 'invalid reference' with no row pointer.\n\nWhat I tried:\n- Wrapped in `<xsl:if>` checking string-length\n- Added a `<xsl:choose>` with default to 'TOP_OF_HIERARCHY'\n\nNeither catches all rows. Roughly 4% of the dataset has no manager (CEO, contractors).\n\nWhat's the cleanest pattern people use for this in production?",
        "tags": ["eib", "xslt", "integrations", "studio"], "is_solved": True, "vote_count": 47,
        "answers": [
            {"author_username": "elena_carter",
             "body": "This is a classic. The trick is to NEVER let manager be null in the load — but you also don't want to default it to a real worker.\n\nWe use a synthetic 'TOP_OF_HIERARCHY' reference and pre-process the XML in the EIB Studio transformation step before validation runs.\n\n```xml\n<xsl:choose>\n  <xsl:when test=\"string-length(normalize-space(manager/wd:ID)) > 0\">\n    <wd:Manager_Reference>\n      <wd:ID wd:type=\"Employee_ID\"><xsl:value-of select=\"manager/wd:ID\"/></wd:ID>\n    </wd:Manager_Reference>\n  </xsl:when>\n  <xsl:otherwise>\n    <wd:Manager_Reference>\n      <wd:ID wd:type=\"Organization_Reference_ID\">TOP_OF_HIERARCHY</wd:ID>\n    </wd:Manager_Reference>\n  </xsl:otherwise>\n</xsl:choose>\n```\n\nAlso enable 'Generate XML Document' in the EIB delivery step — you'll get row-by-row error logs instead of one generic message. That alone saved me dozens of hours.",
             "vote_count": 58, "is_accepted": True},
            {"author_username": "raj_n",
             "body": "Elena's answer is the right structural fix. One addition: at the staging layer, validate the count of unmapped managers before the load — fail fast if it exceeds a tolerance threshold (e.g., 5%). Otherwise an upstream Workday Studio bug can quietly load 80% of rows and you don't notice until reconciliation.",
             "vote_count": 22, "is_accepted": False},
            {"author_username": "tomek_v",
             "body": "If you only need to debug this specific load, the fastest path is to enable 'Reference Resolution Trace' in Studio. It will tell you the exact row index that failed reference lookup, which is what you actually want.",
             "vote_count": 9, "is_accepted": False},
        ],
    },
    {
        "space_slug": "security", "type": "question",
        "author_username": "marcus_t",
        "title": "How do you structure intersection security groups for a shared services model across 3 business units?",
        "body": "We're consolidating 3 acquired entities onto a single tenant. Each has its own HR shared services team but with some overlap (e.g., comp analysts that work across all 3, but recruiters scoped to one).\n\nDo you go intersection-heavy (one group per role × BU) or use conditional roles with calculated fields? The architect calls are split 50/50 and I'd love real implementation notes from people who've done it.",
        "tags": ["security", "intersection", "shared-services"], "is_solved": False, "vote_count": 33,
        "answers": [
            {"author_username": "raj_n",
             "body": "Done this for two FS clients. Short answer: intersection groups, but **only at the resource level**, not at the persona level.\n\nWhat that means in practice:\n- Define one 'HR Shared Services - Comp' security group (no BU scoping)\n- Use intersection ONLY where the resource is BU-scoped (e.g., 'Comp Analyst - BU A' = Comp Analyst ∩ BU A organization)\n- Avoid the trap of creating BU-scoped versions of every persona — your role count explodes and audit becomes a nightmare.\n\nWe ended up with 14 base personas and 38 intersections total. Manageable. The 'one group per role × BU' approach would have given us 42 groups for the same coverage, with way more overlap.",
             "vote_count": 19, "is_accepted": False},
            {"author_username": "elena_carter",
             "body": "Adding to Rajesh's answer: bake in SoD constraints upfront. Don't wait until audit. Use the 'Maintain Segregation of Duties' task and define the conflict pairs *as you build the role taxonomy*, not after.",
             "vote_count": 11, "is_accepted": False},
        ],
    },
    {
        "space_slug": "core-hcm", "type": "discussion",
        "author_username": "elena_carter",
        "title": "How are you handling the position management vs headcount plan tension in Workday after R1 2026?",
        "body": "The R1 2026 release tweaks how Position Management interacts with Headcount Plans — specifically the new 'Plan to Position Reconciliation' BP. \n\nIn theory, finance gets clean headcount control. In practice, every architect I've talked to says ops teams now have a longer cycle to fill a vacant position because reconciliation gates the requisition.\n\nWhat tradeoffs are you seeing in production? Are you keeping the new BP enabled or routing around it?",
        "tags": ["position-management", "headcount", "r1-2026"], "is_solved": False, "vote_count": 28,
        "answers": [
            {"author_username": "sara_devlin",
             "body": "We turned it off. The 2-day reconciliation latency was killing us for hourly retail backfills. Finance lost a tiny bit of visibility but ops productivity went up measurably.",
             "vote_count": 17, "is_accepted": False},
            {"author_username": "raj_n",
             "body": "Counter-take: we kept it on but parallelized — recruiting can post the req before reconciliation completes; reconciliation just gates the hire event. Best of both worlds, but it required a custom BP configuration that's non-trivial.",
             "vote_count": 13, "is_accepted": False},
        ],
    },
    {
        "space_slug": "integrations", "type": "success_story",
        "author_username": "elena_carter",
        "title": "How I debugged a Workday Studio integration that was silently dropping 12% of payroll records",
        "body": "**Context:** Mid-year payroll integration with a third-party EWA provider. Outbound, daily. Studio assembly with 7 transformation steps.\n\n**Problem:** Reconciliation showed 12% record loss between source and destination. No errors. Process status: completed successfully. Every. Single. Day.\n\n**What I tried (in order):**\n1. Verified the source XML — all records present. ✓\n2. Counted records at each Studio assembly step — first 3 steps clean.\n3. At step 4 (a `Transformation` step with custom XSLT), the count dropped.\n4. Stared at the XSLT for an hour. Nothing obvious.\n5. Enabled `xsl:message` debugging on the transformation step.\n\n**What worked:**\n\nThe XSLT had this:\n```xml\n<xsl:for-each select=\"worker[active='true']\">\n```\n\nProblem: `active` was sometimes `'TRUE'` (uppercase), sometimes `'1'`, sometimes `'true'`. The integration was case-sensitive AND value-sensitive.\n\nFix:\n```xml\n<xsl:for-each select=\"worker[translate(active, 'TRUE1', 'true1') = 'true' or active = '1']\">\n```\n\n**Key lesson:** Workday Studio doesn't warn you when an `xsl:for-each` filters out rows. Silent data loss is the worst kind. Now I always add a `<xsl:message>` after every filter step showing the count delta.",
        "tags": ["studio", "debugging", "payroll", "xslt"], "is_solved": False, "vote_count": 89,
        "answers": [
            {"author_username": "tomek_v",
             "body": "This is gold. We've started building a 'studio audit step' as a standard pattern — every integration outputs row counts at each step into a calculated field log. Caught two similar bugs in the last quarter.",
             "vote_count": 24, "is_accepted": False},
            {"author_username": "raj_n",
             "body": "The `translate()` trick for case-insensitive XSLT is criminally underused. Bookmarking.",
             "vote_count": 14, "is_accepted": False},
        ],
    },
    {
        "space_slug": "career-lounge", "type": "question",
        "author_username": "priya_hcm",
        "title": "What does a Workday architect interview at a Big 4 firm actually look like? Questions they asked me",
        "body": "Just went through a final-round Workday Solution Architect interview at one of the Big 4. Sharing the questions because I couldn't find anything specific online:\n\n1. Walk me through how you'd architect Workday security for a global org with 80k employees and 3 unionized populations.\n2. A client wants to migrate from SAP HCM to Workday in 8 months. Walk us through your risk register on day one.\n3. How do you decide between Studio and EIB for a given integration?\n4. Describe a time a client pushed back on a Workday best practice. How did you handle it?\n\nDidn't get the role (3rd round) but they said feedback was 'strong technically, want to see more delivery leadership exposure.' Anyone else been through this loop?",
        "tags": ["interview", "career", "big4"], "is_solved": True, "vote_count": 71,
        "answers": [
            {"author_username": "raj_n",
             "body": "Did the same loop 2 years ago, got the offer. The 'risk register on day one' question is the differentiator — they want to see you list *named* risks (e.g., 'parallel payroll variance > 0.5%', 'role mapping signoff from CFO not secured by week 4') rather than generic ones ('scope creep'). The named-risk muscle takes years and they know it.",
             "vote_count": 38, "is_accepted": True},
            {"author_username": "sara_devlin",
             "body": "Push back on best practice question is a culture-fit signal. They want to see you didn't just cave OR dig in — they want the framing 'here's the principle, here's the client constraint, here's the compromise we landed on with documented tradeoffs.'",
             "vote_count": 16, "is_accepted": False},
        ],
    },
    {
        "space_slug": "reporting", "type": "discussion",
        "author_username": "tomek_v",
        "title": "BIRT vs Composite Report for executive dashboards — when does each actually make sense?",
        "body": "I see practitioners default to Composite reports because they're easier to build. But for any exec-facing dashboard with print/PDF requirements, BIRT wins on layout control by a mile.\n\nMy heuristic:\n- BIRT: PDF distribution, fixed-layout regulatory reports, anything that gets printed\n- Composite: interactive drilldowns, audience-built, dashboard-style consumption\n\nWhat's your decision tree?",
        "tags": ["birt", "composite", "reporting"], "is_solved": False, "vote_count": 22,
        "answers": [
            {"author_username": "elena_carter",
             "body": "Add a third axis: data freshness. Composite reports can hit Prism for near-real-time data; BIRT historically struggled here. If the exec wants 'as of this morning' numbers, lean Composite. If they want 'as of fiscal close', BIRT.",
             "vote_count": 12, "is_accepted": False},
        ],
    },
    {
        "space_slug": "security", "type": "success_story",
        "author_username": "raj_n",
        "title": "We reduced our Workday role count from 847 to 112 — here's the framework we used",
        "body": "**Context:** Inherited a Workday tenant with 847 distinct security roles. Every audit took 6 weeks. Onboarding a new business unit meant cloning 80+ roles.\n\n**Problem:** Role explosion caused by 5 years of 'just add a new role for this exception' decisions. No taxonomy.\n\n**What I tried:**\n\n1. **Inventory:** Pulled all roles, mapped each to its actual users and used domains.\n2. **Pattern detection:** ~60% of roles were near-duplicates of 18 'archetype' roles, varying by org or BU.\n3. **Archetype + constraint model:** Defined 18 archetype personas. Used intersection groups for BU/org scoping instead of cloning.\n4. **SoD baseline:** Defined 23 conflict pairs upfront, embedded in the new taxonomy.\n5. **Migration script:** Built a calculated-field-driven role reassignment that ran nightly during cutover.\n\n**Result:** 847 → 112 roles. Audit time dropped from 6 weeks to 9 days. New BU onboarding: 2 days of role provisioning vs. 3 weeks.\n\n**Key lesson:** Role count is a vanity metric — but it's also a *leading indicator of audit cost*. If yours is over 300, you have a taxonomy problem, not a security problem.",
        "tags": ["security", "role-design", "audit"], "is_solved": False, "vote_count": 124,
        "answers": [
            {"author_username": "elena_carter",
             "body": "The archetype + intersection pattern is the right answer for 95% of multi-BU tenants. Saving this thread to send to clients.",
             "vote_count": 31, "is_accepted": False},
            {"author_username": "sara_devlin",
             "body": "Curious — did you find any roles that *should* have been kept as exceptions? The instinct is to consolidate everything, but sometimes exception roles exist for good audit reasons.",
             "vote_count": 18, "is_accepted": False},
        ],
    },
    {
        "space_slug": "payroll", "type": "question",
        "author_username": "kenji_w",
        "title": "Employee Central Payroll cutover checklist — what do you validate in the last 48 hours?",
        "body": "Going live with ECP next month. I have the standard cutover plan, but I want to hear from people who've done this: what are the validations in the last 48 hours that are easy to skip and catastrophic to miss?",
        "tags": ["ecp", "payroll", "cutover"], "is_solved": False, "vote_count": 18,
        "answers": [
            {"author_username": "sara_devlin",
             "body": "Top 5 I always check in the final 48:\n1. **Tax authority registrations** are active in production (not just config'd) for every legal entity\n2. **Bank file format certification** — a test bank file delivered and confirmed by the bank, not just internal validation\n3. **Year-to-date balances** reconciled to the last legacy payroll run, including pre-tax deductions\n4. **Garnishment orders** — re-loaded post-conversion, NOT migrated balances (this catches people)\n5. **Off-cycle process validated** — at least one off-cycle run executed end-to-end in prod with a real employee",
             "vote_count": 19, "is_accepted": False},
        ],
    },
    {
        "space_slug": "compensation", "type": "question",
        "author_username": "ana_lopez",
        "title": "Advanced Comp eligibility rules — how do you handle expat/inpat populations cleanly?",
        "body": "Building merit cycle for a global comp program. Expats receive comp from home country plan, but their org assignment is in host country. Default eligibility rules pick up the host country plan, which is wrong.\n\nCalculated field on 'home country' or use compensation-specific eligibility override?",
        "tags": ["advanced-comp", "merit", "expat"], "is_solved": False, "vote_count": 14,
        "answers": [
            {"author_username": "sara_devlin",
             "body": "Calculated field on 'home country' is cleaner long-term but harder to debug. Eligibility override is faster to implement but you'll forget about it in 2 years and someone will be confused.\n\nIf this is a long-lived program, do the calculated field. If it's a one-off cycle, override is fine.",
             "vote_count": 8, "is_accepted": False},
        ],
    },
    {
        "space_slug": "core-hcm", "type": "question",
        "author_username": "marcus_t",
        "title": "What's the cleanest way to model a contingent worker that converts to FTE without losing tenure?",
        "body": "Standard 'End Contingent Worker Contract' + 'Hire' loses the original start date for tenure calculations. We want anniversaries, vesting, and PTO accruals to reference the original engagement date.\n\nCustom field on the worker profile + calculated field for 'effective tenure'? Or is there a cleaner pattern?",
        "tags": ["contingent-worker", "tenure", "core-hcm"], "is_solved": False, "vote_count": 11,
        "answers": [
            {"author_username": "raj_n",
             "body": "Custom 'Original Engagement Date' field + calculated field is the standard pattern. There's no native 'convert with continuity' transaction in Workday — they expect you to model it via custom fields.",
             "vote_count": 7, "is_accepted": False},
        ],
    },
    # Lighter posts to fill volume
    {
        "space_slug": "career-lounge", "type": "discussion",
        "author_username": "sara_devlin",
        "title": "Independent Workday consultant rates in 2026 — what are you seeing in EMEA?",
        "body": "Sharing market rates for the practitioner crowd. UK day rates I'm seeing in Q1 2026: junior consultants £450-600, mid £600-850, senior architects £950-1400. What's the picture in Germany, France, Netherlands?",
        "tags": ["rates", "freelance", "emea"], "is_solved": False, "vote_count": 38, "answers": [
            {"author_username": "tomek_v",
             "body": "Poland: senior architect day rates €550-750. Significant uplift if Polish-speaking remote for German clients.",
             "vote_count": 9, "is_accepted": False},
        ],
    },
    {
        "space_slug": "financials", "type": "question",
        "author_username": "priya_hcm",
        "title": "Accounting Center: when does it actually pay off vs custom journal lines from HCM events?",
        "body": "Implementing Workday Financials alongside HCM. Accounting Center sits between them. Sales pitch says it eliminates custom journal logic, but the configuration overhead is non-trivial.\n\nAt what client size / complexity does it pay off?",
        "tags": ["financials", "accounting-center"], "is_solved": False, "vote_count": 9, "answers": [],
    },
    {
        "space_slug": "integrations", "type": "discussion",
        "author_username": "tomek_v",
        "title": "REST APIs vs Core Connectors for IdP sync — has anyone actually moved away from Core Connectors?",
        "body": "Workday's REST APIs have matured a lot. For provisioning/deprovisioning to IdPs (Okta, Entra), I'm wondering if anyone has migrated off Core Connectors entirely. Tradeoffs?",
        "tags": ["rest-api", "core-connectors", "idp"], "is_solved": False, "vote_count": 16, "answers": [
            {"author_username": "elena_carter",
             "body": "We moved Okta provisioning to REST + custom orchestration last year. Wouldn't go back. Core Connectors gave us 0 visibility into failures. REST + retry queue + observability = night and day.",
             "vote_count": 14, "is_accepted": False},
        ],
    },
    {
        "space_slug": "reporting", "type": "success_story",
        "author_username": "tomek_v",
        "title": "Cut executive headcount report runtime from 9 minutes to 11 seconds — what we changed",
        "body": "Exec headcount dashboard ran nightly, took 9 minutes. Frustrating but tolerable. Then they asked for it to run on-demand from a manager portal. 9 minutes was a non-starter.\n\n**What we did:**\n1. Replaced 14 calculated fields with a single aggregating calculated field that pre-computed at worker level\n2. Moved the report data source from 'All Workers' to 'Active Workers as of Effective Date' (huge difference)\n3. Cached the org hierarchy lookup using a custom report-level calculated field\n\nRuntime: 9m → 11s. Not always possible but always worth checking your calculated field count.",
        "tags": ["reporting", "performance", "calculated-fields"], "is_solved": False, "vote_count": 52,
        "answers": [
            {"author_username": "raj_n",
             "body": "Calculated field count is the #1 silent killer of report performance. We have an internal rule: more than 8 calc fields = mandatory architecture review.",
             "vote_count": 18, "is_accepted": False},
        ],
    },
    {
        "space_slug": "core-hcm", "type": "question",
        "author_username": "kenji_w",
        "title": "Best practice for handling LOA (Leave of Absence) returns when the original position is filled?",
        "body": "Employee returns from a 9-month LOA. Their original position has been backfilled. Options: place them in a new position, return them to a different role, or unfilled placeholder. What's the cleanest data model?",
        "tags": ["loa", "position", "core-hcm"], "is_solved": False, "vote_count": 7, "answers": [],
    },
]


async def seed_all(db, hash_password):
    # Spaces
    for sp in SPACES:
        existing = await db.spaces.find_one({"slug": sp["slug"]})
        if not existing:
            await db.spaces.insert_one({
                "id": str(uuid.uuid4()),
                "slug": sp["slug"],
                "name": sp["name"],
                "description": sp["description"],
                "icon": sp["icon"],
                "post_count": 0,
                "member_count": 0,
                "created_at": iso(datetime.now(timezone.utc)),
            })

    # Users
    for u in USERS:
        existing = await db.users.find_one({"username": u["username"]})
        if existing:
            continue
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": f"{u['username']}@hcmorbit.demo",
            "username": u["username"],
            "full_name": u["full_name"],
            "password_hash": hash_password("Demo123!"),
            "avatar_url": None,
            "bio": u.get("bio"),
            "group_type": u["group_type"],
            "workday_modules": u.get("workday_modules", []),
            "years_experience": u.get("years_experience"),
            "company_name": u.get("company_name"),
            "location": u.get("location"),
            "linkedin_url": None,
            "reputation_score": u.get("reputation_score", 0),
            "is_verified": True,
            "onboarded": True,
            "auth_provider": "email",
            "created_at": iso(datetime.now(timezone.utc) - timedelta(days=120)),
        })

    # Posts
    if await db.posts.count_documents({}) > 0:
        return  # already seeded

    spaces_by_slug = {s["slug"]: s async for s in db.spaces.find({}, {"_id": 0})}
    users_by_username = {u["username"]: u async for u in db.users.find({}, {"_id": 0, "password_hash": 0})}

    now = datetime.now(timezone.utc)
    for idx, p in enumerate(POSTS):
        sp = spaces_by_slug.get(p["space_slug"])
        author = users_by_username.get(p["author_username"])
        if not sp or not author:
            continue
        post_id = str(uuid.uuid4())
        created = now - timedelta(days=idx, hours=idx * 3 % 24)
        await db.posts.insert_one({
            "id": post_id,
            "space_id": sp["id"],
            "author_id": author["user_id"],
            "type": p["type"],
            "title": p["title"],
            "body": p["body"],
            "tags": p.get("tags", []),
            "vote_count": p.get("vote_count", 0),
            "answer_count": len(p.get("answers", [])),
            "view_count": p.get("vote_count", 0) * 17 + 42,
            "is_solved": p.get("is_solved", False),
            "accepted_answer_id": None,
            "is_pinned": False,
            "created_at": iso(created),
            "updated_at": iso(created),
        })
        await db.spaces.update_one({"id": sp["id"]}, {"$inc": {"post_count": 1}})

        accepted_id = None
        for j, a in enumerate(p.get("answers", [])):
            a_author = users_by_username.get(a["author_username"])
            if not a_author:
                continue
            ans_id = str(uuid.uuid4())
            if a.get("is_accepted"):
                accepted_id = ans_id
            await db.answers.insert_one({
                "id": ans_id,
                "post_id": post_id,
                "author_id": a_author["user_id"],
                "body": a["body"],
                "vote_count": a.get("vote_count", 0),
                "is_accepted": a.get("is_accepted", False),
                "created_at": iso(created + timedelta(hours=j + 4)),
                "updated_at": iso(created + timedelta(hours=j + 4)),
            })
        if accepted_id:
            await db.posts.update_one(
                {"id": post_id},
                {"$set": {"accepted_answer_id": accepted_id, "is_solved": True}},
            )
