import { Nav } from "@/components/Nav";
import { Intro } from "@/components/Intro";
import { Work } from "@/components/Work";
import { Campus } from "@/components/Campus";
import { Thoughts } from "@/components/Thoughts";
import { Beyond } from "@/components/Beyond";
import { Connect } from "@/components/Connect";
import { Footer } from "@/components/Footer";
import { Divider } from "@/components/Section";
import { site } from "@/content/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  url: site.url,
  affiliation: { "@type": "CollegeOrUniversity", name: "IIT Delhi" },
  sameAs: site.connect.links.filter((l) => l.href.startsWith("http")).map((l) => l.href),
};

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto max-w-[780px] px-5 md:px-6">
        <Intro />
        <Divider />
        <Work />
        <Divider />
        <Campus />
        <Divider />
        <Thoughts />
        <Divider />
        <Beyond />
        <Divider />
        <Connect />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
