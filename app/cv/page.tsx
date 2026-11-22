import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { CvViewer } from "@/components/CvViewer";

// The page itself is public and empty: the CV only arrives after the Worker checks the link.
export const metadata: Metadata = {
  title: "CV",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  alternates: { canonical: null },
};

export default function CvPage() {
  return (
    <>
      <Nav home={false} />
      <main id="main" className="mx-auto max-w-[780px] px-5 pb-16 pt-14 md:px-6 md:pt-20">
        <CvViewer />
      </main>
    </>
  );
}
