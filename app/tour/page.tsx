import { Inbox, SearchCheck, Ship, Wallet } from "lucide-react";
import { requireActor } from "../../src/server/session";
import { startTour } from "../actions";
import { Heading, Shell } from "../ui";

export const metadata = { title: "Guided tour" };

const screens = [
  { icon: Inbox, title: "Enquiry review", text: "Open an incoming enquiry. If it needs review, check what’s missing and update it when you have the information." },
  { icon: SearchCheck, title: "Enquiry detail", text: "Draft an internal quote on the board. Switch to Manager and open Jobs → My queue to review and approve it." },
  { icon: Ship, title: "Job detail", text: "Switch back to Operations to complete milestones and handle a job exception." },
  { icon: Wallet, title: "Billing", text: "Switch to Accounts when the job is billing-ready. Close it and check the audit history." },
];

export default async function TourPage() {
  const actor = await requireActor();
  return <Shell actor={actor} path="/tour">
    <Heading title="Guided tour" text="Try the Sea Import Customs assessment using the same screens as each role." />
    <section className="panel pad space-y-5">
      <ol className="grid gap-4 sm:grid-cols-2">{screens.map(({ icon: Icon, title, text }) =>
        <li key={title} className="rounded-lg border border-line p-4">
          <Icon className="mb-3 text-wine" size={21} aria-hidden />
          <h2 className="font-semibold">{title}</h2>
          <p className="quiet mt-1">{text}</p>
        </li>,
      )}</ol>
      <form action={startTour}><button className="button primary" type="submit">Start at the board</button></form>
    </section>
  </Shell>;
}
