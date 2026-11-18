import type { Actor } from "../src/core/model";
import type { createWorkflow } from "../src/core/workflow";
import { inboxEnquiries } from "./fixtures";

export async function importDemoInbox(workflow: ReturnType<typeof createWorkflow>, actor: Actor, batch: string) {
  for (const [index, data] of inboxEnquiries.entries()) {
    await workflow.createEnquiry(actor, `INBOX-${batch}-${String(index + 1).padStart(2, "0")}`, data, "import");
  }
}
