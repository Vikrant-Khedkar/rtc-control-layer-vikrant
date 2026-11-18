"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function MilestoneTimeline({ completed, total, children }: { completed: number; total: number; children: ReactNode }) {
  const timeline = useRef<HTMLDivElement>(null);
  const submittedAtCount = useRef<number | null>(null);

  useEffect(() => {
    if (submittedAtCount.current === null || submittedAtCount.current === completed) return;
    submittedAtCount.current = null;
    if (document.activeElement !== document.body) return;
    const current = timeline.current?.querySelector<HTMLElement>('[aria-current="step"] h3');
    (current ?? timeline.current?.querySelector("h2"))?.focus();
  }, [completed]);

  return <div ref={timeline}>
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id="milestones" tabIndex={-1} className="font-semibold">Operational milestones</h2>
      <p role="status" className="text-xs font-medium tabular-nums text-muted">{completed} of {total} complete</p>
    </div>
    <ol className="mt-4 space-y-1" onSubmitCapture={() => { submittedAtCount.current = completed; }}>{children}</ol>
  </div>;
}
