-- Radically Rural, third shelf pass (Oct 2 2026): tiny-business recipes,
-- and two from Dorn Cox's world.
--
-- "101 Ways to Start More Tiny Businesses in Your Town" is Becky McCray's
-- (SaveYour.town, (c) 2017 2024) — a free PDF whose 104 numbered moves are
-- the most build-useful thing in Radically Rural's library, because it is a
-- menu of actions rather than one town's story.
--
-- It could not go in as one row: a non-principle item shows the model at
-- most STUDIO_ITEM_CHARS of its summary, so 104 moves behind one bullet
-- would be invisible. It goes in as eleven `recipe` rows, one per cluster,
-- each summary sized to survive that budget and each body carrying the
-- cluster's moves and the towns that ran them.
--
-- The wording is ours. Her list is the original and nothing is reproduced
-- verbatim: these are her ideas, grouped and reworded, which is why every
-- single row credits "Becky McCray · SaveYour.town" in `attribution` AND
-- names the source in the body. The url points at saveyour.town/101ways,
-- her own page, rather than a mirrored PDF — anyone following it lands
-- where she wants them.
--
-- The PDF's closing argument lands separately as a `principle`, since it is
-- a stance about how rural development should work (many tiny starts over
-- one big recruit) with research attached — Glaeser and Kerr in HBR,
-- Tolbert at Baylor, the roughly 2x local multiplier.
--
-- The PDF's inline links (lost when the list was first pasted as text) are
-- back, read from the PDF's own link annotations on Oct 2 2026 and placed
-- under "Links from the original list" in the recipe they belong to. Three
-- are substantial resources in their own right and also get their own
-- example rows: Endless Orchard, NMPAN's mobile slaughter units, and
-- Lemonade Day. Their "How it works" comes from each organization's own
-- descriptions as surfaced by web search, then checked against the live
-- sites. All links were checked on Oct 2 2026; the smoffice domain is gone,
-- so it points at its Wayback Machine copy.
--
-- Plus two examples: Tuckaway Food Commons and Farm Hack. Dorn Cox is in
-- both, and each entry says so. Farm Hack points at farmhack.org rather
-- than the "Test-38" GitHub Pages draft that surfaced it — a personal test
-- URL is not a link to seed, and the body notes the draft exists.
--
-- Studio-private and approved, like the earlier passes. Re-runnable on its
-- own rows only.

delete from public.studio_library_items
  where studio_slug = 'radically-rural'
    and created_by is null
    and ('tiny-business' = any(tags) or 'open-source' = any(tags)
         or title = 'Tuckaway Food Commons');

insert into public.studio_library_items
  (studio_slug, kind, title, summary, body, url, attribution, tags, sort_order)
select 'radically-rural', v.kind, v.title, v.summary, v.body, v.url,
       v.attribution, v.tags, v.sort_order
