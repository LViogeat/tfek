-- tfek : schéma initial
-- Principes :
--  * Un event est accessible par toute personne qui connaît son lien (slug non devinable),
--    mais on ne peut pas lister les events : l'accès public passe par des fonctions RPC
--    qui prennent le slug en paramètre.
--  * Les invités répondent avec un compte anonyme Supabase (aucune saisie hormis le prénom).
--  * Créer un event demande un vrai compte (non anonyme).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.event_visibility as enum ('link', 'public');
create type public.rsvp_status as enum ('going', 'maybe', 'declined');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.generate_slug(len int default 10)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(len);
  result text := '';
begin
  for i in 0 .. len - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.is_registered()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crée automatiquement un profil pour chaque utilisateur (anonyme ou non)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles: lecture de son profil" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: modification de son profil" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default public.generate_slug(),
  organizer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 5000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text check (char_length(location) <= 300),
  cover_url text,
  -- Options de confidentialité (paramétrables, défauts = le plus simple)
  visibility public.event_visibility not null default 'link',
  show_guest_list boolean not null default true,
  allow_plus_ones boolean not null default true,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index events_organizer_idx on public.events (organizer_id, starts_at desc);

create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

-- ---------------------------------------------------------------------------
-- Réponses (RSVP)
-- ---------------------------------------------------------------------------
create table public.rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.rsvp_status not null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  plus_ones int not null default 0 check (plus_ones between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index rsvps_user_idx on public.rsvps (user_id);

create trigger rsvps_updated_at before update on public.rsvps
  for each row execute function public.set_updated_at();

alter table public.rsvps enable row level security;

-- ---------------------------------------------------------------------------
-- Annonces de l'organisateur
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index announcements_event_idx on public.announcements (event_id, created_at desc);

alter table public.announcements enable row level security;

-- ---------------------------------------------------------------------------
-- Policies (accès direct aux tables : organisateur + ses propres réponses)
-- ---------------------------------------------------------------------------
create or replace function public.is_event_organizer(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.organizer_id = auth.uid()
  );
$$;

create policy "events: l'organisateur voit ses events" on public.events
  for select using (organizer_id = auth.uid());
create policy "events: un invité voit les events auxquels il a répondu" on public.events
  for select using (exists (
    select 1 from public.rsvps r where r.event_id = events.id and r.user_id = auth.uid()
  ));
create policy "events: seul un compte inscrit peut créer" on public.events
  for insert with check (public.is_registered() and organizer_id = auth.uid());
create policy "events: l'organisateur modifie" on public.events
  for update using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
create policy "events: l'organisateur supprime" on public.events
  for delete using (organizer_id = auth.uid());

create policy "rsvps: je vois mes réponses" on public.rsvps
  for select using (user_id = auth.uid());
create policy "rsvps: l'organisateur voit les réponses" on public.rsvps
  for select using (public.is_event_organizer(event_id));
create policy "rsvps: je supprime ma réponse" on public.rsvps
  for delete using (user_id = auth.uid());
-- Les insertions / mises à jour de réponses passent par la fonction public.rsvp()

create policy "announcements: l'organisateur gère" on public.announcements
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id) and author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC publiques (accès par slug)
-- ---------------------------------------------------------------------------

-- Détails d'un event + compteurs + ma réponse
create or replace function public.get_event(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id,
    'slug', e.slug,
    'title', e.title,
    'description', e.description,
    'starts_at', e.starts_at,
    'ends_at', e.ends_at,
    'location', e.location,
    'cover_url', e.cover_url,
    'visibility', e.visibility,
    'show_guest_list', e.show_guest_list,
    'allow_plus_ones', e.allow_plus_ones,
    'cancelled_at', e.cancelled_at,
    'created_at', e.created_at,
    'organizer_name', coalesce(p.display_name, 'Organisateur'),
    'is_organizer', coalesce(e.organizer_id = auth.uid(), false),
    'counts', (
      select jsonb_build_object(
        'going', coalesce(sum(1 + r.plus_ones) filter (where r.status = 'going'), 0),
        'maybe', coalesce(sum(1 + r.plus_ones) filter (where r.status = 'maybe'), 0),
        'declined', count(*) filter (where r.status = 'declined')
      )
      from public.rsvps r where r.event_id = e.id
    ),
    'my_rsvp', (
      select jsonb_build_object(
        'status', r.status,
        'display_name', r.display_name,
        'plus_ones', r.plus_ones
      )
      from public.rsvps r
      where r.event_id = e.id and r.user_id = auth.uid()
    )
  )
  from public.events e
  left join public.profiles p on p.id = e.organizer_id
  where e.slug = p_slug;
