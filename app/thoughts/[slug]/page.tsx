import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { formatDate, getPublishedThoughts, getThought } from "@/lib/thoughts";

// Only published articles get pages. Drafts stay private.
export const dynamicParams = false;

export function generateStaticParams() {
  const published = getPublishedThoughts();
  // Next needs at least one entry for a static dynamic route; this one 404s.
  return published.length
    ? published.map((t) => ({ slug: t.slug }))
    : [{ slug: "__none__" }];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getThought(slug);
  if (!t) return {};
  return {
    title: t.title,
    description: t.summary,
    openGraph: { type: "article", title: t.title, description: t.summary, publishedTime: t.date },
    alternates: { canonical: `/thoughts/${slug}` },
  };
}

export default async function ThoughtPage({ params }: Props) {
  const { slug } = await params;
  const t = await getThought(slug);
  if (!t) notFound();

  return (
    <>
      <Nav home={false} />
      <main id="main" className="mx-auto max-w-[780px] px-5 pb-20 md:px-6">
        <article className="max-w-[640px] pt-14 md:pt-20">
          <Link href="/#thoughts" className="text-[14px] text-muted hover:text-fg">
            ← Thoughts
          </Link>
          <h1 className="mt-6 text-[32px] font-semibold leading-tight tracking-[-0.025em] md:text-[40px]">
            {t.title}
          </h1>
          <time dateTime={t.date} className="mt-3 block text-[14px] text-muted">
            {formatDate(t.date)}
          </time>
          <div className="article mt-10" dangerouslySetInnerHTML={{ __html: t.html }} />
        </article>
      </main>
      <Footer />
    </>
  );
}
