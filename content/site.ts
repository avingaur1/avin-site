/**
 * Everything you'd want to edit lives here.
 * Change text, add work entries, campus stories, photos and links
 * without touching any component.
 *
 * Articles live as Markdown files in /content/thoughts (see README).
 */

export type Photo = {
  /** Path inside /public, e.g. "/images/campus-1.jpg" */
  src: string;
  alt: string;
  caption?: string;
};

export type WorkEntry = {
  title: string;
  role?: string;
  description: string;
  /** Optional. If set, the row becomes a link and shows a small arrow. */
  href?: string;
};

export type CampusEntry = {
  title: string;
  paragraphs: string[];
  /** Optional. Add 1–3 photos and they appear under the text. */
  photos?: Photo[];
};

export type BeyondItem = {
  label: string;
  /** Leave empty to show "Coming soon". */
  text?: string;
  href?: string;
};

export const site = {
  name: "Avin Gaur",
  /** Replace with your real domain once deployed (used for SEO / Open Graph). */
  url: "https://avingaur.vercel.app",
  description:
    "Avin Gaur — final-year student at IIT Delhi, interested in startups, strategy, technology, and a lot of things in between.",

  nav: [
    { label: "work", href: "#work" },
    { label: "campus", href: "#campus" },
    { label: "thoughts", href: "#thoughts" },
    { label: "about", href: "#beyond" },
  ],

  intro: {
    heading: "Avin Gaur.",
    lines: [
      "A curious person figuring out how things work, how businesses grow, and how ideas turn into something real.",
      "Currently in my final year at IIT Delhi. Interested in startups, strategy, technology, and a lot of things in between.",
    ],
  },

  work: {
    heading: "Work",
    subheading: "A few places I've worked and things I've been part of.",
    entries: [
      {
        title: "Kepler Cannon",
        role: "Strategy & Analytics Intern",
        description: "Worked on strategy and analytics in US retail banking.",
      },
      {
        title: "Startup Consulting",
        description:
          "Worked on business strategy, growth, and analytics projects with startups.",
      },
      {
        title: "RFQ Opportunity Scoring",
        description:
          "Explored data analysis and predictive modelling to prioritize business opportunities.",
      },
    ] as WorkEntry[],
  },

  campus: {
    heading: "My Journey at Campus",
    intro:
      "IIT Delhi has been more than classes and exams. It's where I've had the chance to explore different interests, meet interesting people, and try things outside my comfort zone.",
    entries: [
      {
        title: "Business & Consulting Club",
        paragraphs: [
          "A lot of my time at IIT Delhi has gone into the Business & Consulting Club. It's where I first got to work with real startups, lead projects, and put together initiatives for the rest of campus.",
          "Mostly, it taught me how much you can learn by just showing up and figuring things out alongside good people.",
        ],
        photos: [],
      },
      {
        title: "Placement Cell",
        paragraphs: [
          "Being part of the placement cell meant a lot of coordinating with teams and talking to companies through the recruitment process. It's a very different view of placements than the one you get as a candidate.",
        ],
        photos: [],
      },
      {
        title: "Beyond Academics",
        paragraphs: [
          "Events, late-night conversations, hostel life, and the people who made it all memorable. A lot of what I'll remember from campus happened outside a classroom.",
        ],
        photos: [],
      },
    ] as CampusEntry[],
  },

  thoughts: {
    heading: "Thoughts",
    subheading: "Occasional notes on things I find interesting.",
    emptyMessage: "Some thoughts are taking shape.",
  },

  beyond: {
    heading: "Beyond the Resume",
    description:
      "There's a lot more to me than the things I put on a resume. This is a small space for everything else — places, people, interests, random projects, and things that make life interesting.",
    items: [
      { label: "Places", text: "" },
      { label: "Books & music", text: "" },
      { label: "Side projects", text: "" },
      { label: "Memories", text: "" },
    ] as BeyondItem[],
    /**
     * Exactly three slots. Leave `src` empty to show a placeholder frame.
     * Use your own photos only.
     */
    photos: [
      { src: "", alt: "" },
      { src: "", alt: "" },
      { src: "", alt: "" },
    ] as Photo[],
    interactiveResume: {
      label: "Explore my interactive resume",
      /** Paste the link to your interactive resume here. Hidden while empty. */
      href: "",
    },
  },

  connect: {
    heading: "Let's Connect",
    text: "Always happy to talk about an interesting idea, collaborate on something, or just have a conversation.",
    links: [
      { label: "Email", href: "mailto:avingaur.iitd@gmail.com" },
      { label: "LinkedIn", href: "https://www.linkedin.com/in/avin-gaur/" },
      /** Add your GitHub URL here. Links with an empty href are hidden. */
      { label: "GitHub", href: "" },
    ],
  },

  footer: {
    left: "© 2026 Avin Gaur",
    right: "Made with curiosity.",
  },
};
