-- Seed the Sunset Build-a-thon inspiration shelf (Oct 6 2026).
--
-- Six neighborhood tools from the Outer Sunset, San Francisco, as they
-- actually run — the specific implementations behind the more generic
-- commons cards (Neighborhood Connector Site, Hyperlocal Neighbor Hubs,
-- Block Party Organizing, the walking-guide tool). Summaries are the sites'
-- own words where they have them; the "How it works" notes were written
-- from the live pages, read Oct 6 2026. Screenshots were captured the same
-- day and live on the public studio-library bucket.
--
-- Repo links are left null until the hosts supply them.
--
-- Re-runnable: clears the SUNSET shelf before re-inserting.

delete from public.event_shelf_items where upper(event_code) = 'SUNSET';

insert into public.event_shelf_items
  (event_code, title, summary, body, image_url, site_url, repo_url, attribution, tags, sort_order)
select 'SUNSET', v.title, v.summary, v.body,
       'https://texakzqqenzpxawktbgx.supabase.co/storage/v1/object/public/studio-library/event-shelf/sunset/' || v.shot,
       v.site_url, null, v.attribution, v.tags, v.sort_order
from (values
  ('Outer Sunset Today',
   'Your daily dashboard for events, community life, and local happenings in San Francisco''s Outer Sunset neighborhood.',
   '**What it is** — One page that answers "what''s going on today?" for the neighborhood: the weather, the school lunch, what the bakery is baking, every event happening today with its source and time, and the day''s local news.

**How it works** — Events are pulled from the neighborhood''s venues, libraries and groups, with a "Submit an Event" door for anything missed. Each event has a Source link back to where it came from and an "Add to My Plan" button, so a neighbor builds their own day from the list. News is drawn from local outlets and credited. The community guide at outersunset.us points here for anything time-bound.',
   'outersunset-today.jpg', 'https://outersunset.today',
   'Outer Sunset, San Francisco · a neighborhood daily',
   array['sunset', 'events', 'local-news', 'daily']::text[], 10),

  ('Outer Sunset Community Guide',
   'A friendly guide to finding community in the Outer Sunset. Local groups, gatherings, and low-pressure ways to connect.',
   '**What it is** — "A neighborhood guide to help more of us find community." A growing, hand-kept list of local groups sorted by what they are for: outdoors and movement, care for people and place, making and creativity, neighborhood and civic life, faith and spiritual life, food and gathering.

**How it works** — Every group is a short entry with a link, nothing more. Anyone can suggest a group through a small form (name, link, a note, a quick human check), and the list gets better as more neighbors shape it. There is a Chinese-language version, a contact form, and a pointer to outersunset.today for anything happening this week. This is the real site behind the commons'' "Neighborhood Connector Site" card.',
   'outersunset-us.jpg', 'https://outersunset.us',
   'Outer Sunset, San Francisco · a neighborhood guide',
   array['sunset', 'groups', 'directory', 'bilingual']::text[], 20),

  ('Outer Sunset Field Guide',
   'A neighborhood walking companion for the Outer Sunset: local history, present-day life, and community dreams layered onto a quiet, field-guide-style interface.',
   '**What it is** — A mobile-first walking guide. Open it on the sidewalk and it shows what is nearby: a historical photo, a short note, the walk time to the next stop, and a "You''re here" card that moves as you do.

**How it works** — Three views: Nearby (the closest stops, in order), Map, and All. A Tour mode strings stops into a walk; About explains the project. Historical images are credited to their archives (OpenSFHistory and others). The design is deliberately quiet, more field guide than app, so the neighborhood stays the main thing on screen. This is the real site behind the commons'' "Neighborhood History (and Future) Walking App" card.',
   'outersunset-place.jpg', 'https://outersunset.place',
   'Outer Sunset, San Francisco · a walking guide',
   array['sunset', 'history', 'walking', 'mobile']::text[], 30),

  ('Sunset Neighbor Hub (Cozy Corner)',
   'A block-level hub for 48th Ave between Lincoln and Irving: street cleaning reminders, this week''s events, an ideas board, and a welcome for new neighbors.',
   '**What it is** — "We''re neighbors on 48th Ave between Lincoln & Irving. This site helps us share resources, connect, and look out for each other." One block''s own site, in English and Spanish.

**How it works** — The front page carries what the block actually needs: a "New to the Block?" welcome, this week''s neighborhood events (fed from outersunset.today), street-cleaning reminders by side of the street with a sign-up for 8am texts, and an ideas board where neighbor-driven initiatives are proposed and marked accomplished. A Prep section covers emergency readiness; Party is the block party planning tool. This is the real site behind the commons'' "Hyperlocal Neighbor Hubs" prompt.',
   'cozycorner.jpg', 'https://cozycorner.place',
   '48th Ave, Outer Sunset, San Francisco · a block hub',
   array['sunset', 'block', 'neighbor-hub', 'bilingual']::text[], 40),

  ('Sunset and Richmond Community Supplies',
   'Borrow what you need. Share what you have. A free, open-source tool for neighborhoods to share supplies, tools, party gear, and more.',
   '**What it is** — A lending library without a building. Neighbors list what they are happy to lend, browse what others have, and borrow by reaching out. The Sunset & Richmond community is one of 120+ sharing communities running on the same tool across the United States and beyond.

**How it works** — A steward starts a sharing community for their neighborhood. Members join (an "Apply" door for people the steward does not know yet) and list items. Borrowing is a conversation between neighbors, not a checkout system. The software is free and open source, and the project will help a new neighborhood get set up. Its "A Peek Inside" section links the rest of the Outer Sunset tools on this shelf.',
   'community-supplies.jpg', 'https://communitysupplies.org',
   'Sunset & Richmond, San Francisco · a sharing community',
   array['sunset', 'sharing', 'lending-library', 'open-source']::text[], 50),

  ('Block Party Planning Tool',
   'One page that runs a block party: the date and the plan, a potluck sign-up, and volunteer roles neighbors can claim.',
   '**What it is** — The Party page of the 48th Ave neighbor hub, set up for the block''s October 17 party. It tells neighbors the plan in two sentences (street closed, cars can stay, help coming and going) and then asks for two things.

**How it works** — A potluck sign-up (what dish or drink can you bring) and volunteer sign-ups where each role is a button: barricades setup, roaming welcome committee, bounce house monitor, art station monitor, potluck setup and takedown, pet parade facilitator. Both are optional, so showing up is still the main ask. The same page carries the Prep and Contact sections of the hub, so the party sits inside the block''s ongoing life rather than as a one-off. This is the real page behind the commons'' "Block Party Organizing" prompt.',
   'block-party.jpg', 'https://cozycorner.place/block-party',
   '48th Ave, Outer Sunset, San Francisco · a block party page',
   array['sunset', 'block-party', 'sign-ups', 'volunteers']::text[], 60)
) as v(title, summary, body, shot, site_url, attribution, tags, sort_order);
