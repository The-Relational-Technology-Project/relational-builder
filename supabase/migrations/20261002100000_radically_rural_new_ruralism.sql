-- Radically Rural, second shelf pass (Oct 2 2026): the New Ruralism case
-- studies, plus the white paper as a principle.
--
-- Radically Rural's resource library links out to a set of case studies that
-- are NOT its own: they belong to the New Ruralism Initiative, a project of
-- the American Planning Association's Northern New England Chapter and its
-- Small Town and Rural Planning Division, which grew from northern New
-- England to cover Alaska, New York, Alabama and Indiana. Attribution here
-- credits New Ruralism, with Radically Rural named as where they surfaced.
--
-- 19 of the 20 go in. Local Foods Plymouth is already on this shelf as
-- "Online Farmers Market" and is not re-added. PAREI is a near-miss worth
-- naming: NH Solar Shares, already here, is PAREI's community-array
-- program, while this case study is its volunteer "energy raiser"
-- installation model — a different model from the same organization, so it
-- goes in with a cross-reference in the body rather than being dropped.
--
-- King Arthur Flour's SmartCommute carries no "How it works": nothing on
-- the program could be verified beyond the catalog line.
--
-- The white paper lands as a `principle`, not an example — it is a stance
-- about rural investment, and principles are what the prompt tells the model
-- to act on. Its body is written from the paper itself ("By Rural, for
-- Rural", 17 pp., read Oct 2 2026): its findings on why federal money misses
-- small places, and what that asks of a build. Paraphrased; the paper is
-- linked for the full recommendations.
--
-- Studio-private and approved, like the first pass: visibility and status
-- take the table defaults. Re-runnable on its own rows only.

delete from public.studio_library_items
  where studio_slug = 'radically-rural'
    and created_by is null
    and ('new-ruralism' = any(tags) or 'policy' = any(tags));

insert into public.studio_library_items
  (studio_slug, kind, title, summary, body, url, attribution, tags, sort_order)
select 'radically-rural', v.kind, v.title, v.summary, v.body, v.url,
       v.attribution, v.tags, v.sort_order
from (values
  ('principle',
   'Top-down investment and bottom-up initiative',
   'Radically Rural''s 2024 white paper: rural people carry the solutions; outside money should fit how small places work, not shrink urban rules to fit them.',
   'Radically Rural''s 2024 white paper, "By Rural, for Rural", came out of
the 2023 Keene summit: two focus groups facilitated by Tony Pipa of
Brookings, interviews with attendees by Keene High School students, and
online working sessions after. Its answer to how outside investment and
local initiative coexist: local people carry the solutions ("these people know
what they need and how to do it, they just need to be funded"), and
outside money should fit how small places actually work rather than
shrink urban rules to fit them. It is explicit that fixing rural problems
is not only government''s job, but that the conditions matter.

What it found getting in the way:
- Federal funds favor places that can afford specialist staff to find,
  apply for and administer them. Small towns spend more time on paperwork
  than on the work. Its top ask: one simple, universal application and
  compliance process across agencies.
- Runways of 1-3 years are too short; match requirements and
  reimbursement-only payment shut out places without cash on hand.
- Success measured as jobs created misses rural impact. Measure from a
  place''s own starting point, and count solopreneurs and micro-enterprises.
- Towns work in silos across distance. It calls for regional capacity:
  shared hubs, multi-town partnerships, technical assistance, and
  operating funds for the people already doing the work.

What that means for a build here:
- Assume nobody has a grant writer. Cut steps, reuse what a town already
  wrote, and keep a record that makes reporting easy.
- Let people measure against their own baseline, in their own terms.
- Design for several towns sharing one tool and one coordinator.
- Plan for the money ending: the data and the habit should stay local.
- Help locals shape what arrives, not only comply with it.',
   'https://radicallyrural.org/wp-content/uploads/2024/07/2024-RR-White-Paper.pdf',
   'Radically Rural 2024 White Paper',
   array['radically-rural', 'policy', 'investment']::text[],
   50),
  ('example',
   'Kodiak Harvest Food Co-op',
   'A food co-op created to retain income within the community by providing a market for produce and seafood grown or caught locally.',
   '**Kodiak Island Borough, AK**

A food co-op created to retain income within the community by providing a market for produce and seafood grown or caught locally.

**How it works** — A consumer-owned co-op that grew in deliberate stages rather than opening cold: memberships sold first (2016), then pop-up produce stands around town, then a first brick-and-mortar store in 2021. Since 2023 it has given local fishermen a steady way to sell seafood directly to Kodiak residents, alongside seasonal produce and weekly subscription produce boxes. The staging is the transferable part — each step tested demand before the next one cost anything.

A New Ruralism Initiative case study (Food & working lands) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/nalcm9fmqp2v7ug/Kodiak%20AK.pdf?dl=0',
   'Food & working lands · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'food-working-lands', 'ak']::text[],
   2010),
  ('example',
   'Somerset Grist Mill',
   'An abandoned building rehabilitated to accommodate new business and support the growing grain industry, filling its original role as a grist mill.',
   '**Skowhegan, ME**

An abandoned building rehabilitated to accommodate new business and support the growing grain industry, filling its original role as a grist mill.

**How it works** — Amber Lambke and Michael Scholz bought a 14,000 sq ft Victorian jailhouse for $65,000 in 2009 and opened the mill in 2012, after roughly $1.5M in renovation and equipment. The bet was historical: Somerset County milled 239,000 bushels of wheat a year at its 1837 peak before grain farming moved west. Trading as Maine Grains, it now buys from 36 farms and has put over $1M into local grain purchases — a derelict public building turned into the missing middle of a regional supply chain.

A New Ruralism Initiative case study (Food & working lands) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/gtb02y9z1bnkn4e/Somerset%20Grist%20Mill.pdf?dl=0',
   'Food & working lands · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'food-working-lands', 'me']::text[],
   2020),
  ('example',
   'Vermont''s Farm to Plate',
   'A statewide program working to reduce the miles traveled by food and strengthen the local agricultural economy.',
   '**Vermont**

A statewide program working to reduce the miles traveled by food and strengthen the local agricultural economy.

**How it works** — Created by the legislature in 2009 and built through an 18-month statewide public engagement process into a 10-year plan with 25 goals across all seven parts of the food system. The network grew from 125 organizations in 2011 to 300+. Over the plan''s first decade the state''s food system output rose 48% to $11.3B, added 6,560 net jobs, and local food purchases went from 5% to 13.9% of total food spending. Reauthorized in 2019; a 2021-2030 plan followed.

A New Ruralism Initiative case study (Food & working lands) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/1b89t4up3x4kzy0/Farm2Plate.pdf?dl=0',
   'Food & working lands · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'food-working-lands', 'vt']::text[],
   2030),
  ('example',
   'Port Clyde Fresh Catch',
   'A fishermen''s cooperative that harvests, packages and sells seafood using environmentally sound methods.',
   '**Port Clyde, ME**

A fishermen''s cooperative that harvests, packages and sells seafood using environmentally sound methods.

**How it works** — The first community-supported fishery in the United States, started in 2007 by the Midcoast Fishermen''s Co-op on the CSA model: subscribers buy a share and take delivery of shrimp and groundfish. The premise is quality over quantity — fishermen take a higher price per pound, use methods that cut bycatch, habitat damage and fuel, and guarantee traceability from harvest through their own processing facility.

A New Ruralism Initiative case study (Food & working lands) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/m46hu13m3uvrzf7/Port%20Clyde%20Fresh%20Catch.pdf?dl=0',
   'Food & working lands · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'food-working-lands', 'me']::text[],
   2040),
  ('example',
   'Relief Zone Community Youth Center',
   'A community youth center providing practical assistance and high quality programming to the community''s youth and families.',
   '**Frewsburg, NY**

A community youth center providing practical assistance and high quality programming to the community''s youth and families.

**How it works** — Started in 2000 by a resident who noticed the town had no after-school option. It now runs state-licensed school-age childcare built around the gaps working parents actually hit: before school, after school with tutoring, half days, no-school days, and a summer day camp for K-6, 7am to 5:30pm. A faith-based organization serving the whole community — the model is covering the odd days nobody else covers.

A New Ruralism Initiative case study (Aging & youth) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/rijvy2z9zi43ahj/Frewsburg%20NY.pdf?dl=0',
   'Aging & youth · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'aging-youth', 'ny']::text[],
   2110),
  ('example',
   'Quimper Village',
   'A new model of senior living that allows residents to age in place while remaining an active part of the community.',
   '**Port Townsend, WA**

A new model of senior living that allows residents to age in place while remaining an active part of the community.

**How it works** — A 55-and-over cohousing community of 28 households, completed 2017, with a shared Common House for meals and events. Every building is single-storey and step-free, with roll-in showers, wide doorways and grab bars. Residents govern by sociocracy and commit to a set number of hours a month maintaining the place. Deliberately not a care facility: no personal or medical care, but neighbors trade "comfort services" — collecting mail, shopping for someone who is ill. They call it aging in community rather than aging in place.

A New Ruralism Initiative case study (Aging & youth) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/7zztjplj5ka3pwx/Port%20Townsend%20WA.pdf?dl=0',
   'Aging & youth · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'aging-youth', 'wa']::text[],
   2120),
  ('example',
   'Lubec Community Outreach Center',
   'A center building partnerships to provide programs for children, food education and a pantry, and other basic needs.',
   '**Lubec, ME**

A center building partnerships to provide programs for children, food education and a pantry, and other basic needs.

**How it works** — Founded 2012 to remove barriers in a town at the far eastern edge of the country. After-school and summer rec programs carry snacks and summer meals; a free-choice food pantry opens the second Saturday of each month to five surrounding towns, once a month per household. A thrift store, art and fabric studios, classes and older-adult gatherings share the same building — one address doing the work a city would spread across six.

A New Ruralism Initiative case study (Aging & youth) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/ndjeg0mea8fl2n8/Lubec%20Community%20Outreach%20Center.pdf?dl=0',
   'Aging & youth · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'aging-youth', 'me']::text[],
   2130),
  ('example',
   'Monadnock at Home',
   'A non-profit member-based organization helping seniors continue to live at home successfully.',
   '**Monadnock Region, NH**

A non-profit member-based organization helping seniors continue to live at home successfully.

**How it works** — A "village" model founded in 2010: members aged 62+ pay a modest fee, and a network of about 40 volunteers plus vetted providers covers what otherwise forces a move — rides to medical appointments, grocery and medication delivery, light handyman work, tech help, wellness check-ins. Roughly 120 members across twelve towns. Membership rather than charity is the structural choice; it is now run under Catholic Charities New Hampshire.

A New Ruralism Initiative case study (Aging & youth) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/bmmpioxod6qabwf/Monadnock%20at%20Home.pdf?dl=0',
   'Aging & youth · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'aging-youth', 'nh']::text[],
   2140),
  ('example',
   'Successful Aging in Place',
   'A town Advisory Council on Aging piloting the World Health Organization''s Age Friendly Communities Indicator Guide.',
   '**Bowdoinham, ME**

A town Advisory Council on Aging piloting the World Health Organization''s Age Friendly Communities Indicator Guide.

**How it works** — One of fifteen communities worldwide asked to pilot the WHO indicator guide, and the first municipality in northern New England admitted to the WHO Global Network of Age-Friendly Cities and Communities. Assessment, program evaluation and accessibility audits fed a three-year Action Plan adopted by the Select Board in 2017. Concrete pieces include a volunteer driver program for residents who do not drive and a "Handy Brigade" doing chores and basic home repair.

A New Ruralism Initiative case study (Aging & youth) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/q4n2656qrzi2gej/Successful%20Aging%20in%20Place.pdf?dl=0',
   'Aging & youth · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'aging-youth', 'me']::text[],
   2150),
  ('example',
   'Black Belt Treasures Cultural Arts Center',
   'A cultural arts center at the center of a budding arts-based economic revitalization in the region.',
   '**Camden, AL**

A cultural arts center at the center of a budding arts-based economic revitalization in the region.

**How it works** — Opened 2005 to grow the Black Belt economy by selling and promoting the region''s own fine art and heritage craft. It now carries work by 350+ artists (600+ shown over time) in paint, pottery, woodwork, basketry and jewellery, and has drawn visitors from all 50 states and 36 countries. The gallery funds the rest: classes and workshops for youth and adults, artist demonstrations, heritage arts lectures, and a Teaching Artist Program placing artists in schools.

A New Ruralism Initiative case study (Arts & local economy) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/30f823dqk0gjjpv/Camden%20AL.pdf?dl=0',
   'Arts & local economy · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'arts-local-economy', 'al']::text[],
   2210),
  ('example',
   'Mad River Valley Economic Study',
   'An economic study examining the agricultural economy, tourism and other elements of the local economy to identify realistic sustainable goals.',
   '**Mad River Valley, VT**

An economic study examining the agricultural economy, tourism and other elements of the local economy to identify realistic sustainable goals.

**How it works** — Commissioned by the Mad River Valley Planning District in 2014: quantitative data plus interviews with local stakeholders, organized around the valley''s four real sectors — agriculture, recreation and tourism, professional services, manufacturing. What makes it a model is what happened next. The findings went to a community gathering of over 350 people, and the public input there turned into the Economic Vitality Series, thirteen workshops on the valley''s barriers and opportunities. A study used as a convening device, not a shelf document.

A New Ruralism Initiative case study (Arts & local economy) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/7lwl17n7uq7lzys/MRV%20Econ%20Study.pdf?dl=0',
   'Arts & local economy · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'arts-local-economy', 'vt']::text[],
   2220),
  ('example',
   'Island Employee Cooperative',
   'A cooperative formed to keep core businesses in the hands of local workers for the benefit of the community.',
   '**Deer Isle & Stonington, ME**

A cooperative formed to keep core businesses in the hands of local workers for the benefit of the community.

**How it works** — In 2014 the employees of three island businesses — a 13,000 sq ft grocery, a hardware store and pharmacy, and a convenience store — bought them from owners of 43 years who were retiring. About 42 of 62 staff opted in, making it the largest worker co-op in Maine. The fear that drove it was concrete: an outside buyer would consolidate, and the nearest comparable store is 25 miles of back road away. Financing and technical help came from the Cooperative Development Institute, CEI and the Cooperative Fund of New England.

A New Ruralism Initiative case study (Arts & local economy) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/zdundle29p1s5wu/Island%20Employee%20Cooperative.pdf?dl=0',
   'Arts & local economy · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'arts-local-economy', 'me']::text[],
   2230),
  ('example',
   'Women''s Entrepreneurial Network (WREN)',
   'A membership-driven organization offering access to resources, training, technical assistance, and markets.',
   '**Bethlehem, NH**

A membership-driven organization offering access to resources, training, technical assistance, and markets.

**How it works** — Founded 1994 by rural women in New Hampshire''s North Country. Training and technical assistance are paired with the part most rural makers cannot build alone: an actual storefront. The Local Works Marketplace carries handcrafted goods from more than 120 local artists and makers, so the business support ends in a place to sell rather than a certificate. Educational, cultural and social events run for the whole town, not only members.

A New Ruralism Initiative case study (Arts & local economy) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/8l7ar0ybex50ywt/WREN.pdf?dl=0',
   'Arts & local economy · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'arts-local-economy', 'nh']::text[],
   2240),
  ('example',
   'Home Energy Action Team (HEAT)',
   'A volunteer team organizing residents to reduce energy costs by weatherizing homes.',
   '**Thetford, VT**

A volunteer team organizing residents to reduce energy costs by weatherizing homes.

**How it works** — In 2011, fifty volunteers door-knocked 650 homes — about 60% of the town — handing out free CFLs and weatherization information. It doubled the number of homes weatherized in a normal year within six months, and Efficiency Vermont modeled its statewide Home Energy Challenge on it. The same volunteer crew had already weatherized the Thetford Center Community Center in 2009, cutting air leakage by roughly 80%. Won Vermont Energy and Climate Action Network''s 2013 project of the year.

A New Ruralism Initiative case study (Energy) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/gmn3sz80y1y1y0r/HEAT.pdf?dl=0',
   'Energy · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'energy', 'vt']::text[],
   2310),
  ('example',
   'Plymouth Area Renewable Energy Initiative (PAREI)',
   'A volunteer organization helping residents reduce energy costs by installing solar thermal energy systems.',
   '**Plymouth, NH**

A volunteer organization helping residents reduce energy costs by installing solar thermal energy systems.

**How it works** — Formed in 2004, PAREI runs "energy raisers" — a barn-raising applied to solar hot water. Neighbours turn out to install a system on one house, and the host is then expected to show up at the next one, so labor cost falls and the skill spreads. Over 275 solar thermal and PV systems installed this way, alongside DIY, professional and grant-funded work, and PAREI documented the method on video so other towns can copy it. Note: the same organization runs NH Solar Shares, already on this shelf — that is its community-array program, this is the volunteer installation model.

A New Ruralism Initiative case study (Energy) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/wr2kqcafaruuq47/PAREI.pdf?dl=0',
   'Energy · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'energy', 'nh']::text[],
   2320),
  ('example',
   'NewAllen Alliance',
   'An alliance providing a unified voice for rural communities, fostering coordinated community and economic development.',
   '**East Allen County, IN**

An alliance providing a unified voice for rural communities, fostering coordinated community and economic development.

**How it works** — Formed in 1991 by two cities, three towns and two unincorporated communities in eastern Allen County, on the premise that none of them could attract investment alone. Each keeps its own plan; the alliance carries the shared priorities. It implemented about $64M of projects in four years and was named an Indiana Regional Stellar Community in 2018, which came with funding to execute a development plan.

A New Ruralism Initiative case study (Regional coordination & resilience) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/qbkx1w84osyft7i/NewAllen%20Indiana.pdf?dl=0',
   'Regional coordination & resilience · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'regional-coordination-resilience', 'in']::text[],
   2410),
  ('example',
   'King Arthur Flour SmartCommute',
   'A data-driven program providing customized incentives to employees to carpool.',
   '**Norwich, VT**

A data-driven program providing customized incentives to employees to carpool.

A New Ruralism Initiative case study (Regional coordination & resilience) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/7x0ih2w5k7fkna9/Smart%20Commute.pdf?dl=0',
   'Regional coordination & resilience · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'regional-coordination-resilience', 'vt']::text[],
   2420),
  ('example',
   'Downeast Lakes Land Trust',
   'A coalition of those who care about the area''s natural resources and their role in the region''s economy.',
   '**Grand Lake Stream, ME**

A coalition of those who care about the area''s natural resources and their role in the region''s economy.

**How it works** — Founded in 2001 by residents of a village of a few hundred, it now holds 55,678 acres as the Downeast Lakes Community Forest — among the largest community forests in the country. The point is that it is a working forest, not a preserve: sustainable timber harvest supports local jobs, and the revenue maintains roads, removes invasive species, restores habitat and pays property taxes. Conservation framed as the region''s economy rather than as a constraint on it.

A New Ruralism Initiative case study (Regional coordination & resilience) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/74s1vbdjune4lpx/Downeast%20Lakes%20Land%20Trust.pdf?dl=0',
   'Regional coordination & resilience · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'regional-coordination-resilience', 'me']::text[],
   2430),
  ('example',
   'Water Street',
   'A historic neighborhood retrofitted to reduce flood risks.',
   '**Northfield, VT**

A historic neighborhood retrofitted to reduce flood risks.

**How it works** — After Tropical Storm Irene in 2011 concentrated damage in the Water Street neighborhood beside the Dog River, the town used FEMA and Vermont Emergency Management funding to buy out 18 damaged homes in the floodplain, led by its hazard mitigation planner. The cleared 4-5 acres became Dog River Park in 2017 — designed to flood and recover without major repair, in three zones: lawn, wildflower meadow, and a riparian buffer of native trees and shrubs. Historic properties needed extra review by an architectural historian.

A New Ruralism Initiative case study (Regional coordination & resilience) — the American Planning Association''s collection of grassroots work strengthening rural communities, surfaced through Radically Rural''s resource library. Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.dropbox.com/s/ph2snswbdhb3nse/Northfield%20Flood.pdf?dl=0',
   'Regional coordination & resilience · New Ruralism Initiative · APA Small Town and Rural Planning Division',
   array['radically-rural', 'new-ruralism', 'regional-coordination-resilience', 'vt']::text[],
   2440)
) as v(kind, title, summary, body, url, attribution, tags, sort_order);
