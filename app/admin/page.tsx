"use client";

import dynamic from "next/dynamic";

// The editor runs entirely in the browser; nothing about it is pre-rendered.
const AdminApp = dynamic(() => import("@/editor/AdminApp"), { ssr: false });

export default function AdminPage() {
  return <AdminApp />;
}
