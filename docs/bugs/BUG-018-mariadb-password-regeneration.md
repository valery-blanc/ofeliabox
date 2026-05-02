# BUG-018 — MariaDB password mismatch on wizard re-run

**Status:** FIXED
**Date:** 2026-05-01

## Symptom

After running the setup wizard a second time, Moodle, Koha and all DB-backed
services enter a restart loop with:
```
Access denied for user 'moodle'@'<ip>' (using password: YES)
```

## Root cause

`_write_env()` called `secrets.token_urlsafe()` unconditionally on every run,
generating NEW random passwords for every variable. MariaDB persists data in
`/opt/edubox/data/mariadb/` (bind mount) and keeps the passwords from its
FIRST initialization. On re-run, `.env` has new passwords but MariaDB has the
old ones → all DB connections fail.

## Fix applied

`_write_env()` now reads the existing `.env` file (if present) and reuses
stored passwords via a `_get(key)` helper. New passwords are only generated
for variables that don't already exist in the file.

## Secondary issue (same incident)

Kiwix healthcheck used `curl` (not available in kiwix-serve image) and checked
`http://localhost:8080/` instead of `http://localhost:8080/wiki`.
Fixed: switched to `wget -q --spider http://localhost:8080/wiki`.

`_patch_kiwix()` replaced the entire kiwix command, losing previously-installed
ZIM files on wizard re-run. Fixed: now builds the union of existing `.zim` files
on disk and newly-selected ones.

## Impact

`setup/app.py` — `_write_env()` and `_patch_kiwix()`
`docker-compose.yml` — Kiwix healthcheck
