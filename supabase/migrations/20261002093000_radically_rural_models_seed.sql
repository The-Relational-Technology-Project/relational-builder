-- Seed the Radically Rural shelf (Oct 2 2026). 42 models from the Radically
-- Rural models library at radicallyrural.org/models — the network's running
-- answer to "what is working in rural", across eleven categories:
-- accessibility, health, childcare, community journalism, disaster planning
-- and broadband, energy, entrepreneurship, housing, land and community,
-- main street, and youth retention.
--
-- Each row is an `example`: a pattern a builder in the studio can read and
-- remix into a tool for their own town. `summary` is Radically Rural's own
-- one-line description. `body` adds the place and a "How it works" note
-- researched from the linked organization's own material and press coverage
-- — the mechanics a town would need to copy it: what it costs, who runs it,
-- how people get in. `url` points back at the organization or the story, so
-- credit and the fuller detail stay one click away.
--
-- Two notes on the source page: it lists Coburns' General Store in
-- "Stafford, VT" (the town is Strafford), corrected here; and its "Amateur
-- Ration Toolkit" is kept verbatim though it appears to be a typo for
-- Amateur Radio. Safe Together is the one entry with no "How it works" —
-- nothing beyond the catalog line could be verified.
--
-- Everything lands STUDIO-PRIVATE and approved: visibility and status take
-- the table defaults ('studio', 'approved'), so the items are on the shelf
-- for members immediately and in nobody else's gallery. Offering any of
-- them to the wider commons stays a Studio Admin's deliberate act.
--
-- Re-runnable: the delete below clears only rows this seed owns (no
-- created_by, so never a member's own contribution) before re-inserting.

delete from public.studio_library_items
  where studio_slug = 'radically-rural'
    and created_by is null
    and 'radically-rural' = any(tags);

insert into public.studio_library_items
  (studio_slug, kind, title, summary, body, url, attribution, tags, sort_order)
select 'radically-rural', 'example', v.title, v.summary, v.body, v.url,
       v.attribution, v.tags, v.sort_order
from (values
  ('Neighborhood Access',
   'This consulting firm brings accessibility training and audits to local communities, businesses, and nonprofits.',
   '**Concord, NH**

This consulting firm brings accessibility training and audits to local communities, businesses, and nonprofits.

**How it works** — A disabled-owned and -operated accessibility consultancy. It runs full physical-space evaluations — visiting a site and assessing how usable it actually is for people with a range of disabilities — alongside training on the organization''s own processes and practices, so what gets fixed is the culture as well as the doorway.

A replicable rural model from the Radically Rural models library (Accessibility & Inclusivity). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.neighborhoodaccess.org/',
   'Accessibility & Inclusivity · Radically Rural models library',
   array['radically-rural', 'accessibility-inclusivity', 'nh']::text[],
   110),
  ('Mohawk Cultural Center',
   'This mobile learning center visits schools, community centers, and events to deliver Mohawk culture to Akwesasne.',
   '**Paul Smiths, NY**

This mobile learning center visits schools, community centers, and events to deliver Mohawk culture to Akwesasne.

**How it works** — A cultural learning lab built as a cabin on wheels: about twenty Paul Smith''s College students designed and built it over three years in partnership with the Akwesasne Mohawk community. It carries books, crafts, instruments and Mohawk-language materials, and travels to schools, community centers, powwows and events as a meeting, tutoring and language-learning space. Built from local lumber, recycled windows and LED lighting.

A replicable rural model from the Radically Rural models library (Accessibility & Inclusivity). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.northcountrypublicradio.org/news/story/48749/20231107/learning-lab-on-wheels-delivers-mohawk-culture-to-akwesasne',
   'Accessibility & Inclusivity · Radically Rural models library',
   array['radically-rural', 'accessibility-inclusivity', 'ny']::text[],
   120),
  ('Forsyth Chamber of Commerce',
   'This Chamber of Commerce hosts newcomers events to make new residents feel welcome and engaged in local politics and community.',
   '**Forsyth, MT**

This Chamber of Commerce hosts newcomers events to make new residents feel welcome and engaged in local politics and community.

**How it works** — A newcomers get-together with deliberately no agenda: gather the people who recently moved to town, introduce them to each other and to a few locals, and let them ask questions of city and Chamber leaders. An extension agent started it after a Reimagining Rural conference; Extension hosted the first one with help from the community foundation, and the Chamber now runs it regularly.

A replicable rural model from the Radically Rural models library (Accessibility & Inclusivity). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://saveyour.town/newcomer-get-togethers-help-small-towns-thrive/',
   'Accessibility & Inclusivity · Radically Rural models library',
   array['radically-rural', 'accessibility-inclusivity', 'mt']::text[],
   130),
  ('Stable Recovery',
   'This program provides horse industry training to those recovering from addiction.',
   '**Lexington, KY**

This program provides horse industry training to those recovering from addiction.

**How it works** — A free, yearlong 12-step program based at Taylor Made Farm, where participants live, work and train on site. It opens with the School of Horsemanship, a 90-day course in horse care and farm operations, and the Thoroughbred industry hires out of it. Funded entirely by private donors and grants. Since 2019 more than 110 graduates — people in recovery, recently released from prison, or both — have taken jobs in the horse industry, and a women''s program now runs at Spy Coast Farm.

A replicable rural model from the Radically Rural models library (All in for Health). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://dailyyonder.com/jobs-program-stable-recovery-trains-people-in-recovery-to-work-in-kentuckys-horse-industry/2023/05/03/',
   'All in for Health · Radically Rural models library',
   array['radically-rural', 'all-in-for-health', 'ky']::text[],
   210),
  ('Walking School Buses',
   'Groups of parents organize and supervise group walks to school to encourage active transportation over driving.',
   '**Washington D.C.**

Groups of parents organize and supervise group walks to school to encourage active transportation over driving.

**How it works** — A supervised group of children walking to school together along a fixed route with set stops and times, picking up walkers along the way like a bus. Trained volunteers or school staff supervise; the CDC guideline is one adult per six children, and roughly double that for the youngest. Starting one takes little more than a safe-route map, a handful of families on the same street, and an agreed schedule.

A replicable rural model from the Radically Rural models library (All in for Health). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://youtu.be/DqvQ-5784po?si=xdDUxjRQf7NlLZIj',
   'All in for Health · Radically Rural models library',
   array['radically-rural', 'all-in-for-health', 'dc']::text[],
   220),
  ('Safe Together',
   'This interactive guide and creative report is based on findings from the Rural Minnesota Safety Project.',
   '**Brainerd, MN**

This interactive guide and creative report is based on findings from the Rural Minnesota Safety Project.

A replicable rural model from the Radically Rural models library (All in for Health). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://39fa63b4-31d2-4c7a-87ee-9a0f81d1a350.filesusr.com/ugd/954a8c_cbc71c71f9844336b3df92b03b50ee59.pdf',
   'All in for Health · Radically Rural models library',
   array['radically-rural', 'all-in-for-health', 'mn']::text[],
   230),
  ('Early Childhood Initiative',
   'This network of parents, educators, and more works to improve the quality of care for and development of young children.',
   '**West Central, MN**

This network of parents, educators, and more works to improve the quality of care for and development of young children.

**How it works** — A West Central Initiative program joining parents, educators, businesses, community leaders, faith leaders and policymakers in a long-term effort to prioritize young children''s care and development. It partners with individual communities to assess what early-childhood support already exists, name the gaps, and work toward filling them, and runs specialist sub-networks — among them a Dental Network for uninsured and publicly insured children aged 0–5, and a Mental Health Network.

A replicable rural model from the Radically Rural models library (Childcare). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://wcif.org/regional-development/early-childhood/',
   'Childcare · Radically Rural models library',
   array['radically-rural', 'childcare', 'mn']::text[],
   310),
  ('Parkview Pointe Senior Center',
   'This senior center practices intergenerational care with a childcare center on the premises.',
   '**Laverne, OK**

This senior center practices intergenerational care with a childcare center on the premises.

**How it works** — An assisted-living facility on eight acres that opened Parkview Pals Early Learning Collaboration in its east wing in 2023, licensed for children from six weeks up. Residents and children share the site daily rather than meeting at scheduled visits. It is one of three intergenerational assisted-living facilities in Oklahoma and the only one partnered with Big Five Head Start.

A replicable rural model from the Radically Rural models library (Childcare). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://parkviewpointeseniorliving.com/',
   'Childcare · Radically Rural models library',
   array['radically-rural', 'childcare', 'ok']::text[],
   320),
  ('Shickley Public Schools',
   'This small town prioritized childcare by serving children from “diapers to diplomas” in their public schools.',
   '**Shickley, NE**

This small town prioritized childcare by serving children from “diapers to diplomas” in their public schools.

**How it works** — The district treats childcare as part of public education — "diapers to diplomas." An off-campus Early Learning Facility, started in 2013, serves infants and toddlers, and preschoolers have since moved into the main school building. The daycare now drives enrollment: close to half the incoming kindergarten class arrives through option enrollment.

A replicable rural model from the Radically Rural models library (Childcare). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.youtube.com/watch?v=pDUVPX8xsKI',
   'Childcare · Radically Rural models library',
   array['radically-rural', 'childcare', 'ne']::text[],
   330),
  ('Rural Child Care Innovation Program',
   'This local development authority has developed a pod model for multiple childcare providers to offer their services.',
   '**New Ulm, MN**

This local development authority has developed a pod model for multiple childcare providers to offer their services.

**How it works** — First Children''s Finance runs RCCIP as rural economic development rather than as a childcare program: a structured community engagement process that stands up a local Core Team, makes the case locally that childcare supply and a viable economy are the same problem, and designs right-sized solutions. One is the family childcare pod — several providers co-located, often in a vacant building donated or rented cheaply, which cuts each provider''s costs and makes the businesses steadier.

A replicable rural model from the Radically Rural models library (Childcare). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.firstchildrensfinance.org/for-communities/rural-child-care-innovation-program/',
   'Childcare · Radically Rural models library',
   array['radically-rural', 'childcare', 'mn']::text[],
   340),
  ('Friends Center for Children',
   'This organization provides housing to childcare providers and teachers to reduce their expenses.',
   '**New Haven, CT**

This organization provides housing to childcare providers and teachers to reduce their expenses.

**How it works** — Free housing offered as a salaried benefit to teachers. Removing their largest monthly expense raises real compensation without raising tuition, and it lowers the center''s operating costs enough to lift every teacher''s salary — in 2024, $18,000 above the Connecticut average for early educators. Launched in 2019; ten teachers housed with more moving in, several of the houses designed and built with the Yale School of Architecture.

A replicable rural model from the Radically Rural models library (Childcare). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://friendscenterforchildren.org/',
   'Childcare · Radically Rural models library',
   array['radically-rural', 'childcare', 'ct']::text[],
   350),
  ('New Britain YWCA',
   'This YWCA opened a Childcare Incubator Project to train new childcare providers and support them through enrollment.',
   '**New Britain, CT**

This YWCA opened a Childcare Incubator Project to train new childcare providers and support them through enrollment.

**How it works** — A childcare business incubator — a hybrid of a center and a home daycare — that trains aspiring providers and then houses their businesses for a few years before they move to their own location. Four months of training in business and financial literacy, childcare practice and state licensing, after which four participants enter the incubator proper. First of its kind in Connecticut, and its operators believe the only one of its kind in the country.

A replicable rural model from the Radically Rural models library (Childcare). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://ctmirror.org/2024/11/26/ct-child-care-incubator-new-britain/',
   'Childcare · Radically Rural models library',
   array['radically-rural', 'childcare', 'ct']::text[],
   360),
  ('Amateur Ration Toolkit',
   'This toolkit helps journalists partner with ham radio operators in the aftermath of natural disasters.',
   '**Puerto Rico, USA**

This toolkit helps journalists partner with ham radio operators in the aftermath of natural disasters.

**How it works** — A toolkit for pairing newsrooms with licensed amateur-radio operators, written out of Hurricane María — when Puerto Rico lost 98% of its communications and ham operators carried health-and-welfare traffic on HF and Winlink while every other channel was down. Journalists and hams show up the same way after a disaster, and neither is a recognized first responder; the toolkit turns that informal overlap into a working arrangement made before the next storm.

A replicable rural model from the Radically Rural models library (Community Journalism). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://docs.google.com/document/d/152Tf1PvUgStJlfVN6jZGCnO1TBuiOsLUYBJvsAUnPQ0/edit?usp=sharing',
   'Community Journalism · Radically Rural models library',
   array['radically-rural', 'community-journalism', 'puerto-rico']::text[],
   410),
  ('Local News Go Bag',
   'This project shares information, tools, resources, and more for journalists covering disasters in their communities.',
   '**Mendocino, CA**

This project shares information, tools, resources, and more for journalists covering disasters in their communities.

**How it works** — A virtual "go bag" for newsrooms covering emergencies, built by Kate Maxwell, founder and former publisher of The Mendocino Voice, after covering the deadliest fire in Mendocino County history and the storms and droughts that followed. Copyable Google Docs and Sheets templates — equipment checklist, emergency source list and map, grant tracker, reporting and operations plan — plus tabletop and "hot wash" exercises for before, during and after. Aimed explicitly at news deserts and rural newsrooms.

A replicable rural model from the Radically Rural models library (Community Journalism). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://newsgobag.com/',
   'Community Journalism · Radically Rural models library',
   array['radically-rural', 'community-journalism', 'ca']::text[],
   420),
  ('Voter411',
   'This website provides nonpartisan information about candidates for local office across the county.',
   '**Pitt County, NC**

This website provides nonpartisan information about candidates for local office across the county.

**How it works** — A nonpartisan site carrying every local candidate in the county — municipal, county, state legislative and judicial — with opposing candidates'' positions set side by side. Founded in 2020 with support from the East Carolina University School of Communication and maintained by journalism professor Cindy Elmore; organizers reach out to every candidate on the ballot, not only the ones who respond.

A replicable rural model from the Radically Rural models library (Community Journalism). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.voter411enc.org/',
   'Community Journalism · Radically Rural models library',
   array['radically-rural', 'community-journalism', 'nc']::text[],
   430),
  ('World Central Kitchen',
   'This organization provides meals to both rural and urban communities after natural disasters.',
   '**International**

This organization provides meals to both rural and urban communities after natural disasters.

**How it works** — A chef relief team that starts cooking immediately rather than shipping rations in, building a network of local restaurants, food trucks and emergency kitchens and buying from local vendors, so relief money stays in the affected economy. Meals are fresh and drawn from nearby cuisine — comfort and cultural connection, not just calories. Founded in 2010 by chef José Andrés; more than 350 million meals served.

A replicable rural model from the Radically Rural models library (Disaster Planning & Broadband). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://wck.org/',
   'Disaster Planning & Broadband · Radically Rural models library',
   array['radically-rural', 'disaster-planning-broadband', 'international']::text[],
   510),
  ('Grundy County Community Foundation',
   'This foundation implemented Community Organizations Active in Disaster (COAD) after experiencing six disasters in nine years.',
   '**Grundy County, IL**

This foundation implemented Community Organizations Active in Disaster (COAD) after experiencing six disasters in nine years.

**How it works** — After three natural disasters in two years, the foundation helped stand up a county COAD: a standing coalition of public, private and nonprofit agencies, co-led with the United Way, the county Emergency Management Agency and a local church''s emergency response team. Organizing before the disaster means the group can rally volunteers, funding and supplies on day one — meals for families and first responders, groceries and cleaning supplies, a staffed reception center, mental health providers, and mini-grants. The foundation also houses the county''s standing Disaster Fund.

A replicable rural model from the Radically Rural models library (Disaster Planning & Broadband). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.youtube.com/watch?v=AVS-m4-tphI',
   'Disaster Planning & Broadband · Radically Rural models library',
   array['radically-rural', 'disaster-planning-broadband', 'il']::text[],
   520),
  ('Mobile Beacon',
   'This 4G/5G Internet service delivers maximum value to nonprofits with a powerful combination of accessibility and affordability.',
   '**National, USA**

This 4G/5G Internet service delivers maximum value to nonprofits with a powerful combination of accessibility and affordability.

**How it works** — Unlimited mobile broadband on the T-Mobile network for $10 a month, available to nonprofits, schools, libraries and healthcare organizations nationwide, with no data caps or throttling. Qualifying organizations can get up to eleven hotspots and a set of SIM cards per fiscal year, donated or discounted, distributed through TechSoup. For a rural organization it is a way to put connectivity where the wired network does not reach.

A replicable rural model from the Radically Rural models library (Disaster Planning & Broadband). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.mobilebeacon.org/services-devices/services/',
   'Disaster Planning & Broadband · Radically Rural models library',
   array['radically-rural', 'disaster-planning-broadband', 'national']::text[],
   530),
  ('NH Solar Shares',
   'NH Solar Shares builds community funded arrays that provide energy for low income families.',
   '**Plymouth, NH**

NH Solar Shares builds community funded arrays that provide energy for low income families.

**How it works** — Community-funded solar arrays whose output is credited to low-income families'' electric bills — 85% of each array''s production goes to a set number of households, worth roughly $25 a month to about thirty families. Families are referred through social service organizations that have already verified income, and they join a basic energy education program alongside the credit. Created in 2017 by the Plymouth Area Renewable Energy Initiative with the NH Electric Cooperative; arrays in Plymouth, Warren and Center Harbor now total 91.3 kW.

A replicable rural model from the Radically Rural models library (Energy). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://nhsolarshares.org/',
   'Energy · Radically Rural models library',
   array['radically-rural', 'energy', 'nh']::text[],
   610),
  ('Jack’s Solar Garden',
   'This research site aims to make agrovoltaics more accessible and educate farmers, developers, and community members.',
   '**Longmont, CO**

This research site aims to make agrovoltaics more accessible and educate farmers, developers, and community members.

**How it works** — A 1.2 MW community solar garden — more than 3,200 panels — that doubles as the first commercial-scale agrivoltaics site in the Americas, with crops, pollinator habitat and grazing pasture studied under and between the rows. Research partners include the National Renewable Energy Lab, Colorado State and the University of Arizona. Byron Kominek founded it in 2020 on his grandfather''s hay and wheat farm, and it now hosts the Colorado Agrivoltaic Learning Center for public education.

A replicable rural model from the Radically Rural models library (Energy). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://dailyyonder.com/agrovoltaics-offer-dual-use-on-land-used-for-solar-energy-development/2023/07/19/',
   'Energy · Radically Rural models library',
   array['radically-rural', 'energy', 'co']::text[],
   620),
  ('Zero Foodprint',
   'Members crowd-fund grants for farmers to switch to regenerative farming practices.',
   '**National, USA**

Members crowd-fund grants for farmers to switch to regenerative farming practices.

**How it works** — Members — restaurants and other food businesses — commit an ongoing contribution, typically 1% of sales or an opt-out surcharge on the bill, and the pooled money becomes grants to nearby farmers for regenerative practices like composting and cover cropping. It turns a collective of small, routine contributions into farm transition funding that does not depend on the tax base.

A replicable rural model from the Radically Rural models library (Energy). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.zerofoodprint.org/',
   'Energy · Radically Rural models library',
   array['radically-rural', 'energy', 'national']::text[],
   630),
  ('Wyoming County Business Center',
   'This center houses local government offices, farmer resources, and entrepreneur support all in one place.',
   '**Warsaw, NY**

This center houses local government offices, farmer resources, and entrepreneur support all in one place.

**How it works** — A vacant textile mill on Center Street in Warsaw, rebuilt as the Wyoming County Agriculture & Business Center and now housing thirteen agencies — the Business Center itself alongside the county IDA, the Planning Department, the Chamber, and agricultural services. Co-locating them makes one door for a farmer or a would-be business owner instead of several. Programs run out of it include Business Fast Track and the Business Accelerator Academy.

A replicable rural model from the Radically Rural models library (Entrepreneurship). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://wycoida.org/',
   'Entrepreneurship · Radically Rural models library',
   array['radically-rural', 'entrepreneurship', 'ny']::text[],
   710),
  ('Tionesta Market Village',
   'This town turned an empty lot into a market village with sheds.',
   '**Tionesta, PA**

This town turned an empty lot into a market village with sheds.

**How it works** — A lot left vacant for ten years after a downtown fire, in a town of 500 no developer wanted. The Industrial Development Corporation bought it and built a micro-retail incubator: standard outdoor garden sheds fitted with 1800s-style false fronts, unheated and therefore seasonal, leased by the year. Start-up cost to a tenant is about $500 and rent $50–70 a month plus electric, so someone can test a business idea without a loan. Total build cost was around $40,000; it opened in 2013 and eleven sheds are still trading.

A replicable rural model from the Radically Rural models library (Entrepreneurship). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://saveyour.town/turn-an-empty-lot-into-a-market-village-with-sheds/',
   'Entrepreneurship · Radically Rural models library',
   array['radically-rural', 'entrepreneurship', 'pa']::text[],
   720),
  ('Northeast Transition Initiative',
   'This organization helps business owners successfully plan their exit strategy with an emphasis on employee ownership.',
   '**Northeast, USA**

This organization helps business owners successfully plan their exit strategy with an emphasis on employee ownership.

**How it works** — A partnership of lenders and development organizations across New England and New York helping retiring owners plan an exit, with a bias toward selling to their employees. The problem it is built for: more than 200,000 small businesses in the region have owners looking to retire within a few years, and only about 17% have a succession plan. NETI runs a nine-month fellowship that trains people at existing business-support organizations to give that advice locally.

A replicable rural model from the Radically Rural models library (Entrepreneurship). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://ownershiptransition.org/',
   'Entrepreneurship · Radically Rural models library',
   array['radically-rural', 'entrepreneurship', 'northeast']::text[],
   730),
  ('Traverse City Repair Cafe',
   'This donation-based community event pairs attendees with skilled volunteers to help repair household items.',
   '**Traverse City, MI**

This donation-based community event pairs attendees with skilled volunteers to help repair household items.

**How it works** — A free monthly event, run by the Green Door Folk School with the Traverse Area District Library, where neighbors bring broken household things — lamps, toasters, clothes, bicycles, furniture, toys — and are matched with a volunteer who walks them through the repair rather than doing it for them. More than seventeen volunteers; donation-based. The format began in the Netherlands in 2009 and is widely copied, which is part of its appeal: the pattern is public.

A replicable rural model from the Radically Rural models library (Entrepreneurship). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://greendoorfolkschool.com/repair-cafe/',
   'Entrepreneurship · Radically Rural models library',
   array['radically-rural', 'entrepreneurship', 'mi']::text[],
   740),
  ('Ice House Entrepreneurship Program',
   'This program is designed to inspire and engage participants in the fundamental aspects of an entrepreneurial mindset.',
   '**National, USA**

This program is designed to inspire and engage participants in the fundamental aspects of an entrepreneurial mindset.

**How it works** — A flexible curriculum built on eight concepts from the book "Who Owns the Ice House?", each lesson carrying video case studies of "unlikely" entrepreneurs rather than famous founders. It teaches the mindset — problem solving, communication, acting under uncertainty — rather than business-plan mechanics, which is why it drops into high schools, colleges, youth programs and workforce development alike.

A replicable rural model from the Radically Rural models library (Entrepreneurship). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://elimindset.com/entrepreneurship-programs/ice-house-entrepreneurship-program/',
   'Entrepreneurship · Radically Rural models library',
   array['radically-rural', 'entrepreneurship', 'national']::text[],
   750),
  ('Online Farmers Market',
   'This online farmers market allows customers to pre-order locally grown goods and prevent food waste and loss of product for farmers.',
   '**Plymouth, NH**

This online farmers market allows customers to pre-order locally grown goods and prevent food waste and loss of product for farmers.

**How it works** — Ordering opens Saturday noon and closes Wednesday morning; orders are packed and picked up Thursday afternoon at a single location in Plymouth, with limited local delivery and after-hours self-service pickup. Because farmers know the order before they harvest, product does not go to waste and the market does not depend on a crowd showing up in good weather. Vegetables, fruit, dairy, maple, meat, baked goods, prepared food and crafts; SNAP/EBT accepted; serving Plymouth and the towns around it.

A replicable rural model from the Radically Rural models library (Entrepreneurship). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://localfoodsplymouth.org/',
   'Entrepreneurship · Radically Rural models library',
   array['radically-rural', 'entrepreneurship', 'nh']::text[],
   760),
  ('Build UP',
   'This program provides students with an opportunity to develop construction skills by renovating houses that they then have the opportunity to buy.',
   '**Birmingham, AL**

This program provides students with an opportunity to develop construction skills by renovating houses that they then have the opportunity to buy.

**How it works** — A six-year program students enter in ninth grade, leaving with a high school diploma, an associate''s degree and construction trade certifications. They split days between classroom and job site, drawing a paycheck as apprentices while renovating donated houses relocated into their own underinvested neighborhood. Graduates who finish receive the keys to a house they helped renovate, on a zero-interest mortgage — the labor becomes the down payment.

A replicable rural model from the Radically Rural models library (Housing). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.fastcompany.com/90614080/this-school-teaches-low-income-students-to-renovate-houses-and-helps-them-become-homeowners',
   'Housing · Radically Rural models library',
   array['radically-rural', 'housing', 'al']::text[],
   810),
  ('Windham Regional Commission',
   'This organization led a multi-town solution to adapt a public building into mulit-unit housing.',
   '**Windham County, VT**

This organization led a multi-town solution to adapt a public building into mulit-unit housing.

**How it works** — Four towns — Jamaica, Londonderry, Weston and Winhall — too small to solve housing alone, pooled into a 4-Town Housing Collaborative with the regional commission, UMass and the AIA''s Communities by Design program. A shared needs assessment put the region''s gap at roughly 850 units by 2040, and one concrete proposal adapts the closing Jamaica Village School into senior apartments, townhouses and mixed-size units. The model is the collaboration: a public building and a housing shortage treated at regional rather than town scale.

A replicable rural model from the Radically Rural models library (Housing). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.commonsnews.org/issue/784/784housing_mtg',
   'Housing · Radically Rural models library',
   array['radically-rural', 'housing', 'vt']::text[],
   820),
  ('The Bird’s Nest',
   'This tiny home community for women provides affordable housing and social connectivity.',
   '**Cumby, TX**

This tiny home community for women provides affordable housing and social connectivity.

**How it works** — A gated tiny-home and RV village on 5.5 acres about an hour from Dallas, founded in 2022 by Robyn Yerian, who drew on her 401(k) to buy the land for $35,000 and put in roughly $150,000 for road, concrete pads, and electric and septic hookups. Lots rent long-term at $450 a month including water and shared amenities, a price she has committed to holding. Eleven women in their sixties and seventies live there now, with a long waiting list — the point being to grow old independently but not alone.

A replicable rural model from the Radically Rural models library (Housing). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.realtor.com/news/first-person/all-women-tiny-home-village-texas/',
   'Housing · Radically Rural models library',
   array['radically-rural', 'housing', 'tx']::text[],
   830),
  ('Benevolence Farm',
   'This farm residential program cultivates leadership and promotes sustainable livelihoods for individuals impacted by the criminal legal system.',
   '**Alamance County, NC**

This farm residential program cultivates leadership and promotes sustainable livelihoods for individuals impacted by the criminal legal system.

**How it works** — A residential reentry program where women leaving prison live and work on the farm, growing food and making body care products and candles from what they grow — housing, paid employment, life skills and career development in one place, with the produce going out to the community. First resident arrived in December 2016; seven tiny homes on a 13-acre property in Graham are set to roughly double housing capacity, against a waiting list the program has carried for years.

A replicable rural model from the Radically Rural models library (Land & Community). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://benevolencefarm.org/',
   'Land & Community · Radically Rural models library',
   array['radically-rural', 'land-community', 'nc']::text[],
   910),
  ('Pemi-Baker Land Trust',
   'This trust works with property owners to place conservation easements on land in perpetuity.',
   '**Plymouth, NH**

This trust works with property owners to place conservation easements on land in perpetuity.

**How it works** — Conserves land in the Baker and upper Pemigewasset river watersheds, working with owners to place easements in perpetuity — 921 acres across towns including Campton and Dorchester, from its first easement in 2005 to its most recent in 2025. It is the land protection arm of Rumney Ecological Systems, which also owns and manages the Quincy Bog Natural Area and its nature center, so protected land comes with a public door onto it.

A replicable rural model from the Radically Rural models library (Land & Community). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://quincybog.org/',
   'Land & Community · Radically Rural models library',
   array['radically-rural', 'land-community', 'nh']::text[],
   920),
  ('Autism Nature Trail',
   'Letchworth State Park features an accessible Autism Nature Trail for inclusive outdoor recreation.',
   '**Perry, NY**

Letchworth State Park features an accessible Autism Nature Trail for inclusive outdoor recreation.

**How it works** — A one-mile ADA-compliant loop in Letchworth State Park with eight sensory stations, the first nature trail in the country designed specifically around the sensory needs of people with autism and other developmental disabilities. Stations engage auditory, visual, tactile, vestibular and proprioceptive processing, and the design includes "alone zones" and an orienting trailhead pavilion. Opened in 2021, built by a partnership of the Natural Heritage Trust, Camp Puzzle Peace, the park and the Perry Central School District, with input from Temple Grandin.

A replicable rural model from the Radically Rural models library (Land & Community). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://autismnaturetrail.com/',
   'Land & Community · Radically Rural models library',
   array['radically-rural', 'land-community', 'ny']::text[],
   930),
  ('eBird',
   'This platform allows users to populate birding data which then contributes to our understanding of climate change.',
   '**Ithaca, NY**

This platform allows users to populate birding data which then contributes to our understanding of climate change.

**How it works** — Birders record when, where and how they went birding and submit a checklist of everything seen and heard. The simple, consistent framework is what makes the data scientific: more than a billion observations, free to researchers, now the largest biodiversity occurrence database in the world. Started in 2002 by the Cornell Lab of Ornithology with the National Audubon Society; the records are used to track distribution, abundance and shifts in migration timing under climate change.

A replicable rural model from the Radically Rural models library (Land & Community). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://ebird.org/',
   'Land & Community · Radically Rural models library',
   array['radically-rural', 'land-community', 'ny']::text[],
   940),
  ('Preservation Trust Vermont',
   'This organization focuses on historic preservation including building easements, advocacy work, and more.',
   '**VT, USA**

This organization focuses on historic preservation including building easements, advocacy work, and more.

**How it works** — A statewide nonprofit, founded in 1980, that works through local partners rather than from the capital, with a particular focus on downtowns and village centers and on keeping a mix of commercial, cultural, civic, sacred and gathering uses alive in them. It stewards preservation easements on more than 90 buildings, and backs communities with a Field Services program, grants for conditions assessments and restoration, and advocacy.

A replicable rural model from the Radically Rural models library (Land & Community). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://ptvermont.org/',
   'Land & Community · Radically Rural models library',
   array['radically-rural', 'land-community', 'vt']::text[],
   950),
  ('PA Wilds',
   'This voluntary planning document that highlights how communities in the region can protect and enhance their community’s character.',
   '**PA, USA**

This voluntary planning document that highlights how communities in the region can protect and enhance their community’s character.

**How it works** — A voluntary design guide, not a regulation — now in its second edition — showing how communities across the Pennsylvania Wilds can protect or strengthen their character as they grow, whether the growth comes from tourism, resource extraction or other development. Developed by the PA Wilds Planning Team with county planners, it is heavily visual and built around local examples of the practices in action, and it is free to download.

A replicable rural model from the Radically Rural models library (Land & Community). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.pawildscenter.org/programs-and-services/community-character-stewardship/',
   'Land & Community · Radically Rural models library',
   array['radically-rural', 'land-community', 'pa']::text[],
   960),
  ('Perry Main Street Association',
   'This group puts on an annual chalk art festival which brings together artists, farmers, Main Street businesses, and community members.',
   '**Perry, NY**

This group puts on an annual chalk art festival which brings together artists, farmers, Main Street businesses, and community members.

**How it works** — An annual chalk art festival on Main Street that deliberately stacks the town''s other assets on the same day: over 100 chalk artists, live music, regional food, a mini chalk area for children, and the Perry Farmers'' Market and Public Market running extended alongside it. Twentieth year in 2026, organized by a 501(c)(3) and funded by local government, businesses, individuals and the Chamber — the model is one event doing the work of several.

A replicable rural model from the Radically Rural models library (Main Street). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://iloveperryny.com/perrychalkartfestival/',
   'Main Street · Radically Rural models library',
   array['radically-rural', 'main-street', 'ny']::text[],
   1010),
  ('218 Relocate',
   'This town has incentives like free coworking space and moving stipends for attracting remote workers.',
   '**Bemidji, MN**

This town has incentives like free coworking space and moving stipends for attracting remote workers.

**How it works** — An incentive package for remote workers who move to the Bemidji area while working for an employer headquartered elsewhere: up to $2,500 toward relocation, a year''s membership at the LaunchPad coworking space downtown (about $1,500 in value), six months of gigabit internet, a Chamber membership, and a Community Concierge who connects the household to the town. The concierge is the part worth copying — the stipend gets someone to move, the introductions keep them.

A replicable rural model from the Radically Rural models library (Main Street). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://dailyyonder.com/rural-communities-across-the-u-s-are-attracting-remote-workers-through-different-incentive-programs/2021/10/19/',
   'Main Street · Radically Rural models library',
   array['radically-rural', 'main-street', 'mn']::text[],
   1020),
  ('Coburns’ General Store',
   'This business is exploring a nonprofit trust model as the owners transition into retirement.',
   '**Strafford, VT**

This business is exploring a nonprofit trust model as the owners transition into retirement.

**How it works** — When Melvin Coburn approached retirement after nearly 48 years, the Strafford Community Trust — a nonprofit of Strafford and Upper Valley residents — raised $1.8 million from more than 125 families to buy the store. The trust owns the building and leases it to an operator, which locks in what the town was afraid of losing: it has to stay a locally run store, and cannot become apartments or a chain. Ownership transferred in June 2025.

A replicable rural model from the Radically Rural models library (Main Street). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.nytimes.com/2024/11/29/us/vermont-general-store-noah-kahan.html?unlocked_article_code=1.gE4.v6Y1.P-bCy5Nz0nr6',
   'Main Street · Radically Rural models library',
   array['radically-rural', 'main-street', 'vt']::text[],
   1030),
  ('The Circle Program',
   'This summer camp and mentorship program connects girls and young women with mentors and initiatives in the community.',
   '**Plymouth, NH**

This summer camp and mentorship program connects girls and young women with mentors and initiatives in the community.

**How it works** — Combines a residential summer camp with one-to-one, year-round mentoring and school-year programming for girls facing financial and social disadvantage, across three age bands from 9 to 18 — all of it tuition free. Founded in 1993 by the trustees and camp director of Camp Onaway, on the reasoning that a few weeks of camp alone would not hold; the mentoring is what carries between summers. One of very few programs anywhere pairing camp with mentoring for rural girls.

A replicable rural model from the Radically Rural models library (Youth Retention). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.circleprogram.org/',
   'Youth Retention · Radically Rural models library',
   array['radically-rural', 'youth-retention', 'nh']::text[],
   1110),
  ('Lead for America',
   'This organization places fellows with service opportunities in their hometowns across the country.',
   '**National, USA**

This organization places fellows with service opportunities in their hometowns across the country.

**How it works** — Places fellows in paid, full-time, year-long service roles alongside a local leader in their own hometown or home state — the premise being that the people most likely to stay are the ones who already belong there. Its signature AmeriCorps program is now the American Connection Corps, the largest fellowship focused on bridging the digital divide, placing members with local organizations on broadband access, digital navigation and related local priorities.

A replicable rural model from the Radically Rural models library (Youth Retention). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.leadforamerica.org/',
   'Youth Retention · Radically Rural models library',
   array['radically-rural', 'youth-retention', 'national']::text[],
   1120),
  ('Farms Work Wonders',
   'This program supports Appalachian youth through paid job trainings and mentorship at their five local businesses.',
   '**Wardensville, WV**

This program supports Appalachian youth through paid job trainings and mentorship at their five local businesses.

**How it works** — A paid six-week challenge program for up to fifteen young people aged 16–21 builds workforce and social skills, after which participants are offered junior crew positions and a six-month immersion in the organization''s own businesses — the Wardensville Garden Market, Lewis Farm, Mack''s Bingo Kitchen and Bakery, and Dakota Glass Works. The enterprises are the classroom and the employer at once, and proceeds are reinvested. In a town of 270, it pays out over $3 million in wages a year and has created more than 100 jobs, most held by local high schoolers.

A replicable rural model from the Radically Rural models library (Youth Retention). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://farmsworkwonders.org/',
   'Youth Retention · Radically Rural models library',
   array['radically-rural', 'youth-retention', 'wv']::text[],
   1130)
) as v(title, summary, body, url, attribution, tags, sort_order);
