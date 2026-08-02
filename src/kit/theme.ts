/**
 * The token contract between generated apps and the kit. The system prompt
 * embeds this template; the model copies its STRUCTURE verbatim into
 * /src/index.css and varies only the VALUES — that's where each project's
 * personality lives (palette, radius, fonts drawn from the place and the
 * person), while the kit's classes (bg-background, text-primary,
 * border-border…) always resolve.
 *
 * The values below are deliberately BLANK — flat neutral gray, no character
 * at all. Models anchor hard on example values, and the previous example
 * (cream + garden green) was itself the "every build looks the same" failure
 * mode: it looked finished, so it shipped. Unfinished-looking placeholders
 * fail loudly instead, and the plan's Look & feel section is where the real
 * values come from.
 */
export const THEME_TEMPLATE = `@import "tailwindcss";

:root {
  /* PLACEHOLDERS — not a palette. Replace EVERY value below with this
     project's own (keep the names). A build that ships these grays has no
     design; the colors come from the plan's Look & feel, the person's
     image, or the place. --radius is a choice too: square (0), soft
     (0.5rem), or round (1rem) is half the app's character. */
  --background: #ffffff;
  --foreground: #171717;
  --card: #fafafa;
  --card-foreground: #171717;
  --primary: #404040;
  --primary-foreground: #ffffff;
  --secondary: #f5f5f5;
  --secondary-foreground: #404040;
  --muted: #f5f5f5;
  --muted-foreground: #737373;
  --accent: #f5f5f5;
  --accent-foreground: #171717;
  --destructive: #b91c1c;
  --destructive-foreground: #fef2f2;
  --border: #e5e5e5;
  --input: #d4d4d4;
  --ring: #404040;
  --radius: 0.5rem;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

body {
  background: var(--background);
  color: var(--foreground);
}`;
