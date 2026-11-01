import { site, type LinkItem } from "@/content/site";
import { Section } from "./Section";

export function Connect() {
  return <ConnectView {...site.connect} />;
}

/** Pure view, also used by the editor's preview. */
export function ConnectView({
  heading,
  text,
  links,
}: {
  heading: string;
  text: string;
  links: LinkItem[];
}) {
  const visible = links.filter((l): l is { label: string; href: string } => !!l.href);
  return (
    <Section id="connect" heading={heading}>
      <p className="-mt-2 max-w-[600px]">{text}</p>
      <ul className="mt-6 flex flex-wrap gap-x-7 gap-y-2">
        {visible.map((l) => {
          const external = l.href.startsWith("http");
          return (
            <li key={l.label}>
              <a
                href={l.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="group inline-flex items-baseline gap-1 text-fg hover:text-accent"
              >
                {l.label}
                <span
                  aria-hidden
                  className="inline-block text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                >
                  ↗
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
