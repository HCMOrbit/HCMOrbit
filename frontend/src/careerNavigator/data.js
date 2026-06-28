// src/careerNavigator/data.js
export const TRACKS = [
  { id:"payroll", name:"Payroll", icon:"cash", blurb:"Gross-to-net, integrations, compliance", guideCount:18, popular:true,
    stages:{ "leveling-up":{ leadsTo:["Senior Payroll Specialist","Payroll Lead"], phases:[
      { n:1, title:"Own gross-to-net", timeframe:"Months 0–3", summary:"Pay groups, earnings, deductions, and how a worker's position drives pay eligibility.",
        guides:[{docId:"WDPAY-001",title:"Pay group design & assignment"},{docId:"WDPAY-104",title:"Earnings & deduction architecture"}],
        checkpoint:"Explain a retro pay calc" },
      { n:2, title:"Run & audit the pay calc", timeframe:"Months 3–6", summary:"Period processing, off-cycles, and reading a pay calc when a run doesn't balance.",
        guides:[{docId:"WDPAY-112",title:"Pay calculation troubleshooting"},{docId:"PAYAUD-101",title:"Payroll audit reports playbook"}],
        checkpoint:"Diagnose a failed pay run" },
      { n:3, title:"Connect payroll to the tenant", timeframe:"Months 6–9", summary:"Inbound and outbound payroll integrations, and payroll accounting through to the GL.",
        guides:[{docId:"PAYINT-101",title:"Payroll integration patterns"},{docId:"PAYACC-101",title:"Payroll accounting & costing"}],
        checkpoint:"Map a payroll-to-GL posting" },
      { n:4, title:"Compliance & go-live readiness", timeframe:"Months 9–12", summary:"Reporting, parallel testing, and the controls that keep payroll audit-clean.",
        guides:[{docId:"PAYRPT-101",title:"Payroll reporting essentials"},{docId:"PAYAUD-106",title:"Parallel testing & cutover"}],
        checkpoint:"Design a parallel test plan" },
    ]}, "starting-out":{leadsTo:[],phases:[]}, "going-architect":{leadsTo:[],phases:[]} } },
  { id:"core-hcm", name:"Core HCM", icon:"building", blurb:"Org design, positions, effective dating", guideCount:22, popular:false, stages:{} },
  { id:"integrations", name:"Integrations", icon:"plug", blurb:"Studio, Core Connectors, EIB, APIs", guideCount:16, popular:false, stages:{} },
  { id:"security", name:"Security", icon:"lock", blurb:"Domains, groups, SoD, audit controls", guideCount:14, popular:false, stages:{} },
  { id:"reporting", name:"Reporting", icon:"chart", blurb:"Custom reports, Prism, RaaS", guideCount:15, popular:false, stages:{} },
  { id:"recruiting", name:"Recruiting", icon:"userplus", blurb:"Reqs, candidates, offers, onboarding", guideCount:13, popular:false, stages:{} },
  { id:"benefits", name:"Benefits", icon:"heart", blurb:"Plans, eligibility, open enrollment", guideCount:11, popular:false, stages:{} },
  { id:"absence", name:"Absence", icon:"calendar", blurb:"Time off, leave, accruals", guideCount:9, popular:false, stages:{} },
];

export const INDUSTRIES = [
  { id:"healthcare", name:"Healthcare", demand:"High", hotModules:["Core HCM","Absence","Payroll"],
    risingRole:"HRIS Analyst → Integration Specialist",
    insight:"Healthcare and public-sector tenants run deeper supervisory hierarchies and intricate leave and accrual rules. Practitioners who can design for that depth stand out.",
    guides:[{docId:"HCM-CORE-KB-001",title:"Core HCM org design"},{docId:"ABS-101",title:"Absence & leave accruals"}], matchTrackId:"core-hcm" },
  { id:"higher-ed", name:"Higher Ed", demand:"Medium", hotModules:[], risingRole:"", insight:"", guides:[], matchTrackId:"core-hcm" },
  { id:"financial-services", name:"Financial Services", demand:"High", hotModules:[], risingRole:"", insight:"", guides:[], matchTrackId:"security" },
  { id:"retail", name:"Retail", demand:"Medium", hotModules:[], risingRole:"", insight:"", guides:[], matchTrackId:"absence" },
  { id:"technology", name:"Technology", demand:"Medium", hotModules:[], risingRole:"", insight:"", guides:[], matchTrackId:"integrations" },
  { id:"government", name:"Government", demand:"Medium", hotModules:[], risingRole:"", insight:"", guides:[], matchTrackId:"security" },
  { id:"manufacturing", name:"Manufacturing", demand:"Medium", hotModules:[], risingRole:"", insight:"", guides:[], matchTrackId:"payroll" },
];

export const RECENT_GOLIVES = [ // illustrative until a real submission flow exists
  { org:"Regional health system", region:"Americas", modules:"Core HCM, Payroll, Absence", when:"this quarter" },
  { org:"Public university", region:"EMEA", modules:"Core HCM, Recruiting", when:"last quarter" },
  { org:"Specialty manufacturer", region:"APAC", modules:"Payroll, Integrations", when:"this quarter" },
];

export const HEATING_UP = [
  { label:"Payroll integrations" }, { label:"Prism & analytics" },
  { label:"Security & SoD redesign" }, { label:"Absence & leave" },
];

export const INTERVIEW_SETS = {
  payroll:{ core:{count:42, reviewLabel:"Review the 18 Payroll guides"}, scenario:{count:28, reviewLabel:"Review the linked failure-pattern guides"} },
};

export const STAGES = [
  { id:"starting-out", label:"Starting out" },
  { id:"leveling-up", label:"Leveling up" },
  { id:"going-architect", label:"Going architect" },
];

// Goal-assembler: each goal recombines EXISTING content (articles, interview
// sets, scenarios) into one outcome-first plan. No new content is authored here.
export const GOALS = [
  { id:"payroll-interview", label:"Prep for a Payroll interview", trackId:"payroll", estimateMin:18,
    plan:{ articles:["WDPAY-001","WDPAY-112","PAYAUD-101"], questionSetId:"payroll", scenarios:2, checklist:"Payroll go-live readiness" } },
  { id:"payroll-job-ready", label:"Get job-ready as a Payroll Consultant", trackId:"payroll", estimateMin:240,
    plan:{ articles:["WDPAY-001","WDPAY-104","WDPAY-112","PAYINT-101","PAYACC-101","PAYRPT-101"], questionSetId:"payroll", scenarios:3, checklist:"Payroll consultant readiness" } },
];
