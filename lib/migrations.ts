// Raw SQL migrations, applied in order on first connection (see lib/db.ts).
// Rule: every table that is created here gets ENABLE + FORCE ROW LEVEL SECURITY and its
// policy in the SAME migration. The app runs every statement as the non-owner role
// galli_app (SET LOCAL ROLE inside each transaction), so the policies always apply.

const OWNED = (t: string) => `
alter table ${t} enable row level security;
alter table ${t} force row level security;
drop policy if exists ${t}_tenant on ${t};
create policy ${t}_tenant on ${t} for all
  using (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid or current_setting('app.role', true) = 'system')
  with check (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid or current_setting('app.role', true) = 'system');
`;

const SYSTEM_ONLY = (t: string) => `
alter table ${t} enable row level security;
alter table ${t} force row level security;
drop policy if exists ${t}_system on ${t};
create policy ${t}_system on ${t} for all
  using (current_setting('app.role', true) = 'system')
  with check (current_setting('app.role', true) = 'system');
`;

export const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "0001_init",
    sql: `
create extension if not exists btree_gist;
create extension if not exists pg_trgm;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'galli_app') then
    create role galli_app nologin;
  end if;
  if not exists (
    select 1 from pg_auth_members m join pg_roles r on r.oid = m.roleid join pg_roles u on u.oid = m.member
    where r.rolname = 'galli_app' and u.rolname = current_user
  ) then
    execute format('grant galli_app to %I', current_user);
  end if;
end $$;

create table owners (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  display_name text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index owners_email on owners (lower(email));
alter table owners enable row level security;
alter table owners force row level security;
create policy owners_self on owners for all
  using (id = nullif(current_setting('app.owner_id', true), '')::uuid or current_setting('app.role', true) = 'system')
  with check (id = nullif(current_setting('app.owner_id', true), '')::uuid or current_setting('app.role', true) = 'system');

create table sessions (
  id text primary key,
  owner_id uuid not null references owners(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
${SYSTEM_ONLY("sessions")}

create table lanes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  handle text unique not null check (handle ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  tz text not null,
  lang_primary text not null default 'en',
  trade text not null,
  published_version_id uuid,
  draft jsonb not null,
  draft_version int not null default 1,
  seed int not null,
  pins jsonb not null default '{}',
  remixed_from_lane_id uuid,
  show_remixes boolean not null default false,
  listed boolean not null default false,
  is_demo boolean not null default false,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lanes_owner on lanes (owner_id);
${OWNED("lanes")}

create table lane_versions (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  doc jsonb not null,
  diff_summary text not null,
  published_at timestamptz not null default now()
);
create index lane_versions_lane on lane_versions (lane_id, published_at desc);
${OWNED("lane_versions")}

create table hours_rules (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null
);
create index hours_lane on hours_rules (lane_id);
${OWNED("hours_rules")}

create table closures (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  during daterange not null,
  note text
);
create index closures_lane on closures (lane_id);
${OWNED("closures")}

create table resources (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  name text not null
);
${OWNED("resources")}

create table services (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  resource_id uuid not null references resources(id) on delete cascade,
  name jsonb not null,
  minutes int not null check (minutes between 10 and 600),
  capacity int not null default 1 check (capacity between 1 and 50),
  buffer_before int not null default 0 check (buffer_before between 0 and 240),
  buffer_after int not null default 0 check (buffer_after between 0 and 240),
  min_notice_min int not null default 120,
  max_days_ahead int not null default 30,
  auto_confirm boolean not null default false,
  price_paise int,
  deposit_paise int,
  active boolean not null default true,
  sort int not null default 0
);
create index services_lane on services (lane_id);
${OWNED("services")}

create table bookings (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  service_id uuid not null references services(id) on delete cascade,
  resource_id uuid not null,
  seat int not null,
  slot tstzrange not null,
  blocked tstzrange not null,
  status text not null check (status in ('hold','pending','confirmed','declined','cancelled','done')),
  expires_at timestamptz,
  hold_token text unique,
  visitor_name text,
  visitor_contact text,
  note text,
  public_token text unique,
  sender_hash text,
  demo_sid text,
  archived boolean not null default false,
  reminder_24_sent_at timestamptz,
  reminder_2_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_double_booking exclude using gist
    (resource_id with =, seat with =, blocked with &&) where (status in ('hold','pending','confirmed'))
);
create index bookings_lane_slot on bookings (lane_id, lower(slot));
create index bookings_holds on bookings (status, expires_at) where status = 'hold';
${OWNED("bookings")}

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  name jsonb not null,
  blurb text not null default '',
  price_paise int not null check (price_paise >= 0),
  daily_cap int check (daily_cap is null or daily_cap between 0 and 10000),
  active boolean not null default true,
  sort int not null default 0
);
create index menu_lane on menu_items (lane_id);
${OWNED("menu_items")}

create table item_day_stock (
  item_id uuid not null references menu_items(id) on delete cascade,
  day date not null,
  owner_id uuid not null,
  sold int not null default 0,
  cap int not null,
  primary key (item_id, day),
  check (sold <= cap),
  check (sold >= 0)
);
${OWNED("item_day_stock")}

create table chits (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  kind text not null check (kind in ('enquiry','order')),
  scene text not null,
  schema_version int not null default 1,
  fields jsonb not null,
  lines jsonb,
  total_paise int,
  pickup_at timestamptz,
  pickup_day date,
  status text not null default 'new' check (status in ('new','read','replied','confirmed','declined','paid','done','archived')),
  read_at timestamptz,
  paid_marked_at timestamptz,
  decline_reason text,
  public_token text unique not null,
  sender_hash text not null,
  idempotency_key text unique not null,
  demo_sid text,
  search tsvector,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chits_lane on chits (lane_id, created_at desc);
create index chits_search on chits using gin (search);
create index chits_trgm on chits using gin (search_text gin_trgm_ops);
${OWNED("chits")}

create table chit_replies (
  id uuid primary key default gen_random_uuid(),
  chit_id uuid not null references chits(id) on delete cascade,
  owner_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index chit_replies_chit on chit_replies (chit_id);
${OWNED("chit_replies")}

create table attachments (
  id uuid primary key default gen_random_uuid(),
  chit_id uuid not null references chits(id) on delete cascade,
  owner_id uuid not null,
  data bytea not null,
  bytes int not null check (bytes <= 1048576),
  mime text not null check (mime in ('image/jpeg','image/png','image/webp','application/pdf'))
);
${OWNED("attachments")}

create table subscribers (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  email text not null,
  status text not null check (status in ('pending','confirmed','unsubscribed')),
  confirmed_at timestamptz,
  demo_sid text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index subscribers_lane_email on subscribers (lane_id, lower(email));
${OWNED("subscribers")}

create table consents (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references subscribers(id) on delete cascade,
  owner_id uuid not null,
  action text not null,
  at timestamptz not null default now(),
  ip_hash text not null,
  form_version text not null
);
${OWNED("consents")}

create table postcards (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  subject text not null,
  body text not null,
  status text not null check (status in ('draft','queued','sending','sent')),
  sent_count int not null default 0,
  created_at timestamptz not null default now()
);
${OWNED("postcards")}

create table postcard_sends (
  postcard_id uuid not null references postcards(id) on delete cascade,
  subscriber_id uuid not null references subscribers(id) on delete cascade,
  owner_id uuid not null,
  sent_at timestamptz,
  primary key (postcard_id, subscriber_id)
);
${OWNED("postcard_sends")}

create table notes (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  label text not null,
  url text not null,
  show_from timestamptz,
  show_until timestamptz,
  clicks int not null default 0,
  sort int not null default 0
);
create index notes_lane on notes (lane_id);
${OWNED("notes")}

create table blocked_senders (
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  sender_hash text not null,
  primary key (lane_id, sender_hash)
);
${OWNED("blocked_senders")}

create table galla_ops (
  op_id text primary key,
  owner_id uuid not null,
  applied_at timestamptz not null default now(),
  result jsonb
);
${OWNED("galla_ops")}

create table saved_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  lane_id uuid not null references lanes(id) on delete cascade,
  name text not null,
  filter jsonb not null
);
${OWNED("saved_views")}

create table daily_metrics (
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  day date not null,
  scene text not null,
  event text not null,
  n int not null default 0,
  primary key (lane_id, day, scene, event)
);
${OWNED("daily_metrics")}

create table scene_moves (
  lane_id uuid not null references lanes(id) on delete cascade,
  owner_id uuid not null,
  day date not null,
  from_scene text not null,
  to_scene text not null,
  n int not null default 0,
  primary key (lane_id, day, from_scene, to_scene)
);
${OWNED("scene_moves")}

create table rate_buckets (key text primary key, tokens real not null, refilled_at timestamptz not null);
${SYSTEM_ONLY("rate_buckets")}

create table reports (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references lanes(id) on delete cascade,
  reason text not null,
  detail text,
  created_at timestamptz not null default now()
);
${SYSTEM_ONLY("reports")}

create table reserved_handles (handle text primary key);
${SYSTEM_ONLY("reserved_handles")}

create table outbox_emails (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid references lanes(id) on delete cascade,
  owner_id uuid,
  to_hash text not null,
  to_addr text not null,
  kind text not null,
  subject text not null,
  payload jsonb not null,
  delivered text not null default 'outbox',
  created_at timestamptz not null default now()
);
create index outbox_lane on outbox_emails (lane_id, created_at desc);
${SYSTEM_ONLY("outbox_emails")}
drop policy if exists outbox_emails_owner_read on outbox_emails;
create policy outbox_emails_owner_read on outbox_emails for select
  using (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid);

create table job_runs (job text not null, run_key text not null, ran_at timestamptz not null default now(), detail jsonb, primary key (job, run_key));
${SYSTEM_ONLY("job_runs")}

create table app_secrets (k text primary key, v text not null);
${SYSTEM_ONLY("app_secrets")}

insert into reserved_handles (handle) values
  ('admin'),('api'),('studio'),('galli'),('apni-galli'),('apnigalli'),('login'),('signup'),('try'),('demo'),
  ('help'),('support'),('about'),('privacy'),('terms'),('how-fast'),('www'),('mail'),('root'),('system'),
  ('official'),('google'),('instagram'),('facebook'),('whatsapp'),('meta'),('amazon'),('flipkart'),('zomato'),
  ('swiggy'),('paytm'),('phonepe'),('gpay'),('razorpay'),('vercel'),('neon'),('staff'),('owner'),('null'),('undefined')
on conflict do nothing;

grant usage on schema public to galli_app;
grant select, insert, update, delete on all tables in schema public to galli_app;
`,
  },
  {
    name: "0002_owner_mail",
    sql: `
-- owner actions (a Galla reply, a postcard) queue mail as the owner, so the owner may insert their own outbox rows
drop policy if exists outbox_emails_owner_insert on outbox_emails;
create policy outbox_emails_owner_insert on outbox_emails for insert
  with check (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid);
`,
  },
  {
    name: "0003_set_role",
    sql: `
-- Postgres 16+ gives a CREATEROLE creator ADMIN on the new role but not SET, so SET LOCAL ROLE
-- galli_app is refused on Neon. Grant SET explicitly (a superuser, as in PGlite, needs nothing).
do $$ begin
  if not exists (
    select 1 from pg_auth_members m join pg_roles r on r.oid = m.roleid join pg_roles u on u.oid = m.member
    where r.rolname = 'galli_app' and u.rolname = current_user and m.set_option
  ) and not (select rolsuper from pg_roles where rolname = current_user) then
    execute format('grant galli_app to %I with inherit false, set true', current_user);
  end if;
end $$;
`,
  },
];
