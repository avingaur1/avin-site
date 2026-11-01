import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function NotFound() {
  return (
    <>
      <Nav home={false} />
      <main id="main" className="mx-auto max-w-[780px] px-5 pt-20 md:px-6">
        <h1 className="text-[32px] font-semibold tracking-tight">Nothing here.</h1>
        <p className="mt-3 text-muted">
          This page doesn't exist (yet).{" "}
          <Link href="/" className="text-accent hover:underline">
            Back home
          </Link>
          .
        </p>
      </main>
    </>
  );
}
