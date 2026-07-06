// submit-contribution — the write path into the commons review queue.
//
// Any AI tool connected to the RT MCP server (or any client) can submit a
// draft contribution on a builder's behalf. Nothing goes live: rows land in
// commons_contributions with status='pending' and wait for a human steward.
// Approval happens via review-contribution (or directly by stewards).
//
// This is the "submit-item Edge Function" the commons schema designed for.
// Relational friction is preserved (a steward reviews every item, contributors
// are credited); mechanical friction is removed (no account, no form).
//
// Studio attribution: clients that build inside a studio frame (the
// Relational Builder) may pass studio_slug + studio_label. The contribution
// then lands with that studio as source_studio_slug — so studio-scoped
// views of the commons know where a build grew — instead of pooling under
// the open-contributions channel. Omitted or unusable slugs fall back to
// open-contributions exactly as before.
//
// Privacy: commons_feed_events is publicly readable and a trigger announces
// new contributions there. Pending contributions should stay private until a
// steward approves them, so this function deletes that auto-emitted event —
// the item_published event fires on approval instead.
//
// Abuse limits: max 5 submissions/hour per IP, max 30/hour globally.
//
// Environment (auto-provisioned): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// RESEND_API_KEY (steward notification, best-effort).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPEN_STUDIO_SLUG = "open-contributions";
const STEWARD_EMAIL = "humans@relationaltechproject.org";
const ALLOWED_TYPES = ["tool", "story", "recipe", "prompt", "community_note"];
const PER_IP_HOURLY_LIMIT = 5;
const GLOBAL_HOURLY_LIMIT = 30;

