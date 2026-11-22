-- Données de test locales (chargées par `supabase db reset`)
-- Comptes : orga@test.fr / invite@test.fr — mot de passe : password

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'orga@test.fr', extensions.crypt('password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Camille"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'invite@test.fr', extensions.crypt('password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Alex"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('orga@test.fr', 'invite@test.fr');

insert into public.events (id, slug, organizer_id, title, description, starts_at, location, theme) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'anniv-camille', '11111111-1111-1111-1111-111111111111',
   'Anniversaire de Camille 🎂', 'On fête mes 30 ans ! Ramenez de quoi grignoter, je m''occupe des boissons.',
   date_trunc('day', now()) + interval '10 days 20 hours', 'Chez moi, 12 rue des Lilas, Lyon', 'bordeaux'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'rando-vercors', '11111111-1111-1111-1111-111111111111',
   'Rando dans le Vercors', 'Boucle de 15 km, prévoir chaussures de marche et pique-nique.',
   date_trunc('day', now()) + interval '24 days 8 hours', 'Parking de Corrençon-en-Vercors', 'vert');

insert into public.rsvps (event_id, user_id, status, display_name, plus_ones) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'going', 'Alex', 1);

insert into public.announcements (event_id, author_id, body) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Le code de la porte est 4521B, 3e étage à gauche !');

-- Invités attendus : Alex a déjà répondu, Inès et Jordan pas encore
insert into public.invitees (event_id, display_name, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Alex', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Inès', null),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Jordan', null);
