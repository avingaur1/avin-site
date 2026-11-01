import { site } from "@/content/site";
import { imageSize } from "@/lib/imageSize";
import { IntroView } from "./views/IntroView";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function Intro() {
  const { heading, lines, portrait } = site.intro;
  const local = portrait.src.startsWith("/");
  const size = local ? imageSize(portrait.src) : null;
  const photo = portrait.src
    ? {
        src: local ? `${BASE}${portrait.src}` : portrait.src,
        alt: portrait.alt,
        width: size?.width ?? 600,
        height: size?.height ?? 800,
      }
    : null;

  return <IntroView heading={heading} lines={lines} photo={photo} />;
}
