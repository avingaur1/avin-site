import { site } from "@/content/site";

export function Footer() {
  return (
    <footer className="mx-auto max-w-[780px] px-5 md:px-6">
      <div className="flex items-center justify-between border-t border-line py-8 text-[13px] text-muted">
        <span>{site.footer.left}</span>
        {site.footer.right && <span>{site.footer.right}</span>}
      </div>
    </footer>
  );
}
