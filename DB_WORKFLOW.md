# DB Workflow (Local Neon + Replit DB)

This project supports using one database locally and a different one on Replit.

## 1) One-time setup (local machine)

Set these environment variables in your local shell profile (or set them per terminal session):

```powershell
$env:LOCAL_DATABASE_URL="postgresql://<user>:<password>@<neon-host>/<db>?sslmode=require"
$env:REPLIT_DATABASE_URL="postgresql://<replit-user>:<replit-pass>@<replit-host>/<db>"
```

Keep `.env` for whichever DB you want to run the app against right now.

## 2) Local development against Neon

Set `.env`:

```env
DATABASE_URL=postgresql://<user>:<password>@<neon-host>/<db>?sslmode=require
```

Run:

```powershell
npm run db:check
npm run dev:server
```

## 3) Schema change workflow (recommended)

After changing `shared/schema.ts`:

```powershell
npm run db:generate
npm run db:sync:both
```

What this does:
- Applies migrations to local DB (`LOCAL_DATABASE_URL`)
- Applies migrations to Replit DB (`REPLIT_DATABASE_URL`)
- Seeds translations on both

## 4) Apply only one target

Local only:

```powershell
npm run db:migrate:local
```

Replit only:

```powershell
npm run db:migrate:replit
```

## 5) Replit environment

In Replit, set the secret:

```text
DATABASE_URL=<Replit DB URL>
```

Then run migrations there when needed:

```bash
npm run db:migrate
npm run db:seed-translations
```

## Notes

- Prefer migration files over `db:push` for multi-environment consistency.
- Keep `migrations/` committed to git.
- Data sync is separate from schema sync (migrations only change schema/state logic, not full content copies).
