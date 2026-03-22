# Takuween Migration Runbook

Quick start on Windows:

```bat
migrate_takuween.bat
```

`migrate_takuween.bat` is a wrapper that runs `migrate_takuween.ps1`.

The batch script now does this flow:

1. Dump source/original Replit DB.
2. Restore into your local DB.
3. Run `scripts/reset-generated-media.sql` on local DB.
4. Export cleaned dump (`takuween.dump`).
5. Optionally import into new Replit DB.

## 1) Prerequisites

- PostgreSQL client tools in PATH: `psql`, `pg_dump`, `pg_restore`
- A local database created (for example `takuween`)
- Original Replit `DATABASE_URL`
- New target Replit `DATABASE_URL` (optional if importing immediately)

## Notes

- This project copy excludes `.git`, `node_modules`, `dist`, `uploads`, and `attached_assets`.
- `scripts/reset-generated-media.sql` removes generated images/videos/jobs and gallery references while preserving translation/config tables.
- Do not reuse the original app DB URL as target for import.
