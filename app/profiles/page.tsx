import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireActor, safeReturnPath } from "../../src/server/session";
import { Brand } from "../ui";
import { ProfilePicker } from "./picker";

export const metadata = { title: "Switch profile" };

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const [actor, { next }] = await Promise.all([requireActor(), searchParams]);
  const backPath = safeReturnPath(next);
  return <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12">
    <section className="panel w-full p-6 sm:p-9">
      <Brand />
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Switch profile</h1>
      <p className="quiet mt-2 mb-6">Choose a demo user. After switching, you’ll start from God View.</p>
      <ProfilePicker current={actor.role} />
      <Link href={backPath} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-muted"><ArrowLeft size={15} /> Back to workspace</Link>
    </section>
  </main>;
}
