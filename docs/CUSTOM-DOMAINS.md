# Custom Domains on Community Hosting — Spec

*August 2026. Closes PARITY gap #5. Status: specced, not built — the
domain-side steps need an owner decision (marked ⚑) before code starts.*

## The goal, in one sentence

A neighborhood tool deserves a neighborhood address: `elm-street-library.org`
(or `library.elmstreet.org`) instead of `relationalbuilder.org/s/elm-street-library/` —
with the builder doing nothing harder than pasting a domain and copying one
or two DNS records into their registrar.

## Where sites are served today

Every community-hosted site is rows in Postgres (`community_sites` /
`site_files`), served by the `site` edge function, fronted by a rewrite in
`vercel.json` on the `relationalbuilder.org` Vercel project:

```
/s/:slug/*  →  {SUPABASE}/functions/v1/site/:slug/*   (x-rb-raw header dance)
```

That front is the thing to extend — both phases below are "teach the Vercel
project to answer for more hostnames, and map each hostname to a slug."
Serving, publishing, versions, the feedback widget, and the error beacon all
keep working unchanged, because they resolve paths relative to the page URL.

## Phase 1 — Subdomains for every site (small, no new accounts)

`{slug}.sites.relationalbuilder.org` for every published site, automatically.

**Why `*.sites.` and not `*.`:** a top-level wildcard makes every future
service name (`api.`, `studio.`, `mail.`) contestable by site slugs. One
level down costs nothing and removes the whole reserved-names problem.

Mechanics:

1. ⚑ **Move `relationalbuilder.org` DNS to Vercel nameservers** (wildcard
   domains on Vercel require it) or CNAME `*.sites` explicitly. One-time.
2. Add `*.sites.relationalbuilder.org` as a domain on the Vercel project.
   TLS for the wildcard is automatic.
3. One `vercel.json` rewrite ahead of the SPA fallback:

```json
{
  "source": "/:path*",
  "has": [{ "type": "host", "value": "(?<slug>[^.]+)\\.sites\\.relationalbuilder\\.org" }],
  "destination": "https://{SUPABASE}/functions/v1/site/:slug/:path*"
}
```

4. `site` function: no changes required (slug still arrives as a path
   segment). Publish responses and YourSites gain a second URL line.

Effort: ~half a day of code once ⚑ is done. Risk: low — additive, `/s/` URLs
keep working forever.

## Phase 2 — Bring-your-own domain (the real prize)

Builder owns `elmstreetlibrary.org` (or a subdomain of a community domain)
and points it at their site.

**Approach: Vercel Domains API on the existing project.** The alternatives:

| Option | Verdict |
|---|---|
| **Vercel Domains API** (recommended) | Uses the account we already deploy on; programmatic add/verify/status; automatic TLS incl. apex; generous project domain limits. No new vendor. |
| Cloudflare for SaaS | Better above ~100 custom hostnames ($0.10/hostname/mo after 100) and if we ever leave Vercel; but a second vendor, a proxy layer move, and real migration work. Revisit at scale. |
| "Just use Netlify/Vercel deploy" (status quo) | Loses everything community hosting adds: neighbor notes, error beacon, versions, view counts. Not an answer. |

### Data

```sql
create table site_domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references community_sites (id) on delete cascade,
  domain text not null unique,           -- lowercased, punycoded
  status text not null default 'pending',-- pending | dns_ready | live | failed
  verification jsonb,                    -- records Vercel asks for, verbatim
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
-- RLS on, no policies (service role via publish-site only)
-- Cap: 1 domain per site, 3 per builder (mirrors the site cap)
```

### Flow (all inside `publish-site`, new actions)

1. `{action: 'domain_add', slug, domain}` — validate shape and ownership,
   normalize, reject apex domains on ⚑-decision if we want to start
   subdomain-only, then `POST /v10/projects/{id}/domains` with the RB Vercel
   token (a new function secret: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`).
   Vercel's response says exactly what DNS is needed:
   - subdomain → one CNAME to `cname.vercel-dns.com`
   - apex → one A record (76.76.21.21)
   - domain attached to another Vercel account → a TXT challenge first
     (this is also our anti-takeover check — Vercel enforces it)
2. Store the row with `verification` = Vercel's expected records, verbatim.
3. `{action: 'domain_status', slug}` — proxies Vercel's
   `GET .../domains/{domain}` + config check; flips `status` to `live` when
   verified and TLS is issued.
4. `{action: 'domain_remove', slug}` — removes from Vercel + the row.
5. Serving: one more `vercel.json` rewrite, after the wildcard, catching
   any host that isn't ours:

```json
{
  "source": "/:path*",
  "has": [{ "type": "host", "value": "(?<host>.+)" }],
  "destination": "https://{SUPABASE}/functions/v1/site-by-domain/:host/:path*"
}
```

   `site-by-domain` is ~20 lines: look up `site_domains` (cache 60s),
   forward to the `site` function's logic with the resolved slug. 404s for
   unknown hosts (a host only reaches us if its DNS points here anyway).

### The builder experience (the actual point)

One new card in the Publish dialog / YourSites, three states:

1. **Paste a domain** → "Use your own address" field, one button.
2. **Copy the records** → we show a two-column table (Type · Name · Value),
   each row with a copy button, plus registrar-specific one-liners for the
   common five (Namecheap, GoDaddy, Cloudflare, Google/Squarespace, Porkbun).
   A "Check again" button, and we also poll quietly every 30s.
3. **Live** → green dot, the new URL, and "your `/s/` address still works."

Plain-language copy throughout: "This tells the internet your domain lives
here. It can take up to an hour to spread." No mention of A records vs
CNAMEs unless they open the table.

**Deliberately not doing:** selling domains (Lovable does; wrong fit — the
registrar relationship should belong to the neighborhood), email/DKIM on
these domains, and wildcard *custom* domains.

### Costs & limits ⚑

- Vercel: custom domains are free on the project; TLS free. The wildcard
  needs Vercel DNS (free) — the ⚑ nameserver decision.
- Our caps: 1 domain/site, 3/builder, steward-liftable like site caps.
- Failure honesty: if Vercel rejects a domain (reserved, abuse-listed),
  surface Vercel's reason verbatim with "reply to your invite email and a
  human will help."

### Order of work

1. ⚑ Nameservers → Phase 1 wildcard (half day) — immediate visible win.
2. `site_domains` migration + `domain_add/status/remove` actions (1 day).
3. `site-by-domain` resolver + rewrite (half day).
4. Publish dialog / YourSites card + polling (1 day).
5. Docs + a "give your tool its own address" note in the publish success
   toast.

Total: ~3 days of code after the two ⚑ decisions (nameservers; apex
support at launch vs subdomain-only).
