create table if not exists api_challenges (
  id          uuid default gen_random_uuid() primary key,
  type        text not null,
  prompt      text not null,
  answer_data jsonb not null,
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  created_at  timestamptz default now()
);

create table if not exists api_tokens (
  token          uuid default gen_random_uuid() primary key,
  challenge_id   uuid,
  challenge_type text,
  created_at     timestamptz default now(),
  expires_at     timestamptz not null default (now() + interval '1 hour')
);
