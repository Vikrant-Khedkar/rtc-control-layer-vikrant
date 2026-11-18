"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { chooseRole, runCommand } from "./actions";
import { intakeFields, intakeLabels, permissions, roles, statusKeys, type Intake, type Role, type Settings } from "../src/core/model";
import { exampleEnquiry } from "../demo/fixtures";

export function RoleForm({ role, gate, returnTo }: { role?: Role; gate?: boolean; returnTo: string }) {
  const [state, action, pending] = useActionState(chooseRole, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="returnTo" value={returnTo} />
      {gate && <label className="min-w-52 flex-1"><span className="label">Reviewer access code</span>
        <input required name="code" type="password" autoComplete="off" className="field" /></label>}
      <label><span className={role ? "sr-only" : "label"}>Demo role</span>
        <select name="role" defaultValue={role ?? "operations"} className="field capitalize">
          {roles.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
        </select></label>
      <button type="submit" className={role ? "button" : "button primary"} disabled={pending}>
        {role ? "Switch role" : "Enter workspace"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-wine">{state.error}</p>}
    </form>
  );
}

export function CommandForm({ command, ids, label, children, secondary, className }: {
  command: string; ids?: Record<string, string>; label: string; children?: ReactNode; secondary?: boolean; className?: string;
}) {
  const [state, action, pending] = useActionState(runCommand, {});
  return (
    <form action={action} className={className ?? "space-y-3"}>
      <input type="hidden" name="command" value={command} />
      {Object.entries(ids ?? {}).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      {children}
      <button type="submit" disabled={pending} className={secondary ? "button" : "button primary"}>{pending ? "Saving…" : label}</button>
      {state.error && <p role="alert" className="text-sm font-medium text-wine">{state.error}</p>}
      {state.success && <p role="status" className="text-sm font-medium text-emerald-700">{state.success}</p>}
    </form>
  );
}

export function IntakeForm({ reference, required, existing }: {
  reference: string; required: Settings["required"]; existing?: { id: string; data: Intake };
}) {
  const [sample, setSample] = useState(false);
  const intake = existing?.data ?? (sample ? exampleEnquiry : undefined);
  return (
    <CommandForm command={existing ? "edit" : "create"} ids={existing ? { enquiryId: existing.id } : undefined}
      label={existing ? "Save enquiry" : "Create enquiry"}>
      <div className="grid gap-3 sm:grid-cols-2" key={existing?.id ?? Number(sample)}>
        {!existing && <label><span className="label">Intake reference</span>
          <input required className="field" name="sourceRef" defaultValue={reference} maxLength={80} /></label>}
        {intakeFields.map((field) => <label key={field}>
          <span className="label">{intakeLabels[field]} {required.includes(field) && <span className="text-wine">*</span>}</span>
          <input className="field" name={field} defaultValue={intake?.[field]} maxLength={field === "eta" ? 35 : 100}
            placeholder={field === "eta" ? "YYYY-MM-DD" : undefined} />
        </label>)}
      </div>
      {!existing && <button type="button" className="button mr-2" onClick={() => setSample(true)}>Load synthetic sample</button>}
    </CommandForm>
  );
}

const actionLabels: Record<(typeof permissions)[number], string> = {
  read: "View workspace", "intake.write": "Create and edit enquiries", "quote.draft": "Draft quote",
  "quote.approve": "Approve quote", "job.advance": "Complete milestones", "exception.manage": "Manage exceptions",
  "billing.close": "Close billing-ready job", "config.manage": "Edit configuration",
};
const restricted: Record<string, Role> = { "quote.approve": "manager", "billing.close": "accounts", "config.manage": "admin" };

export function ConfigurationForm({ settings }: { settings: Settings }) {
  const [steps, setSteps] = useState(settings.milestones);

  function move(index: number, offset: number) {
    const next = [...steps];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setSteps(next);
  }

  return (
    <CommandForm command="config" ids={{ version: String(settings.version) }} label="Save configuration" className="space-y-5">
      <section className="panel pad">
        <h2 className="font-semibold">Milestones</h2>
        <p className="quiet mt-1 mb-4">The order and target hours apply to jobs created after this change.</p>
        <div className="space-y-3">
          {steps.map((step, index) => <div key={step.id} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="stepId" value={step.id} />
            <label className="min-w-40 flex-1"><span className="label">Step {index + 1}</span>
              <input name="stepLabel" className="field" defaultValue={step.label} maxLength={80} required /></label>
            <label className="w-24"><span className="label">SLA hours</span>
              <input name="stepHours" className="field" type="number" defaultValue={step.hours} min={1} max={720} required /></label>
            <button type="button" className="button !px-2" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ChevronUp size={16} /></button>
            <button type="button" className="button !px-2" aria-label={`Move step ${index + 1} down`} disabled={index === steps.length - 1} onClick={() => move(index, 1)}><ChevronDown size={16} /></button>
            <button type="button" className="button !px-2" aria-label={`Remove step ${index + 1}`} disabled={steps.length === 1}
              onClick={() => setSteps(steps.filter((item) => item.id !== step.id))}><Trash2 size={16} /></button>
          </div>)}
        </div>
        <button type="button" className="button mt-4" disabled={steps.length === 8}
          onClick={() => setSteps([...steps, { id: crypto.randomUUID(), label: "", hours: 24 }])}><Plus size={15} /> Add milestone</button>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel pad">
          <h2 className="font-semibold">Intake and pricing</h2>
          <fieldset className="my-4 space-y-2">
            <legend className="label">Required enquiry fields</legend>
            {intakeFields.map((field) => <label className="flex items-center gap-2 text-sm" key={field}>
              <input name={`field:${field}`} type="checkbox" defaultChecked={settings.required.includes(field)} className="accent-wine" />{intakeLabels[field]}
            </label>)}
          </fieldset>
          <label className="block max-w-48"><span className="label">Gross margin (%)</span>
            <input className="field" name="margin" type="number" min={0} max={95} step="0.01" required defaultValue={settings.marginBps / 100} /></label>
        </section>
        <section className="panel pad">
          <h2 className="mb-4 font-semibold">Status labels</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {statusKeys.map((key) => <label key={key}><span className="label capitalize">{key.replaceAll("_", " ")}</span>
              <input name={`status:${key}`} className="field" defaultValue={settings.labels[key]} required maxLength={40} /></label>)}
          </div>
        </section>
      </div>
      <section className="panel overflow-hidden">
        <div className="pad"><h2 className="font-semibold">Role permissions</h2><p className="quiet mt-1">Approval belongs to Manager. Closure belongs to Accounts. Administration access stays enabled.</p></div>
        <div className="overflow-x-auto"><table className="data-table whitespace-nowrap">
          <thead><tr><th>Action</th>{roles.map((role) => <th className="capitalize" key={role}>{role}</th>)}</tr></thead>
          <tbody>{permissions.map((permission) => <tr key={permission}><td>{actionLabels[permission]}</td>{roles.map((role) => {
            const name = `grant:${role}:${permission}`;
            const locked = role === "admin" && (permission === "read" || permission === "config.manage");
            const blocked = Boolean(restricted[permission] && restricted[permission] !== role);
            return <td key={role}>{locked && <input type="hidden" name={name} value="on" />}
              <input aria-label={`${role}: ${actionLabels[permission]}`} name={name} type="checkbox" className="accent-wine"
                defaultChecked={!blocked && settings.grants[role].includes(permission)} disabled={locked || blocked} /></td>;
          })}</tr>)}</tbody>
        </table></div>
      </section>
    </CommandForm>
  );
}
