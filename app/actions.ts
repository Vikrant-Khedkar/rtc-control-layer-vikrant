"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { importDemoInbox } from "../demo/inbox";
import { intakeFields, permissions, roles, statusKeys, WorkflowError } from "../src/core/model";
import { services } from "../src/server/services";
import { cookieName, currentActor, isDemoEnabled, requireActor, secureDemoCookies } from "../src/server/session";

export type ActionResult = { error?: string; success?: string };
type Command = "import-inbox" | "create" | "edit" | "draft" | "approve" | "advance" | "set-job-status" | "raise" | "resolve" | "close" | "config";

function value(form: FormData, name: string) {
  const field = form.get(name);
  return typeof field === "string" ? field : "";
}

function recordId(form: FormData, name: string) {
  const result = z.uuid().safeParse(value(form, name));
  if (!result.success) throw new WorkflowError("invalid", "Missing or invalid record reference.");
  return result.data;
}

export async function chooseRole(_: ActionResult, form: FormData): Promise<ActionResult> {
  const role = z.enum(roles).safeParse(value(form, "role"));
  if (!role.success || !isDemoEnabled()) return { error: "The demo is unavailable." };
  const jar = await cookies();
  const session = await services().identity.switchTo(role.data, jar.get(cookieName)?.value);
  jar.set(cookieName, session.token, {
    httpOnly: true, secure: secureDemoCookies, sameSite: "lax", path: "/", expires: session.expiresAt,
  });
  redirect("/");
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token && await currentActor()) await services().identity.revoke(token);
  jar.delete(cookieName);
  jar.delete("rtc_guide");
  redirect("/");
}

export async function startTour() {
  await requireActor();
  (await cookies()).set("rtc_guide", "1", { httpOnly: true, sameSite: "lax", path: "/", secure: secureDemoCookies });
  redirect("/jobs");
}

export async function endTour() {
  await requireActor();
  (await cookies()).delete("rtc_guide");
}

export async function runCommand(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireActor();
  const { workflow } = services();
  const command = value(form, "command") as Command;
  const data = {
    customer: value(form, "customer"), billOfLading: value(form, "billOfLading"),
    arrivalPort: value(form, "arrivalPort"), eta: value(form, "eta"), consignee: value(form, "consignee"),
  };
  let destination: string | undefined;
  let needsReview = false;
  try {
    switch (command) {
      case "import-inbox":
        await importDemoInbox(workflow, actor, recordId(form, "batchId"));
        break;
      case "create": {
        const enquiry = await workflow.createEnquiry(actor, value(form, "sourceRef"), data);
        destination = `/enquiries/${enquiry.id}`;
        break;
      }
      case "edit":
        await workflow.editEnquiry(actor, recordId(form, "enquiryId"), data);
        break;
      case "draft":
        needsReview = !(await workflow.draftQuote(actor, recordId(form, "enquiryId")));
        break;
      case "approve": {
        const job = await workflow.approveQuote(actor, recordId(form, "quoteId"));
        destination = value(form, "fromBoard") === "1" ? `/jobs?enquiry=${job.enquiryId}` : `/jobs/${job.id}`;
        break;
      }
      case "advance":
        await workflow.advanceJob(actor, recordId(form, "jobId"), recordId(form, "stageId"));
        break;
      case "set-job-status":
        await workflow.setJobStatus(actor, recordId(form, "jobId"), value(form, "jobStatusId"));
        break;
      case "raise":
        await workflow.raiseException(actor, recordId(form, "jobId"), {
          description: value(form, "description"), ownerId: value(form, "ownerId"), recovery: value(form, "recovery"),
        });
        break;
      case "resolve":
        await workflow.resolveException(actor, recordId(form, "jobId"), recordId(form, "exceptionId"), value(form, "resolution"));
        break;
      case "close":
        await workflow.closeJob(actor, recordId(form, "jobId"));
        break;
      case "config": {
        const ids = form.getAll("stepId");
        const labels = form.getAll("stepLabel");
        const hours = form.getAll("stepHours");
        const jobStatusIds = form.getAll("customStatusId");
        const jobStatusLabels = form.getAll("customStatusLabel");
        const margin = z.string().trim().regex(/^\d+(\.\d{1,2})?$/).safeParse(value(form, "margin"));
        if (!margin.success) return { error: "Enter a margin with up to two decimal places." };
        await workflow.saveConfiguration(actor, Number(value(form, "version")), {
          required: intakeFields.filter((key) => form.has(`field:${key}`)),
          marginBps: Math.round(Number(margin.data) * 100),
          milestones: ids.map((id, index) => ({ id, label: labels[index], hours: Number(hours[index]) })),
          labels: Object.fromEntries(statusKeys.map((key) => [key, value(form, `status:${key}`)])),
          jobStatuses: jobStatusIds.map((id, index) => ({ id, label: jobStatusLabels[index] })),
          grants: Object.fromEntries(roles.map((role) => [
            role, permissions.filter((permission) => form.has(`grant:${role}:${permission}`)),
          ])),
        });
        break;
      }
      default:
        return { error: "Unknown workflow action." };
    }
  } catch (error) {
    if (error instanceof WorkflowError) return { error: error.message };
    console.error("RTC workflow command failed", { command, error: error instanceof Error ? error.name : "Unknown" });
    return { error: "The request could not be completed. Try again." };
  }
  revalidatePath("/", "layout");
  if (destination) redirect(destination);
  if (needsReview) return { error: "Correct the enquiry details before drafting the quote." };
  return { success: command === "import-inbox" ? "Sample enquiries imported." : "Saved." };
}
