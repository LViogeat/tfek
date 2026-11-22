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
  -- 57 caractères sans ambiguïté (pas de 0/O, 1/l/I)
  alphabet constant text := 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  n constant int := length(alphabet);
  -- Plus grand multiple de n <= 256 : on rejette les octets au-delà pour un tirage uniforme
  cutoff constant int := 256 - (256 % n);
  result text := '';
  bytes bytea;
  b int;
begin
  while length(result) < len loop
    bytes := extensions.gen_random_bytes(len * 2);
    for i in 0 .. length(bytes) - 1 loop
      b := get_byte(bytes, i);
      if b < cutoff then
        result := result || substr(alphabet, (b % n) + 1, 1);
        exit when length(result) = len;
      end if;
    end loop;
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
  -- Lien d'ami : /ami/<friend_code>
  friend_code text not null unique default public.generate_slug(12),
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
  -- Thème visuel du billet (couleurs de la page de l'event), voir src/lib/themes.ts
  theme text not null default 'noir'
    check (theme in ('noir', 'bordeaux', 'vert', 'nuit', 'terre', 'ivoire')),
  -- Options de confidentialité (paramétrables, défauts = le plus simple)
  visibility public.event_visibility not null default 'link',
  show_guest_list boolean not null default true,
  -- Nombre de réponses visible par les invités (page et aperçu du lien).
  -- La liste nominative implique le nombre : trois niveaux, tout / nombre seul / organisateur seul.
  show_counts boolean not null default true,
  allow_plus_ones boolean not null default true,
  cancelled_at timestamptz,
  -- Identifiant du brouillon publié : empêche de publier deux fois le même (deux onglets)
  draft_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organizer_id, draft_id),
  check (ends_at is null or ends_at >= starts_at),
  check (show_counts or not show_guest_list)
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
-- Invités attendus : prénoms ajoutés par l'organisateur.
-- En répondant, l'invité dit « c'est moi » : l'organisateur voit qui n'a pas encore répondu.
-- ---------------------------------------------------------------------------
create table public.invitees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  -- Celui qui a dit « c'est moi » (au plus un prénom par personne et par évènement)
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create unique index invitees_event_name_idx on public.invitees (event_id, lower(display_name));

alter table public.invitees enable row level security;

