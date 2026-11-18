import { can, type Actor, type Intake } from "../src/core/model";
import type { WorkStore } from "../src/core/ports";
import type { createWorkflow } from "../src/core/workflow";
import { exampleEnquiry } from "./fixtures";

const examples: { ref: string; data: Intake; scenario: "milestone" | "exception" | "billing" }[] = [
  {
    ref: "DEMO-JOB-DOCUMENTS",
    data: { ...exampleEnquiry, customer: "Atlas Hardware (Demo)", billOfLading: "SYN-BL-5101", consignee: "Atlas Hardware (Demo)" },
    scenario: "milestone",
  },
  {
    ref: "DEMO-JOB-CUSTOMS-QUERY",
    data: { ...exampleEnquiry, customer: "Marigold Appliances (Demo)", billOfLading: "SYN-BL-5102", consignee: "Marigold Appliances (Demo)" },
    scenario: "exception",
  },
  {
    ref: "DEMO-JOB-BILLING",
    data: { ...exampleEnquiry, customer: "Juniper Warehousing (Demo)", billOfLading: "SYN-BL-5103", consignee: "Juniper Warehousing (Demo)" },
    scenario: "billing",
  },
];

export async function seedDemoJobs(
  workflow: ReturnType<typeof createWorkflow>,
  store: WorkStore,
  operations: Actor,
  manager: Actor,
) {
  const settings = await store.read.settings();
  if (!can(settings, operations, "intake.write") || !can(settings, operations, "quote.draft") ||
    !can(settings, manager, "quote.approve")) return;
  for (const { ref, data, scenario } of examples) {
    if (scenario === "exception" && !can(settings, operations, "exception.manage")) continue;
    if (scenario === "billing" && !can(settings, operations, "job.advance")) continue;

    const enquiry = await workflow.createEnquiry(operations, ref, data, "import");
    const quote = await workflow.draftQuote(operations, enquiry.id);
    if (!quote || await store.read.jobByQuote(quote.id)) continue;
    const job = await workflow.approveQuote(manager, quote.id);
    if (scenario === "exception") {
      await workflow.raiseException(operations, job.id, {
        description: "Customs document query", ownerId: operations.id,
        recovery: "Verify the replacement commercial invoice placeholder and record the outcome.",
      });
    }
    if (scenario === "billing") {
      for (const milestone of job.milestones) await workflow.advanceJob(operations, job.id, milestone.id);
    }
  }
}
