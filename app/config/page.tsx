import { WorkflowError } from "../../src/core/model";
import { services } from "../../src/server/services";
import { requireActor } from "../../src/server/session";
import { ConfigurationForm } from "../forms";
import { AccessDenied, Badge, Heading, Shell } from "../ui";

export default async function Configuration() {
  const actor = await requireActor();
  const settings = await services().workflow.configuration(actor).catch((error: unknown) => {
    if (error instanceof WorkflowError && error.code === "forbidden") return undefined;
    throw error;
  });
  return <Shell actor={actor} path="/config">
    {settings ? <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading title="Admin Configuration" text="Manage the Sea Import Customs workflow for this demo." />
        <Badge text={`Version ${settings.version}`} />
      </div>
      <ConfigurationForm key={settings.version} settings={settings} />
    </> : <AccessDenied />}
  </Shell>;
}
