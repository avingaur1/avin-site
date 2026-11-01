export function Section({
  id,
  heading,
  subheading,
  children,
}: {
  id: string;
  heading: string;
  subheading?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="py-12 md:py-14">
      <h2
        id={`${id}-heading`}
        className="text-[24px] font-semibold leading-tight tracking-[-0.015em] md:text-[26px]"
      >
        {heading}
      </h2>
      {subheading && <p className="mt-2 text-muted">{subheading}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function Divider() {
  return <hr className="border-0 border-t border-line" />;
}
