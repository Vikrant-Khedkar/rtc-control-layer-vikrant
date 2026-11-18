"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { intakeFields, permissions, roles, statusKeys, WorkflowError } from "../src/core/model";
import { services } from "../src/server/services";
import { codeMatches, cookieName, currentActor, demoMode, requireActor } from "../src/server/session";

export type ActionResult = { error?: string; success?: string };
type Command = "create" | "edit" | "draft" | "approve" | "advance" | "raise" | "resolve" | "close" | "config";

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
  const mode = demoMode();
  if (!role.success || mode === "disabled") return { error: "The demo is unavailable." };
  if (mode === "protected" && !(await currentActor()) && !codeMatches(value(form, "code"))) {
    return { error: "Enter the reviewer access code." };
  }
  const jar = await cookies();
  const session = await services().identity.switchTo(role.data, jar.get(cookieName)?.value);
  jar.set(cookieName, session.token, {
    httpOnly: true, secure: mode === "protected", sameSite: "lax", path: "/", expires: session.expiresAt,
  });
  const returnTo = value(form, "returnTo");
  const safePath = /^\/(?:config|(?:enquiries|jobs)\/[a-f0-9-]{36}|tour(?:\?enquiry=[a-f0-9-]{36})?)$/;
  redirect(safePath.test(returnTo) ? returnTo : "/");
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token && await currentActor()) await services().identity.revoke(token);
  jar.delete(cookieName);
  redirect("/");
}

export async function runCommand(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireActor();
  const { workflow } = services();
  const command = value(form, "command") as Command;
  const guided = value(form, "guided") === "1";
  const data = {
    customer: value(form, "customer"), billOfLading: value(form, "billOfLading"),
    arrivalPort: value(form, "arrivalPort"), eta: value(form, "eta"), consignee: value(form, "consignee"),
  };
  let destination: string | undefined;
  let needsReview = false;
  try {
    switch (command) {
      case "create": {
        const enquiry = await workflow.createEnquiry(actor, value(form, "sourceRef"), data);
        destination = guided ? `/tour?enquiry=${enquiry.id}` : `/enquiries/${enquiry.id}`;
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
        destination = guided ? `/tour?enquiry=${job.enquiryId}` : `/jobs/${job.id}`;
        break;
      }
      case "advance":
        await workflow.advanceJob(actor, recordId(form, "jobId"), recordId(form, "stageId"));
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
        const margin = z.string().trim().regex(/^\d+(\.\d{1,2})?$/).safeParse(value(form, "margin"));
        if (!margin.success) return { error: "Enter a margin with up to two decimal places." };
        await workflow.saveConfiguration(actor, Number(value(form, "version")), {
          required: intakeFields.filter((key) => form.has(`field:${key}`)),
          marginBps: Math.round(Number(margin.data) * 100),
          milestones: ids.map((id, index) => ({ id, label: labels[index], hours: Number(hours[index]) })),
          labels: Object.fromEntries(statusKeys.map((key) => [key, value(form, `status:${key}`)])),
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
  return { success: "Saved." };
}
