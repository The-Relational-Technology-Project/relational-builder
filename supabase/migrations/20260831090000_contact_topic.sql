-- Budget feedback rides the existing contact pipe. A topic column tells
-- notes sent from the daily-budget banner (topic = 'budget-feedback') apart
-- from front-door contact-form messages (topic null), and lets the contact
-- function route each topic to the right inbox.
alter table public.contact_messages add column if not exists topic text;
