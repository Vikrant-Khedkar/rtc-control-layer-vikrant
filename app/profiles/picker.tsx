"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { demoUsers } from "../../demo/fixtures";
import type { Role } from "../../src/core/model";
import { chooseRole } from "../actions";

const responsibilities: Record<Role, string> = {
  operations: "Review enquiries and work on shipments",
  manager: "Review and approve draft quotes",
  accounts: "Review billing readiness and close jobs",
  admin: "Manage milestones, statuses and permissions",
};

export function ProfilePicker({ current, gate, returnTo }: { current?: Role; gate?: boolean; returnTo: string }) {
  const [selectedRole, setSelectedRole] = useState<Role>(current ?? "operations");
  const [state, action, pending] = useActionState(chooseRole, {});
  const selected = demoUsers.find((person) => person.role === selectedRole)!;
  return <form action={action} className="space-y-5">
    <input type="hidden" name="returnTo" value={returnTo} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <legend className="sr-only">Demo profiles</legend>
      {demoUsers.map((person) => <label key={person.role} className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:outline-2 focus-within:outline-wine ${selectedRole === person.role ? "border-wine bg-rosewash" : "border-line bg-white hover:bg-canvas"}`}>
        <input className="sr-only" type="radio" name="role" value={person.role} checked={selectedRole === person.role}
          onChange={() => setSelectedRole(person.role)} aria-label={`${person.name}, ${person.role}`} />
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-wine text-sm font-bold text-white">
          {person.name.split(" ").map((part) => part[0]).join("")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{person.name}</span>
          <span className="block text-xs font-semibold capitalize text-wine">{person.role}{person.role === current ? " · Current" : ""}</span>
          <span className="mt-1 block text-xs text-muted">{responsibilities[person.role]}</span>
        </span>
        {selectedRole === person.role && <Check size={16} className="shrink-0 text-wine" aria-hidden />}
      </label>)}
    </fieldset>
    {gate && <label className="block"><span className="label">Reviewer access code</span>
      <input required name="code" type="password" autoComplete="off" className="field" /></label>}
    <button type="submit" className="button primary" disabled={pending || current === selectedRole}>
      {pending ? <><LoaderCircle className="animate-spin motion-reduce:animate-none" size={16} /> Signing in as {selected.name}…</>
        : <>Continue as {selected.name} <ArrowRight size={16} /></>}
    </button>
    {pending && <span className="sr-only" role="status">Opening the {selected.role} workspace.</span>}
    {state.error && <p role="alert" className="text-sm text-wine">{state.error}</p>}
  </form>;
}
