# Custom Domains on Community Hosting

*November 2026. Built. Replaces the August spec (closes PARITY gap #5).*

## The goal, in one sentence

A neighborhood tool deserves a neighborhood address: `elmstreet.place` (or
`library.elmstreet.org`) instead of `relationalbuilder.org/s/elm-street-library/`,
with every community hosting feature still attached: neighbor notes, the
error beacon, versions, view counts, private sites.

## Two decisions that shape everything

1. **The community owns the domain and its DNS.** RB never buys, sells, or
   holds a domain, and never processes a payment. The builder buys the name
   wherever they like (we point at Namecheap) or brings one they already
   have. We do not ask anyone to move their nameservers to us: the name and
   every record on it stay in the community's own account.
2. **One path for everyone: add records.** New domain or old, Namecheap or
   Squarespace or Vercel, the builder adds one or two rows at their DNS
   provider. Records were the hard path only because people got stuck
   silently. So the Builder reads the domain's DNS itself and says which
   row is wrong.

## The builder's experience

One field, **Use your own address**, under a live site's link in Publish and
behind the `@` button in Your Sites. The builder types a domain and we look
it up before asking for anything:

| What we find | What the builder sees |
|---|---|
| Not registered | "It looks available." A Namecheap link with the name typed in, then "I bought it, look again". |
| Registered, nothing on it (or only the registrar's placeholder page) | "Ready to connect." |
| A site already answers there | A warning that connecting replaces it, and an offer to use a corner of the domain instead (`library.theirdomain.org`). |
| Email on the domain | A line saying email keeps working. These records never touch it. |
| Live on another builder's site | It can't be claimed; a human will help. |

After **Connect**, the card shows the rows to add (Type, Host, Value, each
value one tap to copy), steps written for the provider we detected from the
domain's nameservers, and that provider's known stumble (Namecheap's two
placeholder rows, Cloudflare's orange cloud, Squarespace's defaults preset).
It checks again every 20 seconds on its own and reports per row: found, not
seen yet, or the specific thing to fix ("There's an extra A record
(203.0.113.9). Delete it so only 216.150.1.1 is left.").

A bare domain and its `www` travel together: the one the builder typed is
the address, the other redirects to it. Other subdomains stand alone.

When no name is typed yet, the card offers name ideas built from the site's
name and the project's place, and a short list of endings with what they
tend to cost to keep. The hint that matters most: the first year is often a
couple of dollars, the renewal is the real price, and it differs between
registrars.

## How it works

```
elmstreet.place ──DNS (A / CNAME, at the community's provider)──▶ Vercel project
        │
   middleware.ts          any hostname that isn't the Builder's own
        │
   api/_site-proxy.ts     x-rb-host: elmstreet.place
        │
   site function          site_domains → the site → its files
```

- **`site_domains`** (migration `20261119090000`): one row per site.
  `domain` is the address, `also` its www/bare twin, `status` is `pending`
  or `live`. RLS on, no policies; only the two functions touch it.
- **`middleware.ts`** is the door. It has to be middleware and not a
  `vercel.json` rewrite: rewrites run after the filesystem, so `/` on a
  community's domain would serve the Builder's own `index.html`. Requests on
  the Builder's own hostnames pass straight through.
- **`api/_site-proxy.ts`** is the proxy `/s/` has always used, now shared by
  both doors.
- **`site` function**: with `x-rb-host`, resolves the hostname through
  `site_domains` and treats the whole path as the file. Everything else
  (widget, beacon, unlock, SPA fallback) is unchanged, because it all
  resolves relative to the page. A site with a live domain also gets a
  `<link rel="canonical">` to it on both doors, unless the page names its own.
- **`site-domains` function**: `lookup`, `add`, `status`, `remove`.
  It reads DNS from the outside (DNS over HTTPS), registers the hostname on
  the Vercel project (Domains API), and returns the records Vercel itself
  recommends plus how each one looks right now. A site is `live` only when a
  real request to `https://{domain}/` comes back from community hosting, so
  "live" means DNS is right *and* the certificate is issued.
- **Reading the facts** (`src/project/domain-dns.ts`, pure and tested):
  provider detection, the four situations, per-row diagnosis, provider
  steps, name ideas. **`src/components/SiteAddressCard.tsx`** is the UI.

### Secrets

On the Supabase project: `VERCEL_TOKEN` (a token that can manage the
project's domains), `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`. Without them
`lookup` still works and the rest answers 503 with a plain message.

### Limits and edges

- One domain per site, five per builder (`MAX_DOMAINS_PER_BUILDER`).
- A claim that never went live stops blocking the name after 48 hours, so
  nobody can squat a domain they don't control. A domain can only serve a
  site if its DNS points here, which only its owner can do.
- A domain that sits in someone else's Vercel account needs a proof record
  first (TXT at `_vercel`). Vercel enforces this; we show the row.
- Taking a site down releases its hostname on the Vercel project.
- The `/s/` link keeps working and does not redirect. A lapsed domain
  renewal must never take the site with it.
- Our own names (`relationalbuilder.org` and anything under it) and other
  platforms' shared suffixes can't be connected.

## Deliberately not doing

- **Selling or holding domains, or taking payments.** The registrar
  relationship belongs to the neighborhood.
- **Asking for nameservers.** Simpler on day one, but it breaks domains
  already in use and puts the community's DNS in our account.
- **Live prices.** Deals are registrar-specific and change weekly; the hints
  are rough on purpose and send people to compare.
- Email on these domains, and wildcard custom domains.

## Later, if it earns it

- `{slug}.sites.relationalbuilder.org` for every site (needs a wildcard on
  our own DNS).
- One-click setup at providers that speak Domain Connect (Cloudflare,
  GoDaddy, IONOS): publish a template, skip the copy and paste.
- A renewal nudge: we can read a domain's expiry and warn the builder a
  month ahead.
