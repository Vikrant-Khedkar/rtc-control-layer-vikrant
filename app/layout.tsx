import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RTC Control Layer", template: "%s · RTC Control Layer" },
  description: "Synthetic Sea Import Customs assessment workspace",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
