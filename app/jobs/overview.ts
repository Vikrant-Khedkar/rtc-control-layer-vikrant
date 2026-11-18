import { billingState, currentStage, openExceptions, stageDeadline, type Job } from "../../src/core/model";

export function overviewRow(job: Job, now: number) {
  const deadline = stageDeadline(job);
  return {
    job,
    stage: currentStage(job),
    issues: openExceptions(job),
    billing: billingState(job),
    deadline,
    overdue: deadline !== undefined && deadline.getTime() < now,
  };
}

export type OverviewRow = ReturnType<typeof overviewRow>;
