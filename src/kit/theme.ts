/**
 * The token contract between generated apps and the kit. The system prompt
 * embeds this template; the model copies its STRUCTURE verbatim into
 * /src/index.css and varies only the VALUES — that's where each project's
 * personality lives (palette, radius, fonts drawn from the place and the
 * person), while the kit's classes (bg-background, text-primary,
 * border-border…) always resolve.
 *
 * The example values below are ONE demo look (cream + garden green). Models
 * anchor hard on example values, so the inline comment tells them these are
 * placeholders to replace wholesale — shipping this palette verbatim is the
 * "every build looks the same" failure mode.
 */
export const THEME_TEMPLATE = `@import "tailwindcss";

:root {
  /* EXAMPLE values from one demo build — replace EVERY value with this
     project's own palette (never the names). Never ship these as-is. */
  --background: #faf6ef;
  --foreground: #1c1917;
  --card: #ffffff;
  --card-foreground: #1c1917;
  --primary: #166534;
  --primary-foreground: #f0fdf4;
  --secondary: #ece5d8;
  --secondary-foreground: #44403c;
  --muted: #f1ece2;
  --muted-foreground: #78716c;
  --accent: #ece5d8;
  --accent-foreground: #1c1917;
  --destructive: #b91c1c;
  --destructive-foreground: #fef2f2;
  --border: #e7e0d3;
  --input: #d6cdbc;
  --ring: #166534;
  --radius: 0.625rem;
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
