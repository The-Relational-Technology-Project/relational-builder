-- Seed the Radically Rural shelf (Oct 2 2026). 42 models from the Radically
-- Rural models library at radicallyrural.org/models — the network's running
-- answer to "what is working in rural", across eleven categories:
-- accessibility, health, childcare, community journalism, disaster planning
-- and broadband, energy, entrepreneurship, housing, land and community,
-- main street, and youth retention.
--
-- Each row is an `example`: a pattern a builder in the studio can read and
-- remix into a tool for their own town, with `url` pointing back at the
-- organization or the story so credit and the real detail stay one click
-- away. Content is Radically Rural's, lightly reshaped into shelf fields.
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

A replicable rural model from the Radically Rural models library (Accessibility & Inclusivity). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.neighborhoodaccess.org/',
   'Accessibility & Inclusivity · Radically Rural models library',
   array['radically-rural', 'accessibility-inclusivity', 'nh']::text[],
   110),
  ('Mohawk Cultural Center',
   'This mobile learning center visits schools, community centers, and events to deliver Mohawk culture to Akwesasne.',
   '**Paul Smiths, NY**

This mobile learning center visits schools, community centers, and events to deliver Mohawk culture to Akwesasne.

A replicable rural model from the Radically Rural models library (Accessibility & Inclusivity). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.northcountrypublicradio.org/news/story/48749/20231107/learning-lab-on-wheels-delivers-mohawk-culture-to-akwesasne',
   'Accessibility & Inclusivity · Radically Rural models library',
   array['radically-rural', 'accessibility-inclusivity', 'ny']::text[],
   120),
  ('Forsyth Chamber of Commerce',
   'This Chamber of Commerce hosts newcomers events to make new residents feel welcome and engaged in local politics and community.',
   '**Forsyth, MT**

This Chamber of Commerce hosts newcomers events to make new residents feel welcome and engaged in local politics and community.

A replicable rural model from the Radically Rural models library (Accessibility & Inclusivity). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://saveyour.town/newcomer-get-togethers-help-small-towns-thrive/',
   'Accessibility & Inclusivity · Radically Rural models library',
   array['radically-rural', 'accessibility-inclusivity', 'mt']::text[],
   130),
  ('Stable Recovery',
   'This program provides horse industry training to those recovering from addiction.',
   '**Lexington, KY**

This program provides horse industry training to those recovering from addiction.

A replicable rural model from the Radically Rural models library (All in for Health). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://dailyyonder.com/jobs-program-stable-recovery-trains-people-in-recovery-to-work-in-kentuckys-horse-industry/2023/05/03/',
   'All in for Health · Radically Rural models library',
   array['radically-rural', 'all-in-for-health', 'ky']::text[],
   210),
  ('Walking School Buses',
   'Groups of parents organize and supervise group walks to school to encourage active transportation over driving.',
   '**Washington D.C.**

Groups of parents organize and supervise group walks to school to encourage active transportation over driving.

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

A replicable rural model from the Radically Rural models library (Childcare). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://wcif.org/regional-development/early-childhood/',
   'Childcare · Radically Rural models library',
   array['radically-rural', 'childcare', 'mn']::text[],
   310),
  ('Parkview Pointe Senior Center',
   'This senior center practices intergenerational care with a childcare center on the premises.',
   '**Laverne, OK**

This senior center practices intergenerational care with a childcare center on the premises.

A replicable rural model from the Radically Rural models library (Childcare). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://parkviewpointeseniorliving.com/',
   'Childcare · Radically Rural models library',
   array['radically-rural', 'childcare', 'ok']::text[],
   320),
  ('Shickley Public Schools',
   'This small town prioritized childcare by serving children from “diapers to diplomas” in their public schools.',
   '**Shickley, NE**

This small town prioritized childcare by serving children from “diapers to diplomas” in their public schools.

A replicable rural model from the Radically Rural models library (Childcare). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.youtube.com/watch?v=pDUVPX8xsKI',
   'Childcare · Radically Rural models library',
   array['radically-rural', 'childcare', 'ne']::text[],
   330),
  ('Rural Child Care Innovation Program',
   'This local development authority has developed a pod model for multiple childcare providers to offer their services.',
   '**New Ulm, MN**

This local development authority has developed a pod model for multiple childcare providers to offer their services.

A replicable rural model from the Radically Rural models library (Childcare). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.firstchildrensfinance.org/for-communities/rural-child-care-innovation-program/',
   'Childcare · Radically Rural models library',
   array['radically-rural', 'childcare', 'mn']::text[],
   340),
  ('Friends Center for Children',
   'This organization provides housing to childcare providers and teachers to reduce their expenses.',
   '**New Haven, CT**

This organization provides housing to childcare providers and teachers to reduce their expenses.

A replicable rural model from the Radically Rural models library (Childcare). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://friendscenterforchildren.org/',
   'Childcare · Radically Rural models library',
   array['radically-rural', 'childcare', 'ct']::text[],
   350),
  ('New Britain YWCA',
   'This YWCA opened a Childcare Incubator Project to train new childcare providers and support them through enrollment.',
   '**New Britain, CT**

This YWCA opened a Childcare Incubator Project to train new childcare providers and support them through enrollment.

A replicable rural model from the Radically Rural models library (Childcare). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://ctmirror.org/2024/11/26/ct-child-care-incubator-new-britain/',
   'Childcare · Radically Rural models library',
   array['radically-rural', 'childcare', 'ct']::text[],
   360),
  ('Amateur Ration Toolkit',
   'This toolkit helps journalists partner with ham radio operators in the aftermath of natural disasters.',
   '**Puerto Rico, USA**

This toolkit helps journalists partner with ham radio operators in the aftermath of natural disasters.

A replicable rural model from the Radically Rural models library (Community Journalism). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://docs.google.com/document/d/152Tf1PvUgStJlfVN6jZGCnO1TBuiOsLUYBJvsAUnPQ0/edit?usp=sharing',
   'Community Journalism · Radically Rural models library',
   array['radically-rural', 'community-journalism', 'puerto-rico']::text[],
   410),
  ('Local News Go Bag',
   'This project shares information, tools, resources, and more for journalists covering disasters in their communities.',
   '**Mendocino, CA**

This project shares information, tools, resources, and more for journalists covering disasters in their communities.

A replicable rural model from the Radically Rural models library (Community Journalism). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://newsgobag.com/',
   'Community Journalism · Radically Rural models library',
   array['radically-rural', 'community-journalism', 'ca']::text[],
   420),
  ('Voter411',
   'This website provides nonpartisan information about candidates for local office across the county.',
   '**Pitt County, NC**

This website provides nonpartisan information about candidates for local office across the county.

A replicable rural model from the Radically Rural models library (Community Journalism). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.voter411enc.org/',
   'Community Journalism · Radically Rural models library',
   array['radically-rural', 'community-journalism', 'nc']::text[],
   430),
  ('World Central Kitchen',
   'This organization provides meals to both rural and urban communities after natural disasters.',
   '**International**

This organization provides meals to both rural and urban communities after natural disasters.

A replicable rural model from the Radically Rural models library (Disaster Planning & Broadband). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://wck.org/',
   'Disaster Planning & Broadband · Radically Rural models library',
   array['radically-rural', 'disaster-planning-broadband', 'international']::text[],
   510),
  ('Grundy County Community Foundation',
   'This foundation implemented Community Organizations Active in Disaster (COAD) after experiencing six disasters in nine years.',
   '**Grundy County, IL**

This foundation implemented Community Organizations Active in Disaster (COAD) after experiencing six disasters in nine years.

A replicable rural model from the Radically Rural models library (Disaster Planning & Broadband). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.youtube.com/watch?v=AVS-m4-tphI',
   'Disaster Planning & Broadband · Radically Rural models library',
   array['radically-rural', 'disaster-planning-broadband', 'il']::text[],
   520),
  ('Mobile Beacon',
   'This 4G/5G Internet service delivers maximum value to nonprofits with a powerful combination of accessibility and affordability.',
   '**National, USA**

This 4G/5G Internet service delivers maximum value to nonprofits with a powerful combination of accessibility and affordability.

A replicable rural model from the Radically Rural models library (Disaster Planning & Broadband). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.mobilebeacon.org/services-devices/services/',
   'Disaster Planning & Broadband · Radically Rural models library',
   array['radically-rural', 'disaster-planning-broadband', 'national']::text[],
   530),
  ('NH Solar Shares',
   'NH Solar Shares builds community funded arrays that provide energy for low income families.',
   '**Plymouth, NH**

NH Solar Shares builds community funded arrays that provide energy for low income families.

A replicable rural model from the Radically Rural models library (Energy). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://nhsolarshares.org/',
   'Energy · Radically Rural models library',
   array['radically-rural', 'energy', 'nh']::text[],
   610),
  ('Jack’s Solar Garden',
   'This research site aims to make agrovoltaics more accessible and educate farmers, developers, and community members.',
   '**Longmont, CO**

This research site aims to make agrovoltaics more accessible and educate farmers, developers, and community members.

A replicable rural model from the Radically Rural models library (Energy). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://dailyyonder.com/agrovoltaics-offer-dual-use-on-land-used-for-solar-energy-development/2023/07/19/',
   'Energy · Radically Rural models library',
   array['radically-rural', 'energy', 'co']::text[],
   620),
  ('Zero Foodprint',
   'Members crowd-fund grants for farmers to switch to regenerative farming practices.',
   '**National, USA**

Members crowd-fund grants for farmers to switch to regenerative farming practices.

A replicable rural model from the Radically Rural models library (Energy). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.zerofoodprint.org/',
   'Energy · Radically Rural models library',
   array['radically-rural', 'energy', 'national']::text[],
   630),
  ('Wyoming County Business Center',
   'This center houses local government offices, farmer resources, and entrepreneur support all in one place.',
   '**Warsaw, NY**

This center houses local government offices, farmer resources, and entrepreneur support all in one place.

A replicable rural model from the Radically Rural models library (Entrepreneurship). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://wycoida.org/',
   'Entrepreneurship · Radically Rural models library',
   array['radically-rural', 'entrepreneurship', 'ny']::text[],
   710),
  ('Tionesta Market Village',
   'This town turned an empty lot into a market village with sheds.',
   '**Tionesta, PA**

This town turned an empty lot into a market village with sheds.

A replicable rural model from the Radically Rural models library (Entrepreneurship). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://saveyour.town/turn-an-empty-lot-into-a-market-village-with-sheds/',
   'Entrepreneurship · Radically Rural models library',
   array['radically-rural', 'entrepreneurship', 'pa']::text[],
   720),
  ('Northeast Transition Initiative',
   'This organization helps business owners successfully plan their exit strategy with an emphasis on employee ownership.',
   '**Northeast, USA**

This organization helps business owners successfully plan their exit strategy with an emphasis on employee ownership.

A replicable rural model from the Radically Rural models library (Entrepreneurship). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://ownershiptransition.org/',
   'Entrepreneurship · Radically Rural models library',
   array['radically-rural', 'entrepreneurship', 'northeast']::text[],
   730),
  ('Traverse City Repair Cafe',
   'This donation-based community event pairs attendees with skilled volunteers to help repair household items.',
   '**Traverse City, MI**

This donation-based community event pairs attendees with skilled volunteers to help repair household items.

A replicable rural model from the Radically Rural models library (Entrepreneurship). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://greendoorfolkschool.com/repair-cafe/',
   'Entrepreneurship · Radically Rural models library',
   array['radically-rural', 'entrepreneurship', 'mi']::text[],
   740),
  ('Ice House Entrepreneurship Program',
   'This program is designed to inspire and engage participants in the fundamental aspects of an entrepreneurial mindset.',
   '**National, USA**

This program is designed to inspire and engage participants in the fundamental aspects of an entrepreneurial mindset.

A replicable rural model from the Radically Rural models library (Entrepreneurship). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://elimindset.com/entrepreneurship-programs/ice-house-entrepreneurship-program/',
   'Entrepreneurship · Radically Rural models library',
   array['radically-rural', 'entrepreneurship', 'national']::text[],
   750),
  ('Online Farmers Market',
   'This online farmers market allows customers to pre-order locally grown goods and prevent food waste and loss of product for farmers.',
   '**Plymouth, NH**

This online farmers market allows customers to pre-order locally grown goods and prevent food waste and loss of product for farmers.

A replicable rural model from the Radically Rural models library (Entrepreneurship). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://localfoodsplymouth.org/',
   'Entrepreneurship · Radically Rural models library',
   array['radically-rural', 'entrepreneurship', 'nh']::text[],
   760),
  ('Build UP',
   'This program provides students with an opportunity to develop construction skills by renovating houses that they then have the opportunity to buy.',
   '**Birmingham, AL**

This program provides students with an opportunity to develop construction skills by renovating houses that they then have the opportunity to buy.

A replicable rural model from the Radically Rural models library (Housing). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.fastcompany.com/90614080/this-school-teaches-low-income-students-to-renovate-houses-and-helps-them-become-homeowners',
   'Housing · Radically Rural models library',
   array['radically-rural', 'housing', 'al']::text[],
   810),
  ('Windham Regional Commission',
   'This organization led a multi-town solution to adapt a public building into mulit-unit housing.',
   '**Windham County, VT**

This organization led a multi-town solution to adapt a public building into mulit-unit housing.

A replicable rural model from the Radically Rural models library (Housing). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.commonsnews.org/issue/784/784housing_mtg',
   'Housing · Radically Rural models library',
   array['radically-rural', 'housing', 'vt']::text[],
   820),
  ('The Bird’s Nest',
   'This tiny home community for women provides affordable housing and social connectivity.',
   '**Cumby, TX**

This tiny home community for women provides affordable housing and social connectivity.

A replicable rural model from the Radically Rural models library (Housing). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.realtor.com/news/first-person/all-women-tiny-home-village-texas/',
   'Housing · Radically Rural models library',
   array['radically-rural', 'housing', 'tx']::text[],
   830),
  ('Benevolence Farm',
   'This farm residential program cultivates leadership and promotes sustainable livelihoods for individuals impacted by the criminal legal system.',
   '**Alamance County, NC**

This farm residential program cultivates leadership and promotes sustainable livelihoods for individuals impacted by the criminal legal system.

A replicable rural model from the Radically Rural models library (Land & Community). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://benevolencefarm.org/',
   'Land & Community · Radically Rural models library',
   array['radically-rural', 'land-community', 'nc']::text[],
   910),
  ('Pemi-Baker Land Trust',
   'This trust works with property owners to place conservation easements on land in perpetuity.',
   '**Plymouth, NH**

This trust works with property owners to place conservation easements on land in perpetuity.

A replicable rural model from the Radically Rural models library (Land & Community). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://quincybog.org/',
   'Land & Community · Radically Rural models library',
   array['radically-rural', 'land-community', 'nh']::text[],
   920),
  ('Autism Nature Trail',
   'Letchworth State Park features an accessible Autism Nature Trail for inclusive outdoor recreation.',
   '**Perry, NY**

Letchworth State Park features an accessible Autism Nature Trail for inclusive outdoor recreation.

A replicable rural model from the Radically Rural models library (Land & Community). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://autismnaturetrail.com/',
   'Land & Community · Radically Rural models library',
   array['radically-rural', 'land-community', 'ny']::text[],
   930),
  ('eBird',
   'This platform allows users to populate birding data which then contributes to our understanding of climate change.',
   '**Ithaca, NY**

This platform allows users to populate birding data which then contributes to our understanding of climate change.

A replicable rural model from the Radically Rural models library (Land & Community). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://ebird.org/',
   'Land & Community · Radically Rural models library',
   array['radically-rural', 'land-community', 'ny']::text[],
   940),
  ('Preservation Trust Vermont',
   'This organization focuses on historic preservation including building easements, advocacy work, and more.',
   '**VT, USA**

This organization focuses on historic preservation including building easements, advocacy work, and more.

A replicable rural model from the Radically Rural models library (Land & Community). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://ptvermont.org/',
   'Land & Community · Radically Rural models library',
   array['radically-rural', 'land-community', 'vt']::text[],
   950),
  ('PA Wilds',
   'This voluntary planning document that highlights how communities in the region can protect and enhance their community’s character.',
   '**PA, USA**

This voluntary planning document that highlights how communities in the region can protect and enhance their community’s character.

A replicable rural model from the Radically Rural models library (Land & Community). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.pawildscenter.org/programs-and-services/community-character-stewardship/',
   'Land & Community · Radically Rural models library',
   array['radically-rural', 'land-community', 'pa']::text[],
   960),
  ('Perry Main Street Association',
   'This group puts on an annual chalk art festival which brings together artists, farmers, Main Street businesses, and community members.',
   '**Perry, NY**

This group puts on an annual chalk art festival which brings together artists, farmers, Main Street businesses, and community members.

A replicable rural model from the Radically Rural models library (Main Street). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://iloveperryny.com/perrychalkartfestival/',
   'Main Street · Radically Rural models library',
   array['radically-rural', 'main-street', 'ny']::text[],
   1010),
  ('218 Relocate',
   'This town has incentives like free coworking space and moving stipends for attracting remote workers.',
   '**Bemidji, MN**

This town has incentives like free coworking space and moving stipends for attracting remote workers.

A replicable rural model from the Radically Rural models library (Main Street). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://dailyyonder.com/rural-communities-across-the-u-s-are-attracting-remote-workers-through-different-incentive-programs/2021/10/19/',
   'Main Street · Radically Rural models library',
   array['radically-rural', 'main-street', 'mn']::text[],
   1020),
  ('Coburns’ General Store',
   'This business is exploring a nonprofit trust model as the owners transition into retirement.',
   '**Stafford, VT**

This business is exploring a nonprofit trust model as the owners transition into retirement.

A replicable rural model from the Radically Rural models library (Main Street). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.nytimes.com/2024/11/29/us/vermont-general-store-noah-kahan.html?unlocked_article_code=1.gE4.v6Y1.P-bCy5Nz0nr6',
   'Main Street · Radically Rural models library',
   array['radically-rural', 'main-street', 'vt']::text[],
   1030),
  ('The Circle Program',
   'This summer camp and mentorship program connects girls and young women with mentors and initiatives in the community.',
   '**Plymouth, NH**

This summer camp and mentorship program connects girls and young women with mentors and initiatives in the community.

A replicable rural model from the Radically Rural models library (Youth Retention). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.circleprogram.org/',
   'Youth Retention · Radically Rural models library',
   array['radically-rural', 'youth-retention', 'nh']::text[],
   1110),
  ('Lead for America',
   'This organization places fellows with service opportunities in their hometowns across the country.',
   '**National, USA**

This organization places fellows with service opportunities in their hometowns across the country.

A replicable rural model from the Radically Rural models library (Youth Retention). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://www.leadforamerica.org/',
   'Youth Retention · Radically Rural models library',
   array['radically-rural', 'youth-retention', 'national']::text[],
   1120),
  ('Farms Work Wonders',
   'This program supports Appalachian youth through paid job trainings and mentorship at their five local businesses.',
   '**Wardensville, WV**

This program supports Appalachian youth through paid job trainings and mentorship at their five local businesses.

A replicable rural model from the Radically Rural models library (Youth Retention). Read it as a pattern another small town could run, not a finished product: the structure travels, the local names do not.',
   'https://farmsworkwonders.org/',
   'Youth Retention · Radically Rural models library',
   array['radically-rural', 'youth-retention', 'wv']::text[],
   1130)
) as v(title, summary, body, url, attribution, tags, sort_order);