-- ---------------------------------------------------------------------------
-- Annonces de l'organisateur
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  -- 'change' : heure, date ou lieu modifiés ; 'cancel' : évènement annulé (publiées automatiquement)
  kind text not null default 'message' check (kind in ('message', 'change', 'cancel')),
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
create policy "events: un invité attendu voit l'évènement" on public.events
  for select using (exists (
    select 1 from public.invitees i where i.event_id = events.id and i.user_id = auth.uid()
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

create policy "invitees: l'organisateur voit ses invités" on public.invitees
  for select using (public.is_event_organizer(event_id));
create policy "invitees: je vois les prénoms qui me désignent" on public.invitees
  for select using (user_id = auth.uid());
create policy "invitees: l'organisateur retire un invité" on public.invitees
  for delete using (public.is_event_organizer(event_id));
-- Ajout via public.add_invitees(), « c'est moi » via public.rsvp()

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
    'theme', e.theme,
    'visibility', e.visibility,
    'show_guest_list', e.show_guest_list,
    'show_counts', e.show_counts,
    'allow_plus_ones', e.allow_plus_ones,
    'cancelled_at', e.cancelled_at,
    'created_at', e.created_at,
    'organizer_name', coalesce(p.display_name, 'Organisateur'),
    'is_organizer', coalesce(e.organizer_id = auth.uid(), false),
    -- null si l'organisateur garde les réponses pour lui
    'counts', case when e.show_counts or e.organizer_id = auth.uid() then (
      select jsonb_build_object(
        'going', coalesce(sum(1 + r.plus_ones) filter (where r.status = 'going'), 0),
        'maybe', coalesce(sum(1 + r.plus_ones) filter (where r.status = 'maybe'), 0),
        'declined', count(*) filter (where r.status = 'declined')
      )
      from public.rsvps r where r.event_id = e.id
    ) end,
    'my_rsvp', (
      select jsonb_build_object(
        'status', r.status,
        'display_name', r.display_name,
        'plus_ones', r.plus_ones,
        'invitee_id', (
          select i.id from public.invitees i where i.event_id = e.id and i.user_id = auth.uid()
        )
      )
      from public.rsvps r
      where r.event_id = e.id and r.user_id = auth.uid()
    )
  )
  from public.events e
  left join public.profiles p on p.id = e.organizer_id
  where e.slug = p_slug;
$$;

-- Invités attendus. L'organisateur les voit tous, avec leur réponse (null : pas encore répondu).
-- Les invités ne voient jamais de réponse ici :
--  * liste des invités publique : seulement les prénoms libres (pour dire « c'est moi ») et le leur ;
--  * réponses privées : tous les prénoms, pris ou non, sinon un prénom qui disparaît trahirait
--    que la personne a répondu.
create or replace function public.get_event_invitees(p_slug text)
returns table (id uuid, display_name text, is_me boolean, status public.rsvp_status)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.display_name, coalesce(i.user_id = auth.uid(), false),
         case when e.organizer_id = auth.uid() then r.status end
  from public.events e
  join public.invitees i on i.event_id = e.id
  left join public.rsvps r on r.event_id = e.id and r.user_id = i.user_id
  where e.slug = p_slug
    and (e.organizer_id = auth.uid() or not e.show_guest_list or i.user_id is null or i.user_id = auth.uid())
  order by lower(i.display_name);
$$;

-- L'organisateur ajoute des prénoms. Quelqu'un qui a déjà répondu sous ce prénom y est rattaché.
create or replace function public.add_invitees(p_slug text, p_names text[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_count int;
begin
  select id into v_event_id from public.events where slug = p_slug and organizer_id = auth.uid();
  if v_event_id is null then
    raise exception 'Réservé à l''organisateur' using errcode = '42501';
  end if;
  if coalesce(array_length(p_names, 1), 0) > 200 then
    raise exception 'Trop de prénoms d''un coup' using errcode = '22023';
  end if;

  with names as (
    select distinct on (lower(n)) n
    from (select left(btrim(x), 60) as n from unnest(p_names) as x) s
    where n <> ''
  ), ins as (
    insert into public.invitees (event_id, display_name, user_id)
    select v_event_id, names.n, (
      select r.user_id from public.rsvps r
      where r.event_id = v_event_id
        and lower(r.display_name) = lower(names.n)
        and not exists (select 1 from public.invitees i where i.event_id = v_event_id and i.user_id = r.user_id)
      order by r.created_at
      limit 1
    )
    from names
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;

create or replace function public.get_event_announcements(p_slug text)
returns table (id uuid, body text, kind text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.body, a.kind, a.created_at
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
  p_plus_ones int default 0,
  -- Prénom de la liste choisi par l'invité (« c'est moi ») ; null : prénom tapé
  p_invitee_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_name text := btrim(p_display_name);
  v_invitee_id uuid;
  v_invitee_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '28000';
  end if;

  select * into v_event from public.events where slug = p_slug;
  if not found then
    raise exception 'Évènement introuvable' using errcode = 'P0002';
  end if;
  if v_event.cancelled_at is not null then
    raise exception 'Cet évènement est annulé' using errcode = 'P0001';
  end if;

  if p_invitee_id is not null then
    select id, display_name, user_id into v_invitee_id, v_name, v_invitee_user
    from public.invitees
    where id = p_invitee_id and event_id = v_event.id
    for update;
    if v_invitee_id is null then
      raise exception 'Ce prénom n''est plus dans la liste' using errcode = 'P0002';
    end if;
    if v_invitee_user is not null and v_invitee_user <> auth.uid() then
      if v_event.show_guest_list then
        raise exception 'Ce prénom a déjà répondu' using errcode = 'P0001';
      end if;
      -- Réponses privées : refuser révélerait que ce prénom a répondu. La réponse est enregistrée
      -- sous ce prénom, sans le rattacher (l'organisateur verra deux réponses à ce nom).
      v_invitee_id := null;
    end if;
  elsif v_name is not null and v_name <> '' then
    -- Un prénom tapé qui correspond à un invité libre de la liste vaut « c'est moi »
    select id, display_name into v_invitee_id, v_name
    from public.invitees
    where event_id = v_event.id and lower(display_name) = lower(v_name)
      and (user_id is null or user_id = auth.uid())
    for update;
    v_name := coalesce(v_name, btrim(p_display_name));
  end if;

  if v_name is null or v_name = '' then
    raise exception 'Le prénom est requis' using errcode = '22023';
  end if;

  -- Une personne ne peut être qu'un seul prénom de la liste
  update public.invitees set user_id = null
  where event_id = v_event.id and user_id = auth.uid() and id is distinct from v_invitee_id;
  if v_invitee_id is not null then
    update public.invitees set user_id = auth.uid() where id = v_invitee_id;
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
  v_updated int;
  -- Évènements où la réponse anonyme l'emporte sur celle du compte, et où elle est gardée
  v_won uuid[];
  v_kept uuid[];
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

  v_won := array(
    select a.event_id from public.rsvps a
    join public.rsvps r on r.event_id = a.event_id and r.user_id = auth.uid()
    where a.user_id = v_anon and a.updated_at > r.updated_at
  );
  v_kept := v_won || array(
    select a.event_id from public.rsvps a
    where a.user_id = v_anon
      and not exists (select 1 from public.rsvps r where r.event_id = a.event_id and r.user_id = auth.uid())
  );

  -- Même évènement des deux côtés : la réponse la plus récente gagne
  update public.rsvps r
  set status = a.status, display_name = a.display_name, plus_ones = a.plus_ones
  from public.rsvps a
  where a.user_id = v_anon
    and r.user_id = auth.uid()
    and r.event_id = a.event_id
    and a.updated_at > r.updated_at;
  get diagnostics v_updated = row_count;

  -- Récupère les réponses qui n'existent pas encore sur le compte inscrit
  update public.rsvps r set user_id = auth.uid()
  where r.user_id = v_anon
    and not exists (
      select 1 from public.rsvps r2 where r2.event_id = r.event_id and r2.user_id = auth.uid()
    );
  get diagnostics v_count = row_count;
  v_count := v_count + v_updated;

  delete from public.rsvps where user_id = v_anon;

  -- Le « c'est moi » suit la réponse gardée : celui du compte est libéré là où la réponse anonyme
  -- l'emporte (ou là où elle apporte son propre prénom), puis celui de l'anonyme le remplace.
  update public.invitees i set user_id = null
  where i.user_id = auth.uid()
    and (
      i.event_id = any(v_won)
      or (i.event_id = any(v_kept)
          and exists (select 1 from public.invitees i2 where i2.event_id = i.event_id and i2.user_id = v_anon))
    );
  update public.invitees set user_id = auth.uid()
  where user_id = v_anon and event_id = any(v_kept);
  update public.invitees set user_id = null where user_id = v_anon;

  update public.profiles p set display_name = (select display_name from public.profiles where id = v_anon)
  where p.id = auth.uid() and p.display_name is null;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Amis (comptes inscrits uniquement, jamais imposé à celui qui répond par le lien)
-- On devient amis par le lien d'ami (le partager vaut accord) ou par une demande acceptée
-- (suggestions : les personnes croisées aux mêmes évènements).
-- ---------------------------------------------------------------------------
create type public.friendship_status as enum ('pending', 'accepted');

create table public.friendships (
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- Une seule relation par paire, quel que soit le sens
create unique index friendships_pair_idx on public.friendships (
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
);
create index friendships_addressee_idx on public.friendships (addressee_id);

create trigger friendships_updated_at before update on public.friendships
  for each row execute function public.set_updated_at();

alter table public.friendships enable row level security;

create policy "friendships: je vois les miennes" on public.friendships
  for select using (auth.uid() in (requester_id, addressee_id));
-- Écritures uniquement via les fonctions ci-dessous

create or replace function public.is_registered_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users u where u.id = p_user and not u.is_anonymous);
$$;

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b) or (f.requester_id = p_b and f.addressee_id = p_a))
  );
$$;

-- Relation entre moi et p_other : 'friends', 'sent' (j'ai demandé), 'received' (on m'a demandé) ou null
create or replace function public.friend_state(p_other uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when f.status = 'accepted' then 'friends'
           when f.requester_id = auth.uid() then 'sent'
           else 'received'
         end
  from public.friendships f
  where (f.requester_id = auth.uid() and f.addressee_id = p_other)
     or (f.requester_id = p_other and f.addressee_id = auth.uid());
$$;

-- Liste des invités (si l'organisateur l'autorise, toujours pour l'organisateur), avec mes amis repérés
create or replace function public.get_event_guests(p_slug text)
returns table (display_name text, status public.rsvp_status, plus_ones int, is_me boolean, is_friend boolean, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.display_name, r.status, r.plus_ones, coalesce(r.user_id = auth.uid(), false),
         coalesce(public.are_friends(r.user_id, auth.uid()), false), r.updated_at
  from public.events e
  join public.rsvps r on r.event_id = e.id
  where e.slug = p_slug
    and (e.show_guest_list or e.organizer_id = auth.uid())
  order by r.status, r.created_at;
$$;

-- Page du lien d'ami : prénom du propriétaire et relation avec moi (lisible sans compte)
create or replace function public.get_friend_link(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'display_name', coalesce(p.display_name, 'Sans prénom'),
    'is_me', coalesce(p.id = auth.uid(), false),
    'state', public.friend_state(p.id)
  )
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.friend_code = p_code and not u.is_anonymous;
$$;

-- Ouvrir le lien d'ami de quelqu'un : amis tout de suite (le partager vaut accord)
create or replace function public.add_friend_by_code(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other uuid;
  v_name text;
begin
  if not public.is_registered() then
    raise exception 'Compte requis' using errcode = '28000';
  end if;
  select p.id, coalesce(p.display_name, 'Sans prénom') into v_other, v_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.friend_code = p_code and not u.is_anonymous;
  if v_other is null then
    raise exception 'Ce lien d''ami n''existe pas' using errcode = 'P0002';
  end if;
  if v_other = auth.uid() then
    raise exception 'C''est ton propre lien' using errcode = 'P0001';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (auth.uid(), v_other, 'accepted')
  on conflict do nothing;
  -- Une demande attendait, dans un sens ou dans l'autre : elle devient une amitié
  update public.friendships set status = 'accepted'
  where status = 'pending'
    and ((requester_id = auth.uid() and addressee_id = v_other) or (requester_id = v_other and addressee_id = auth.uid()));
  return v_name;
end;
$$;

-- Demande d'ami (depuis les suggestions). Si l'autre m'a déjà demandé, on devient amis.
create or replace function public.request_friend(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_registered() then
    raise exception 'Compte requis' using errcode = '28000';
  end if;
  if p_user = auth.uid() or not public.is_registered_user(p_user) then
    raise exception 'Personne introuvable' using errcode = 'P0002';
  end if;
  update public.friendships set status = 'accepted'
  where requester_id = p_user and addressee_id = auth.uid() and status = 'pending';
  if not found then
    insert into public.friendships (requester_id, addressee_id) values (auth.uid(), p_user)
    on conflict do nothing;
  end if;
  return public.friend_state(p_user);
end;
$$;

create or replace function public.accept_friend(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.friendships set status = 'accepted'
  where requester_id = p_user and addressee_id = auth.uid() and status = 'pending';
  return found;
end;
$$;

-- Retirer un ami, refuser ou annuler une demande
create or replace function public.remove_friend(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where (requester_id = auth.uid() and addressee_id = p_user)
     or (requester_id = p_user and addressee_id = auth.uid());
  return found;
end;
$$;

create or replace function public.list_friends()
returns table (user_id uuid, display_name text, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, coalesce(p.display_name, 'Sans prénom'),
         case
           when f.status = 'accepted' then 'friends'
           when f.requester_id = auth.uid() then 'sent'
           else 'received'
         end
  from public.friendships f
  cross join lateral (
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as id
  ) o
  left join public.profiles p on p.id = o.id
  where auth.uid() in (f.requester_id, f.addressee_id)
  order by lower(coalesce(p.display_name, ''));
$$;

-- Suggestions : comptes croisés aux mêmes évènements (organisateur, ou invité qui n'a pas dit non),
-- seulement là où la liste des invités m'était visible.
create or replace function public.friend_suggestions()
returns table (user_id uuid, display_name text, shared_events int)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select e.id, e.organizer_id, e.show_guest_list from public.events e
    where e.organizer_id = auth.uid()
    union
    select e.id, e.organizer_id, e.show_guest_list from public.events e
    join public.rsvps r on r.event_id = e.id and r.user_id = auth.uid() and r.status <> 'declined'
  ), people as (
    select m.id as event_id, m.organizer_id as user_id from mine m
    union
    select m.id, r.user_id from mine m
    join public.rsvps r on r.event_id = m.id and r.status <> 'declined'
    where m.show_guest_list or m.organizer_id = auth.uid()
  )
  select pe.user_id, coalesce(p.display_name, 'Sans prénom'), count(distinct pe.event_id)::int
  from people pe
  join auth.users u on u.id = pe.user_id and not u.is_anonymous
  left join public.profiles p on p.id = pe.user_id
  where public.is_registered()
    and pe.user_id <> auth.uid()
    and public.friend_state(pe.user_id) is null
  group by pe.user_id, p.display_name
  order by 3 desc, 2
  limit 20;
$$;

-- Organisateur : amis qu'il peut encore inviter à cet évènement
create or replace function public.get_invitable_friends(p_slug text)
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, coalesce(p.display_name, 'Sans prénom')
  from public.events e
  join public.friendships f on f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id)
  cross join lateral (
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as id
  ) o
  left join public.profiles p on p.id = o.id
  where e.slug = p_slug
    and e.organizer_id = auth.uid()
    -- Sans prénom, il n'apparaîtrait que comme « Sans prénom » dans la liste et la relance
    and btrim(coalesce(p.display_name, '')) <> ''
    and not exists (select 1 from public.invitees i where i.event_id = e.id and i.user_id = o.id)
    and not exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = o.id)
  order by lower(coalesce(p.display_name, ''));
$$;

-- L'organisateur invite des amis : ils deviennent des invités attendus déjà reconnus,
-- et l'évènement apparaît dans leurs invitations avant même qu'ils répondent.
create or replace function public.invite_friends(p_slug text, p_user_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_friend record;
  v_count int := 0;
  v_name text;
  v_n int;
begin
  select id into v_event_id from public.events where slug = p_slug and organizer_id = auth.uid();
  if v_event_id is null then
    raise exception 'Réservé à l''organisateur' using errcode = '42501';
  end if;

  for v_friend in
    select distinct o.id, btrim(p.display_name) as name
    from unnest(p_user_ids) as o(id)
    join public.profiles p on p.id = o.id
    where public.are_friends(o.id, auth.uid())
      and btrim(coalesce(p.display_name, '')) <> ''
      and not exists (select 1 from public.invitees i where i.event_id = v_event_id and i.user_id = o.id)
  loop
    -- Le même prénom, encore libre, est déjà dans la liste : c'est lui
    update public.invitees set user_id = v_friend.id
    where event_id = v_event_id and lower(display_name) = lower(v_friend.name) and user_id is null;
    if found then
      v_count := v_count + 1;
      continue;
    end if;
    -- Prénom déjà pris par quelqu'un d'autre : « Alex 2 », « Alex 3 »…
    v_n := 1;
    loop
      v_name := case when v_n = 1 then v_friend.name else left(v_friend.name, 56) || ' ' || v_n end;
      insert into public.invitees (event_id, display_name, user_id)
      values (v_event_id, v_name, v_friend.id)
      on conflict do nothing;
      exit when found or v_n >= 50;
      v_n := v_n + 1;
    end loop;
    if found then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Dupliquer un évènement : reprend les prénoms de la liste. Un prénom rattaché à un ami de
-- l'organisateur le reste (l'évènement arrive dans ses invitations), les autres sont copiés sans rattachement.
create or replace function public.copy_invitees(p_from text, p_to text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from uuid;
  v_to uuid;
  v_count int;
begin
  select id into v_from from public.events where slug = p_from and public.is_event_organizer(id);
  select id into v_to from public.events where slug = p_to and public.is_event_organizer(id);
  if v_from is null or v_to is null then
    raise exception 'Réservé à l''organisateur' using errcode = '42501';
  end if;

  insert into public.invitees (event_id, display_name, user_id)
  select v_to, i.display_name,
         case when public.are_friends(i.user_id, auth.uid()) then i.user_id end
  from public.invitees i
  where i.event_id = v_from
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------
revoke execute on function public.create_merge_token() from public, anon;
revoke execute on function public.merge_anonymous_user(text) from public, anon;
revoke execute on function public.rsvp(text, public.rsvp_status, text, int, uuid) from public, anon;
revoke execute on function public.add_invitees(text, text[]) from public, anon;
revoke execute on function public.is_registered_user(uuid) from public, anon, authenticated;
revoke execute on function public.friend_state(uuid) from public, anon;
revoke execute on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.add_friend_by_code(text) from public, anon;
revoke execute on function public.request_friend(uuid) from public, anon;
revoke execute on function public.accept_friend(uuid) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.list_friends() from public, anon;
revoke execute on function public.friend_suggestions() from public, anon;
revoke execute on function public.get_invitable_friends(text) from public, anon;
revoke execute on function public.invite_friends(text, uuid[]) from public, anon;
revoke execute on function public.copy_invitees(text, text) from public, anon;
grant execute on function public.create_merge_token() to authenticated;
grant execute on function public.merge_anonymous_user(text) to authenticated;
grant execute on function public.rsvp(text, public.rsvp_status, text, int, uuid) to authenticated;
grant execute on function public.add_invitees(text, text[]) to authenticated;
grant execute on function public.friend_state(uuid) to authenticated;
grant execute on function public.add_friend_by_code(text) to authenticated;
grant execute on function public.request_friend(uuid) to authenticated;
grant execute on function public.accept_friend(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.friend_suggestions() to authenticated;
grant execute on function public.get_invitable_friends(text) to authenticated;
grant execute on function public.invite_friends(text, uuid[]) to authenticated;
grant execute on function public.copy_invitees(text, text) to authenticated;
