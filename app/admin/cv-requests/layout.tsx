import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CV requests",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function CvRequestsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
