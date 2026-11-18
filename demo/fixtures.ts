import type { Actor, Intake, Settings } from "../src/core/model";

export const demoUsers: Actor[] = [
  { id: "e5e4a43f-6ddf-4b3c-ac8d-47143503e1c0", role: "operations", name: "Priya Nair" },
  { id: "498efb1a-2542-4ea7-9f7b-5de8cae51771", role: "manager", name: "Arjun Rao" },
  { id: "0682d87d-a46c-4881-9a5a-7de1366c9fd9", role: "accounts", name: "Maya Shah" },
  { id: "bd4a2db3-c2e5-484d-8cd5-b86319e7a7e3", role: "admin", name: "Dev Mehta" },
];

export const defaultWorkflow: Settings = {
  version: 1,
  required: ["customer", "billOfLading", "arrivalPort", "eta"],
  marginBps: 1500,
  milestones: [
    { id: "879d0499-42a7-4680-ac7e-35aca8c80e72", label: "Documents reviewed", hours: 24 },
    { id: "98c95df8-62b7-41f1-9fac-9b0960d2c9ac", label: "Customs cleared", hours: 24 },
    { id: "472b84db-2446-45e5-bf73-d565b16155dd", label: "Release confirmed", hours: 24 },
  ],
  labels: {
    needs_review: "Needs Review", ready: "Ready to quote", draft: "Awaiting approval", approved: "Approved",
    active: "Active", billing_ready: "Billing ready", closed: "Closed", open: "Open", resolved: "Resolved",
  },
  jobStatuses: [
    { id: "92596f50-eac1-4790-b8bd-167d4f1cda39", label: "Awaiting documents" },
    { id: "44539100-5452-46fd-950c-4c13c4f48505", label: "Customs query" },
  ],
  grants: {
    operations: ["read", "intake.write", "quote.draft", "job.advance", "exception.manage"],
    manager: ["read", "quote.approve"],
    accounts: ["read", "billing.close"],
    admin: ["read", "config.manage"],
  },
};

export const exampleEnquiry: Intake = {
  customer: "Northstar Retail India", billOfLading: "SYN-BL-8803",
  arrivalPort: "Nhava Sheva", eta: "2026-12-15", consignee: "Northstar Retail India",
};

export const exampleRate = { cents: 125_000, currency: "INR" };

export const inboxEnquiries: Intake[] = [
  { customer: "Orchid Homewares (Demo)", billOfLading: "SYN-BL-4101", arrivalPort: "Nhava Sheva", eta: "2026-12-16", consignee: "Orchid Homewares (Demo)" },
  { customer: "Delta Components (Demo)", billOfLading: "SYN-BL-4102", arrivalPort: "Mundra", eta: "2026-12-18", consignee: "Delta Components (Demo)" },
  { customer: "Cedar Instruments (Demo)", billOfLading: "SYN-BL-4103", arrivalPort: "", eta: "2026-12-19", consignee: "Cedar Instruments (Demo)" },
  { customer: "Harbor Textiles (Demo)", billOfLading: "", arrivalPort: "Chennai", eta: "", consignee: "Harbor Textiles (Demo)" },
];
