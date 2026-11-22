"use client";

import dynamic from "next/dynamic";

// Runs entirely in the browser; nothing about a request is ever in the built page.
const CvRequestsApp = dynamic(() => import("@/editor/cv/CvRequestsApp"), { ssr: false });

export default function CvRequestsPage() {
  return <CvRequestsApp />;
}