$$;

-- Liste des invités (si l'organisateur l'autorise, toujours pour l'organisateur)
create or replace function public.get_event_guests(p_slug text)
returns table (display_name text, status public.rsvp_status, plus_ones int, is_me boolean, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.display_name, r.status, r.plus_ones, coalesce(r.user_id = auth.uid(), false), r.updated_at
  from public.events e
  join public.rsvps r on r.event_id = e.id
  where e.slug = p_slug
    and (e.show_guest_list or e.organizer_id = auth.uid())
  order by r.status, r.created_at;
$$;

create or replace function public.get_event_announcements(p_slug text)
returns table (id uuid, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.body, a.created_at
  from public.events e
  join public.announcements a on a.event_id = e.id
  where e.slug = p_slug
  order by a.created_at desc;
$$;

-- Répondre à un event (compte anonyme accepté)
create or replace function public.rsvp(
  p_slug text,
  p_status public.rsvp_status,
  p_display_name text,
  p_plus_ones int default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_name text := btrim(p_display_name);
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '28000';
  end if;

  select * into v_event from public.events where slug = p_slug;
  if not found then
    raise exception 'Event introuvable' using errcode = 'P0002';
  end if;
  if v_event.cancelled_at is not null then
    raise exception 'Cet event est annulé' using errcode = 'P0001';
  end if;
  if v_name is null or v_name = '' then
    raise exception 'Le prénom est requis' using errcode = '22023';
  end if;

  insert into public.rsvps (event_id, user_id, status, display_name, plus_ones)
  values (
    v_event.id,
    auth.uid(),
    p_status,
    v_name,
    case when v_event.allow_plus_ones and p_status <> 'declined' then greatest(coalesce(p_plus_ones, 0), 0) else 0 end
  )
  on conflict (event_id, user_id) do update
    set status = excluded.status,
        display_name = excluded.display_name,
        plus_ones = excluded.plus_ones;

  -- Retient le prénom pour les prochaines réponses
  update public.profiles set display_name = v_name
  where id = auth.uid() and display_name is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fusion compte anonyme -> compte inscrit
-- Avant de se connecter, le client (encore anonyme) crée un jeton de fusion.
-- Une fois connecté avec son vrai compte, il appelle merge_anonymous_user(jeton)
-- pour récupérer ses réponses.
-- ---------------------------------------------------------------------------
create table public.merge_tokens (
  token text primary key default public.generate_slug(32),
  anon_user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '1 day'
);

alter table public.merge_tokens enable row level security;
-- Aucune policy : accès uniquement via les fonctions ci-dessous

create or replace function public.create_merge_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false then
    return null;
  end if;
  delete from public.merge_tokens where anon_user_id = auth.uid() or expires_at < now();
  insert into public.merge_tokens (anon_user_id) values (auth.uid()) returning token into v_token;
  return v_token;
end;
$$;

create or replace function public.merge_anonymous_user(p_token text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anon uuid;
  v_count int;
begin
  if not public.is_registered() then
    raise exception 'Compte inscrit requis' using errcode = '28000';
  end if;

  delete from public.merge_tokens
  where token = p_token and expires_at > now()
  returning anon_user_id into v_anon;

  if v_anon is null or v_anon = auth.uid() then
    return 0;
  end if;

  -- Récupère les réponses qui n'existent pas déjà sur le compte inscrit
  update public.rsvps r set user_id = auth.uid()
  where r.user_id = v_anon
    and not exists (
      select 1 from public.rsvps r2 where r2.event_id = r.event_id and r2.user_id = auth.uid()
    );
  get diagnostics v_count = row_count;

  delete from public.rsvps where user_id = v_anon;

  update public.profiles p set display_name = (select display_name from public.profiles where id = v_anon)
  where p.id = auth.uid() and p.display_name is null;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------
revoke execute on function public.create_merge_token() from public, anon;
revoke execute on function public.merge_anonymous_user(text) from public, anon;
revoke execute on function public.rsvp(text, public.rsvp_status, text, int) from public, anon;
grant execute on function public.create_merge_token() to authenticated;
grant execute on function public.merge_anonymous_user(text) to authenticated;
grant execute on function public.rsvp(text, public.rsvp_status, text, int) to authenticated;
