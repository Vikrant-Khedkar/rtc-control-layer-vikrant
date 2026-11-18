import { cookies } from "next/headers";
import { Compass } from "lucide-react";
import { endTour } from "../actions";

export async function TourHint({ title, children }: { title: string; children: React.ReactNode }) {
  if (!(await cookies()).has("rtc_guide")) return null;
  return <aside aria-label="Guided tour" className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-rosewash px-4 py-3">
    <div className="flex gap-3">
      <Compass size={19} className="mt-0.5 shrink-0 text-wine" aria-hidden />
      <div><h2 className="text-sm font-semibold">{title}</h2><p className="quiet mt-1">{children}</p></div>
    </div>
    <form action={endTour}><button className="button" type="submit">End tour</button></form>
  </aside>;
}