function kebab(s) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cap(s, max) {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  return t.length <= max ? t : t.slice(0, max);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase environment variables" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Request body must be JSON" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const contributionType = cap(body.contribution_type, 40) ?? "";
  const title = cap(body.title, 150);
  const summary = cap(body.summary, 1000);
  const content = cap(body.body, 20000);
  const builderName = cap(body.builder_name, 120);
  const neighborhood = cap(body.neighborhood, 160);
  const contactEmail = cap(body.contact_email, 200);
  const sourceUrl = cap(body.source_url, 500);
  const relatedItemSlug = cap(body.related_item_slug, 120);
  const rawTags = Array.isArray(body.tags) ? body.tags : [];
  const tags = rawTags.map((t) => cap(t, 40)).filter(Boolean).slice(0, 8);
  // Optional studio attribution — sanitized to a slug; anything that doesn't
  // survive kebab() quietly falls back to the open channel
  const studioSlug = kebab(cap(body.studio_slug, 80) ?? "") || null;
  const studioLabel = cap(body.studio_label, 120);
  const submittedVia = (cap(body.submitted_via, 40) ?? "mcp").replace(/[^a-z0-9-]/g, "") || "mcp";

  if (!ALLOWED_TYPES.includes(contributionType)) {
    return new Response(
      JSON.stringify({ error: `contribution_type must be one of: ${ALLOWED_TYPES.join(", ")}` }),
      { status: 400, headers: jsonHeaders },
    );
  }
  if (!title || title.length < 3) {
    return new Response(JSON.stringify({ error: "title is required (3+ characters)" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }
  if (!summary && !content) {
    return new Response(JSON.stringify({ error: "Provide a summary or body" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }
  if (!builderName) {
    return new Response(
      JSON.stringify({ error: "builder_name is required — the commons credits contributors" }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim() || "unknown";

  // Rate limits (queried via metadata; service role bypasses RLS)
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: globalCount } = await supabase
    .from("commons_contributions")
    .select("id", { count: "exact", head: true })
    .gte("submitted_at", hourAgo);
  if ((globalCount ?? 0) >= GLOBAL_HOURLY_LIMIT) {
    return new Response(
      JSON.stringify({ error: "The contribution queue is busy right now — please try again in an hour." }),
      { status: 429, headers: jsonHeaders },
    );
  }
  const { count: ipCount } = await supabase
    .from("commons_contributions")
    .select("id", { count: "exact", head: true })
    .gte("submitted_at", hourAgo)
    .eq("proposed_metadata->>submit_ip", ip);
  if ((ipCount ?? 0) >= PER_IP_HOURLY_LIMIT) {
    return new Response(
      JSON.stringify({
        error:
          "You've submitted a few contributions recently — please give the stewards a moment to catch up and try again in an hour.",
      }),
      { status: 429, headers: jsonHeaders },
    );
  }

  // Ensure the source studio row exists (the named studio when given,
  // otherwise the open-contributions channel)
  const sourceSlug = studioSlug ?? OPEN_STUDIO_SLUG;
  const { data: studioRow } = await supabase
    .from("commons_studios")
    .select("slug")
    .eq("slug", sourceSlug)
    .maybeSingle();
  if (!studioRow) {
    const { error: studioErr } = await supabase.from("commons_studios").insert(
      studioSlug
        ? {
            slug: sourceSlug,
            display_name: studioLabel ?? sourceSlug,
            home_url: "https://relationalbuilder.xyz",
            publish_key_hash: "managed-by-submit-contribution",
            steward_email: STEWARD_EMAIL,
            notes:
              "Auto-registered from a studio-framed contribution (Relational Builder). Every item waits in commons_contributions for steward review.",
          }
        : {
            slug: OPEN_STUDIO_SLUG,
            display_name: "Open Contributions",
            home_url: "https://mcp.relationaltechproject.org",
            publish_key_hash: "managed-by-submit-contribution",
            steward_email: STEWARD_EMAIL,
            notes:
              "Contributions submitted by builders through MCP-connected AI tools. Every item waits in commons_contributions for steward review.",
          },
    );
    if (studioErr) {
      return new Response(
        JSON.stringify({ error: "Failed to register contribution channel", details: studioErr.message }),
        { status: 500, headers: jsonHeaders },
      );
    }
  }

  const localId = `${submittedVia}-${crypto.randomUUID()}`;
  const { data: inserted, error: insertErr } = await supabase
    .from("commons_contributions")
    .insert({
      source_studio_slug: sourceSlug,
      source_local_id: localId,
      proposed_kind: contributionType,
      proposed_slug: kebab(title),
      proposed_title: title,
      proposed_summary: summary,
      proposed_body: content,
      proposed_attribution: {
        name: builderName,
        ...(neighborhood ? { neighborhood } : {}),
      },
      proposed_tags: tags,
      proposed_metadata: {
        submitted_via: submittedVia,
        submit_ip: ip,
        ...(contactEmail ? { contact_email: contactEmail } : {}),
        ...(sourceUrl ? { source_url: sourceUrl } : {}),
        ...(relatedItemSlug ? { related_item_slug: relatedItemSlug } : {}),
        ...(studioSlug ? { studio_slug: studioSlug, ...(studioLabel ? { studio_label: studioLabel } : {}) } : {}),
      },
      status: "pending",
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    return new Response(
      JSON.stringify({ error: "Failed to save contribution", details: insertErr?.message }),
      { status: 500, headers: jsonHeaders },
    );
  }

  // Keep pending contributions private: remove the publicly readable feed
  // event the insert trigger just emitted. item_published fires on approval.
  await supabase
    .from("commons_feed_events")
    .delete()
    .eq("event_type", "contribution_received")
    .eq("payload->>contribution_id", inserted.id);

  // Best-effort steward notification. Resend is imported lazily so the
  // function deploys and accepts contributions even if the email module
  // can't load — the queue matters more than the notification.
  let stewardNotified = false;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    try {
      const { Resend } = await import("https://esm.sh/resend@2.0.0");
      const resend = new Resend(resendKey);
      const esc = (s) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      await resend.emails.send({
        from: "Commons Contributions <notifications@relationaltechproject.org>",
        to: [STEWARD_EMAIL],
        ...(contactEmail ? { reply_to: contactEmail } : {}),
        subject: `New commons contribution: ${title}`,
        html: `
          <h2>New ${esc(contributionType)} contribution (pending review)</h2>
          <p><strong>${esc(title)}</strong></p>
          <p><strong>From:</strong> ${esc(builderName)}${neighborhood ? ` — ${esc(neighborhood)}` : ""}${contactEmail ? ` &lt;${esc(contactEmail)}&gt;` : ""}</p>
          ${studioSlug ? `<p><strong>Studio:</strong> ${esc(studioLabel ?? studioSlug)} (${esc(studioSlug)})</p>` : ""}
          ${summary ? `<p><strong>Summary:</strong> ${esc(summary)}</p>` : ""}
          ${content ? `<div style="background:#f5f5f5;padding:16px;border-radius:8px;white-space:pre-wrap;">${esc(content)}</div>` : ""}
          ${sourceUrl ? `<p><strong>URL:</strong> ${esc(sourceUrl)}</p>` : ""}
          ${tags.length ? `<p><strong>Tags:</strong> ${esc(tags.join(", "))}</p>` : ""}
          ${relatedItemSlug ? `<p><strong>Related item:</strong> ${esc(relatedItemSlug)}</p>` : ""}
          <hr>
          <p style="color:#666;font-size:12px;">Submitted via ${esc(submittedVia)}. Contribution id: ${inserted.id}. It stays pending until a steward reviews it.</p>
        `,
      });
      stewardNotified = true;
    } catch {
      // Email failures shouldn't block the contribution
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      contribution_id: inserted.id,
      status: "pending",
      steward_notified: stewardNotified,
      message:
        "Thank you — your contribution is in the steward review queue. A human steward reads every submission before it joins the commons. If you shared an email, you'll hear back.",
    }),
    { status: 200, headers: jsonHeaders },
  );
});