from (values
  ('principle',
   'Many tiny starts beat one big bet',
   'Becky McCray''s case for tiny businesses as rural economic development, with the research behind it.',
   'Rural economic development has a default: recruit one big
employer, compete with every other town in the region for it, and wait.
Becky McCray''s argument in *101 Ways to Start More Tiny Businesses in Your
Town* is that many tiny starts beat one big bet, and she grounds it:

- **Tiny businesses lower the barrier.** The traditional route — business
  plan, legal entity, a building to buy or rehab, financing, staffing —
  needs personal wealth, good credit and connections. Starting small means
  someone can try for a day, recover fast from failure, and scale a success.
  More people get to participate.
- **More small firms means more jobs.** Glaeser and Kerr, writing in the
  Harvard Business Review, found small entrepreneurial businesses strongly
  correlated with regional economic growth and faster employment growth.
  People who never start a business never hire anyone.
  (https://hbr.org/2010/07/the-secret-to-job-growth-think-small/ar/1)
- **Local ownership tracks with local wellbeing.** Charles Tolbert''s
  research at Baylor associated locally owned small business with higher
  average income, less income inequality, lower poverty, lower
  unemployment, less crime and better health outcomes. Large businesses
  showed no such association.
- **Local owners keep about twice as much in town.** They buy and stock
  locally, give locally, and spend their profits where they live.
- **Local owners choose the values**, in town, not at a distant head office.

What this means for a build in this studio: design for many small starts,
not one big recruit. Prefer tools that lower a barrier for the next
twenty people over tools that serve one anchor tenant. Ask who currently
cannot participate and what single shared thing — a space, a kitchen, a
license, a list, an audience — is stopping them. And treat "test it before
you check whether it is allowed" as a real option worth naming to a
builder, alongside the slower work of changing the rule.',
   'https://saveyour.town/101ways',
   'Becky McCray · SaveYour.town',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'saveyour-town']::text[],
   60),
  ('recipe',
   'Empty lots and storage sheds',
   'Treat a vacant lot as premises, not a problem: declare it open for business and let people set up. Storage sheds make the cheapest permanent-feeling storefront there is — borrow them from the dealer for a festival, or buy a row and give the lot a market village. Low rent and a short lease are the point: someone can test an idea for one season without a loan.',
   'Treat a vacant lot as premises, not a problem: declare it open for business and let people set up. Storage sheds make the cheapest permanent-feeling storefront there is — borrow them from the dealer for a festival, or buy a row and give the lot a market village. Low rent and a short lease are the point: someone can test an idea for one season without a loan.

**Moves in this cluster**

- Declare an empty lot open and let anyone set up on it
- Ask a storage shed dealer to lend sheds as pop-up premises during a festival, then make it ongoing on their sales lot
- Buy or place sheds as a seasonal or year-round market village
- Scatter shed businesses around town rather than concentrating them
- Try a higher-end version: artist shanties
- Make a dedicated spot for truck- and trailer-based businesses

**Towns that have run these:** Miller SD · Tionesta PA · Hyannis MA

**Links from the original list**

- Storage-shed businesses as a rural development tool (Small Biz Survival): https://smallbizsurvival.com/2017/03/tiny-businesses-in-storage-sheds-a-rural-economic-development-tool.html
- Tiny business villages — the Tionesta model (Small Biz Survival): https://smallbizsurvival.com/2015/04/rural-economic-development-idea-tiny-business-villages.html
- HyArts artist shanties, Hyannis (Arts Barnstable): https://artsbarnstable.com/destinations/hyarts-shanties/

From *101 Ways to Start More Tiny Businesses in Your Town* by Becky McCray, co-founder of SaveYour.town — grouped and reworded here, with her list the original. The full list (104 moves, each with towns that ran it) is free at saveyour.town/101ways.',
   'https://saveyour.town/101ways',
   'Becky McCray · SaveYour.town',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'saveyour-town']::text[],
   3010),
  ('recipe',
   'Space inside businesses that already exist',
   'The cheapest retail space in town is already heated and staffed — it just belongs to someone else. Walk in and ask. A square foot of counter, an unused salon booth, a back office, a display window, the lobby of a non-retail business. Each one is a storefront that costs a conversation rather than a lease.',
   'The cheapest retail space in town is already heated and staffed — it just belongs to someone else. Walk in and ask. A square foot of counter, an unused salon booth, a back office, a display window, the lobby of a non-retail business. Each one is a storefront that costs a conversation rather than a lease.

**Moves in this cluster**

- Ask a retailer to dedicate one square foot of counter or floor to a new tiny business
- Look inside existing businesses for unused facilities — the disused salon booth at the back of a shop
- Add a small retail corner to the front of a non-retail business
- Rent out unused offices and rooms as tiny workspaces
- Turn an empty display window into a one-person office
- Look for selling and locating space inside museums and historical sites
- Ask businesses based outside town whether they want a tiny outpost in it

**Towns that have run these:** Durham NC · Sulphur OK

**Links from the original list**

- The smoffice — an office in a display window, Durham NC (site now offline; archived copy): https://web.archive.org/web/20250316132541/http://thesmoffice.com/
- Aachompa gift shop at the Chickasaw Cultural Center, Sulphur OK: https://www.chickasawculturalcenter.com/explore/aachompa-gift-shop/

From *101 Ways to Start More Tiny Businesses in Your Town* by Becky McCray, co-founder of SaveYour.town — grouped and reworded here, with her list the original. The full list (104 moves, each with towns that ran it) is free at saveyour.town/101ways.',
   'https://saveyour.town/101ways',
   'Becky McCray · SaveYour.town',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'saveyour-town']::text[],
   3020),
  ('recipe',
   'Pop-ups in empty buildings and closed streets',
   'Emptiness is inventory. A vacant sidewalk, a closed street for a day, an empty building for a weekend — each is a venue a first-timer can use without signing anything. Start temporary to find out who shows up, then convert what works into something ongoing: rotating pop-ups, artists'' workspaces, or small permanent stalls built inside the shell.',
   'Emptiness is inventory. A vacant sidewalk, a closed street for a day, an empty building for a weekend — each is a venue a first-timer can use without signing anything. Start temporary to find out who shows up, then convert what works into something ongoing: rotating pop-ups, artists'' workspaces, or small permanent stalls built inside the shell.

**Moves in this cluster**

- Take over an empty sidewalk for temporary pop-ups
- Close the streets for a day and fill them with pop-ups
- Use an empty building for temporary pop-ups, then convert it to ongoing ones
- Convert an empty building into artists'' workspaces
- Build tiny stores inside an empty building
- Make booth space part of every special event
- Create events that are nothing but booths and pop-ups, or a European-style holiday market
- Run a tour of empty buildings to clean them up and show what is available

**Towns that have run these:** Waynoka OK · Washington IA · Webster City IA · Steubenville OH

**Links from the original list**

- Waynoka OK street pop-ups (SaveYour.town): https://saveyour.town/pop-up-interview/
- One downtown building, many new retail stores — Washington IA (Small Biz Survival): https://smallbizsurvival.com/2013/08/one-downtown-building-many-new-retail-stores.html
- Market Nights, Webster City IA: https://visitwebstercityiowa.com/market-nights/
- Nutcracker Village, Steubenville OH: https://www.visitsteubenville.com/what-to-do/steubenville-nutcracker-village/
- A tour of empty buildings — Webster City IA (Small Biz Survival): https://smallbizsurvival.com/2013/05/small-town-economic-development-idea-tour-empty-buildings.html

From *101 Ways to Start More Tiny Businesses in Your Town* by Becky McCray, co-founder of SaveYour.town — grouped and reworded here, with her list the original. The full list (104 moves, each with towns that ran it) is free at saveyour.town/101ways.',
   'https://saveyour.town/101ways',
   'Becky McCray · SaveYour.town',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'saveyour-town']::text[],
   3030),
  ('recipe',
   'Restaurants, kitchens and the days they are closed',
   'A commercial kitchen is the single most expensive thing a food business needs and the most commonly idle. Every closed day, every dark dining room and every church or school kitchen is capacity someone could rent by the day. Split a restaurant by hours, by days, or into four spaces — or skip the dining room entirely.',
   'A commercial kitchen is the single most expensive thing a food business needs and the most commonly idle. Every closed day, every dark dining room and every church or school kitchen is capacity someone could rent by the day. Split a restaurant by hours, by days, or into four spaces — or skip the dining room entirely.

**Moves in this cluster**

- Ask a restaurant that closes certain days to let a different eatery open on those days
- Turn a closed restaurant into short-term, then ongoing, food pop-ups rentable by day or week
- Convert a closed restaurant into a rentable kitchen for mobile food businesses
- Divide an empty restaurant into four spaces and run four eateries at once
- Let two restaurants split a day — one breakfast, one supper
- Use an out-of-the-way building for delivery-only kitchens
- Host community dinners in a closed restaurant to build interest in food pop-ups
- Use a closed restaurant, former school or church kitchen as a food business incubator

**Towns that have run these:** Clinton MN

**Links from the original list**

- "The inadvertent cafe" — Clinton MN (Center for Rural Policy and Development): https://www.ruralmn.org/ruralreality/rural-success-in-the-making-the-inadvertent-cafe/

From *101 Ways to Start More Tiny Businesses in Your Town* by Becky McCray, co-founder of SaveYour.town — grouped and reworded here, with her list the original. The full list (104 moves, each with towns that ran it) is free at saveyour.town/101ways.',
   'https://saveyour.town/101ways',
   'Becky McCray · SaveYour.town',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'saveyour-town']::text[],
   3040),
  ('recipe',
   'Shared space to make, work and record in',
   'Most tiny businesses need a tool, a room or a piece of kit for a few hours a month and cannot justify owning any of it. Shared space converts that into a membership. Start with what exists — the library already has workspaces — before building anything, and remember a tool library or a rentable garage counts as much as a maker space.',
   'Most tiny businesses need a tool, a room or a piece of kit for a few hours a month and cannot justify owning any of it. Shared space converts that into a membership. Start with what exists — the library already has workspaces — before building anything, and remember a tool library or a rentable garage counts as much as a maker space.

**Moves in this cluster**

- Publicize the library''s workspaces as somewhere to work on a business
- Hold casual coworking and co-crafting events, including outdoors so people see how many laptop businesses the town has
- Set up a coworking or co-crafting space
- Create a tool library and teach classes on using the tools
- Set up a maker space — low-tech, desktop manufacturing, or high-tech
- Create rentable garages and workshops
- Set up a video or audio studio anyone can rent
- Open performance spaces and tiny outdoor stages to anyone teaching lessons
- Set up indoor or outdoor gym studios rentable by the hour for fitness teaching
- Put public wifi in more places, available around the clock
- Let people check out a wireless hotspot from the library

**Towns that have run these:** Pella IA · Central Ohio · Sonora CA · Round Rock TX · Oklahoma

**Links from the original list**

- Jelly casual coworking, Round Rock TX: http://wiki.workatjelly.com/w/page/12752856/JellyInRoundRock
- How to start a coworking space in your small town — Pella IA (Small Biz Survival): https://smallbizsurvival.com/2011/03/how-to-start-coworking-space-in-your.html
- Tool library, Central Ohio: https://rtcentralohio.org/tool-library/
- Low-cost desktop manufacturing tools (SmallBusiness.com): https://smallbusiness.com/manufacturing/low-cost-manufacturing-tools/
- An empty hospital turned innovation lab, with maker and video studios — Sonora CA (Small Biz Survival): https://smallbizsurvival.com/2015/01/empty-hospital-building-innovation-lab.html
- Four reasons for downtown wifi areas (Small Biz Survival): https://smallbizsurvival.com/2016/06/4-reasons-for-small-towns-to-setup-downtown-wifi-areas.html
- Borrowing a wifi hotspot from the library (Metropolitan Library System, Oklahoma): https://help.metrolibrary.org/questions/32817

From *101 Ways to Start More Tiny Businesses in Your Town* by Becky McCray, co-founder of SaveYour.town — grouped and reworded here, with her list the original. The full list (104 moves, each with towns that ran it) is free at saveyour.town/101ways.',
   'https://saveyour.town/101ways',
   'Becky McCray · SaveYour.town',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'saveyour-town']::text[],
   3050),
  ('recipe',
   'On-ramps for young people and first-timers',
   'Plenty of people in town already make things and have never thought of it as a business. Students in shop and ag classes, garden clubs, church and club fundraisers, a business owner''s relative with an idea. Finding them somewhere to sell is often the entire intervention.',
   'Plenty of people in town already make things and have never thought of it as a business. Students in shop and ag classes, garden clubs, church and club fundraisers, a business owner''s relative with an idea. Finding them somewhere to sell is often the entire intervention.

**Moves in this cluster**

- Find out what students make in school and find them somewhere to sell it
- Ask ag instructors what students could produce — seedlings, baby chicks, welded goods
- Ask garden clubs whether their plants could become a pop-up
- Ask local organizations what they already make and sell that could become a tiny business
- Ask business owners whether a family member wants to try a pop-up
- Run a summer entrepreneurship project — for youth, and for adults too

**Links from the original list**

- Lemonade Day — a free youth entrepreneurship program (also on this shelf): https://lemonadeday.org/

From *101 Ways to Start More Tiny Businesses in Your Town* by Becky McCray, co-founder of SaveYour.town — grouped and reworded here, with her list the original. The full list (104 moves, each with towns that ran it) is free at saveyour.town/101ways.',
   'https://saveyour.town/101ways',
   'Becky McCray · SaveYour.town',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'saveyour-town']::text[],
   3060),
  ('recipe',
   'Publicize the demand that is already here',
   'Towns hunt for business ideas while the demand sits unpublished. Local employers, governments and nonprofits all buy things and all pay to throw things away. Publishing those lists turns a waste stream into a feedstock and a purchase order into a business plan. Then stand at the city limits and ask what you make that could sell elsewhere.',
   'Towns hunt for business ideas while the demand sits unpublished. Local employers, governments and nonprofits all buy things and all pay to throw things away. Publishing those lists turns a waste stream into a feedstock and a purchase order into a business plan. Then stand at the city limits and ask what you make that could sell elsewhere.

**Moves in this cluster**

- Publicize waste products local businesses pay to dispose of, and the raw materials, products and services they buy
- Do the same for local governments, nonprofits and agencies
- Stand at the city limits and ask what the town produces that could be sold to other areas
- Find manufacturing equipment that sits idle part of the day, week or year and could be rented out
- Find and publicize every organization offering business training or support
- Connect graduates of every local class and course to tiny business opportunities
- Publicize local financial literacy programs and the training databases the library subscribes to

**Towns that have run these:** Iowa

**Links from the original list**

- Iowa Waste Exchange, the state DNR''s free materials-matching service (the PDF linked a regional Facebook page that is gone): https://www.iowadnr.gov/environmental-protection/land-quality/waste-planning-programs/iowa-waste-exchange

From *101 Ways to Start More Tiny Businesses in Your Town* by Becky McCray, co-founder of SaveYour.town — grouped and reworded here, with her list the original. The full list (104 moves, each with towns that ran it) is free at saveyour.town/101ways.',
   'https://saveyour.town/101ways',
   'Becky McCray · SaveYour.town',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'saveyour-town']::text[],
   3070),
  ('recipe',
   'Food, growing and gleaning',
   'Food is the lowest-barrier product most places have, and the barriers that remain are shared ones: a tasting audience, a stall small enough for six jars, somewhere to process meat, fruit nobody picks. Fix the shared barrier and several businesses appear at once.',
   'Food is the lowest-barrier product most places have, and the barriers that remain are shared ones: a tasting audience, a stall small enough for six jars, somewhere to process meat, fruit nobody picks. Fix the shared barrier and several businesses appear at once.

**Moves in this cluster**

- Hold tasting events for local foods
- Create public garden space and encourage selling the produce
- Teach gardening classes with marketing included
- Open a farmers'' market space for people with only a few items to sell
- Help people find, collect and sell unharvested fruit from trees around town
- Create small mobile slaughterhouses for local livestock businesses
- Build a recreation equipment library to seed recreation-based businesses

**Links from the original list**

- Endless Orchard — a crowd-sourced map of public fruit trees (also on this shelf): https://endlessorchard.com/about/
- Mobile slaughter and processing units (Niche Meat Processor Assistance Network; also on this shelf): https://www.nichemeatprocessing.org/mobile-unit-overview/
- Libraries that lend fishing poles, pans and people (NPR): https://www.npr.org/2013/08/13/211697593/beyond-books-libraries-lend-fishing-poles-pans-and-people

From *101 Ways to Start More Tiny Businesses in Your Town* by Becky McCray, co-founder of SaveYour.town — grouped and reworded here, with her list the original. The full list (104 moves, each with towns that ran it) is free at saveyour.town/101ways.',
   'https://saveyour.town/101ways',
   'Becky McCray · SaveYour.town',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'saveyour-town']::text[],
   3080),
  ('recipe',
   'Repair, reuse and the fix-it economy',
   'Repair is a business, a skill-share and a waste-reduction program at once, and it needs almost nothing to start: a room, some tools and people who know things. It also surfaces the menders in town, who are often the same people who would start something else given a nudge.',
   'Repair is a business, a skill-share and a waste-reduction program at once, and it needs almost nothing to start: a room, some tools and people who know things. It also surfaces the menders in town, who are often the same people who would start something else given a nudge.

**Moves in this cluster**

- Start a fix-it shop where people repair neighbors'' clothes, electronics and household things
- Hold co-crafting events — crafternoons, hacker days, maker days
- Connect people to online platforms for custom-made goods, such as custom fabric printing
- Hold a real-world event for the people already selling in local online swap and buy/sell groups

**Towns that have run these:** Willimantic CT

**Links from the original list**

- The fix-it shop where neighbors repair clothes and electronics — Willimantic CT (YES! Magazine): https://www.yesmagazine.org/issues/50-solutions/the-fix-it-shop-where-neighbors-repair-your-clothes-and-electronics-20161220
- Spoonflower custom fabric printing: https://www.spoonflower.com/en/about/how-it-works

From *101 Ways to Start More Tiny Businesses in Your Town* by Becky McCray, co-founder of SaveYour.town — grouped and reworded here, with her list the original. The full list (104 moves, each with towns that ran it) is free at saveyour.town/101ways.',
   'https://saveyour.town/101ways',
   'Becky McCray · SaveYour.town',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'saveyour-town']::text[],
   3090),
  ('recipe',
   'Notice people out loud',
   'Recognition is free and most towns withhold it until a business is big enough to look serious. Pay the artists even when they are starting out. Write the profile. Give the award. Say the words. A town that visibly values tiny businesses gets more of them.',
   'Recognition is free and most towns withhold it until a business is big enough to look serious. Pay the artists even when they are starting out. Write the profile. Give the award. Say the words. A town that visibly values tiny businesses gets more of them.

**Moves in this cluster**

- Pay local artists, musicians and creatives to take part in local events, even at the very start
- Host a paid artist-, poet- or maker-in-residence
- Shop local and spend with tiny businesses
- Write profiles and film stories of tiny business owners for the paper, social media and blogs
- Give awards to people who try
- Tell people who try that you appreciate them and that they matter
- Keep public boards of tiny local businesses and of available tiny business spaces
- Hang local art on the walls of local businesses
- Hold networking events pairing existing owners with would-be ones
- Hold author fairs, literary festivals, writing events inside businesses, and fairs for home-based and direct-selling businesses

**Towns that have run these:** Webster City IA · Goffstown NH · Croydon UK · Alva OK

**Links from the original list**

- Using art to build community — Webster City IA residencies (SaveYour.town): https://saveyour.town/use-art-to-build-community/
- Goffstown NH art (Facebook): https://www.facebook.com/GoffstownArt
- Croydon literary festival: https://croydonlit.wordpress.com/
- Alva hosts a writing event inside businesses (Northwestern News): https://northwesternnews.rangerpulse.com/alva-hosts-writing-event/
- Business fairs, and where to hold them (Small Biz Survival): https://smallbizsurvival.com/2016/04/i-love-everything-about-business-fairs-except-where-they-are-held.html

From *101 Ways to Start More Tiny Businesses in Your Town* by Becky McCray, co-founder of SaveYour.town — grouped and reworded here, with her list the original. The full list (104 moves, each with towns that ran it) is free at saveyour.town/101ways.',
   'https://saveyour.town/101ways',
   'Becky McCray · SaveYour.town',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'saveyour-town']::text[],
   3100),
  ('recipe',
   'Money, rules and getting out of the way',
   'The last barriers are usually local and self-imposed: a license nobody has revisited, a code written for a different decade, no small money available. McCray''s position is blunt — test the idea before worrying whether it fits the rules, and if the rules are the problem, suspend them in one place temporarily and see what appears.',
   'The last barriers are usually local and self-imposed: a license nobody has revisited, a code written for a different decade, no small money available. McCray''s position is blunt — test the idea before worrying whether it fits the rules, and if the rules are the problem, suspend them in one place temporarily and see what appears.

**Moves in this cluster**

- Create tiny local investment funds and microloan funds
- Release economic development data publicly and hold sessions showing people the opportunities in it
- Create bike lanes so people without cars can get around town and do business
- Eliminate or relax licensing rules across all kinds of businesses
- Test the ideas before worrying about whether they fit the rules
- Declare a temporary bureaucracy-free zone where the rules currently block things
- Where that is not possible, work to change the rules

**Towns that have run these:** Alva OK

**Links from the original list**

- Local investing (Small Biz Survival, 2012): https://smallbizsurvival.com/2012/03/local-investing-will-change-face-of.html
- Set your economic development data free — Alva OK (Small Biz Survival): https://smallbizsurvival.com/2013/05/set-your-economic-development-data-free.html

From *101 Ways to Start More Tiny Businesses in Your Town* by Becky McCray, co-founder of SaveYour.town — grouped and reworded here, with her list the original. The full list (104 moves, each with towns that ran it) is free at saveyour.town/101ways.',
   'https://saveyour.town/101ways',
   'Becky McCray · SaveYour.town',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'saveyour-town']::text[],
   3110),
  ('example',
   'Endless Orchard',
   'A free, crowd-sourced map of public fruit trees: people plant, map and share trees on the margins of public and private space so anyone can find and pick them.',
   '**Global, from Los Angeles**

A free, crowd-sourced map of public fruit trees, made by the artist duo Fallen Fruit (David Burns and Austin Young) and launched on Earth Day 2017.

**How it works** — Anyone can add a fruit tree to the map: one in front of their home, business, school or community center, or on a parkway, bike path or alley edge. Others use the map to find and pick it. It is both a planting movement and a finding tool.

Why it is here: Becky McCray''s *101 Ways to Start More Tiny Businesses* points to it for one move: help people find, collect and sell unharvested fruit from trees around town. A town''s first gleaning business needs to know where the trees are.',
   'https://endlessorchard.com/about/',
   'Fallen Fruit · surfaced via Becky McCray''s 101 Ways',
   array['radically-rural', 'tiny-business', 'food-working-lands', 'national']::text[],
   3210),
  ('example',
   'Mobile slaughter and processing units',
   'Trailer-based, USDA-inspected slaughter units that come to the farm, so small livestock producers in remote places can sell inspected meat without a distant plant.',
   '**National**

Mobile Slaughter Units (and mobile poultry processing units) are a lower-cost way to bring safe, small-scale red meat and poultry slaughter to remote areas. The Niche Meat Processor Assistance Network (NMPAN) keeps the practical record: how a unit and farm site are set up, who builds units, which are operating, case studies, and capacity planning.

**How it works** — A slaughter trailer operates under USDA inspection and travels to farms, which is what lets small producers sell their meat at all. The first USDA-inspected mobile unit in the U.S. was in the San Juan Islands of Washington State; units now operate around the country.

Why it is here: Becky McCray''s *101 Ways to Start More Tiny Businesses* names small mobile slaughterhouses as a shared barrier worth fixing for local livestock businesses. One unit can serve many farms.',
   'https://www.nichemeatprocessing.org/mobile-unit-overview/',
   'Niche Meat Processor Assistance Network · surfaced via Becky McCray''s 101 Ways',
   array['radically-rural', 'tiny-business', 'food-working-lands', 'national']::text[],
   3220),
  ('example',
   'Lemonade Day',
   'A free youth entrepreneurship program: kids plan, launch and run their own lemonade stand on a community-wide day, with local mentors and sponsors.',
   '**National (U.S. and Canada)**

A free, experiential program that teaches young people, roughly grades K-8, to start, own and run a business: a lemonade stand.

**How it works** — A community signs on as a host. Kids work through free lessons (an app or printed workbook) on planning, launching and running the stand, then open on the town''s Lemonade Day. Local leaders, banks, businesses, schools, churches and youth groups act as mentors and sponsors. Kids keep what they earn and are encouraged to give some to a cause they choose.

Why it is here: Becky McCray''s *101 Ways to Start More Tiny Businesses* uses it as the model for a summer entrepreneurship project for youth. She suggests running one for adults too.',
   'https://lemonadeday.org/',
   'Lemonade Day · surfaced via Becky McCray''s 101 Ways',
   array['radically-rural', 'tiny-business', 'entrepreneurship', 'youth', 'national']::text[],
   3230),
  ('example',
   'Tuckaway Food Commons',
   'A community-rooted food hub bringing together farms, food producers, educators, nonprofits and neighbors to strengthen a resilient Seacoast food system.',
   '**Lee, NH**

A community-rooted food hub on a multi-generational organic farm, bringing together farms, food producers, educators, nonprofits and neighbors.

**How it works** — Tuckaway Farm has been farmed organically for over 50 years — vegetables, small fruits, hay, blueberries, mushrooms, grains and oilseed, using draft horse power and no/low-till where possible, with rotationally grazed livestock and poultry. Chuck and Laurel Cox started it in 1983; Dorn and Sarah Cox carry it on. The Food Commons wraps shared infrastructure around the farm rather than only selling its own produce: a farm store aggregating regional growers and producers, indoor and outdoor community space for workshops and gatherings, 20x20 community garden plots with shared tools and water, and a commercial kitchen that broke ground in spring 2026 for local food producers to use.

A March 2024 fire took three barns, hay, equipment, tools and livestock. The Seacoast community rallied to rebuild — which is part of the model, not an aside: a food hub people depend on is one they turn out for.

Note: Dorn Cox is also a co-founder of Farm Hack, also on this shelf.',
   'https://tuckawayfoodcommons.org/',
   'Tuckaway Farm, Lee NH',
   array['radically-rural', 'food-working-lands', 'nh']::text[],
   2510),
  ('example',
   'Farm Hack',
   'A farmer-driven community developing, documenting and building open-source tools for resilient agriculture.',
   '**National / international**

A farmer-driven community that develops, documents and shares open-source tools for resilient agriculture.

**How it works** — Formed in 2010, Farm Hack is a repository of farm tool designs documented by the people who made, used and modified them — garlic planters, drip tape winders, poultry pluckers, no-till seed drills, and the remanufacture of an "extinct" farm-scale oat huller. Posting a design commits it to open-source licensing: any member can edit the page, and anyone can build from it freely. Over 100 tools were documented in the first year. The community is deliberately wider than farmers — engineers, fabricators, designers, programmers and tinkerers work on the same pages. Adjacent work pairs low-cost sensors and data loggers with Raspberry Pi and farmOS so a farm can build its own monitoring rather than buying it.

For this studio the transferable idea is the documentation commons itself: a tool is only replicable if somebody wrote down how to build it, in a place the next person can correct.

Note: co-founded by Dorn Cox, who also farms at Tuckaway Food Commons, also on this shelf. A draft "Farm Hack box" introduction exists at a personal GitHub Pages address, but it is an unstable test URL, so this entry points at the project itself.',
   'https://farmhack.org/',
   'Farm Hack',
   array['radically-rural', 'open-source', 'food-working-lands', 'national']::text[],
   2520)
) as v(kind, title, summary, body, url, attribution, tags, sort_order);
