<!-- read_when: Maintaining, deploying, verifying, or restoring the legacy Raspberry Pi database backup. -->

# Legacy Raspberry Pi database backup

The legacy access API stores its live SQLite database at
`/home/pi/door-pin/data.db` on `rpi.melnicka7.cz`. A nightly systemd timer uses
SQLite's online backup API to create a consistent snapshot, checks its
integrity, and sends it to a private Cloudflare R2 bucket through a write-only
Worker endpoint.

The Worker accepts only authenticated `POST /backup` requests. It checks the
SQLite header and SHA-256 digest, writes a new timestamped R2 object, reads the
object back, and verifies its digest before confirming success. It has no
download, listing, overwrite, or deletion route, so the credential stored on
the Pi cannot remove earlier backups.

## Cloudflare resources

- Account: `Svjmelnicka@gmail.com's Account`
- Account ID: `17aa9251c5fe4c0ee4e806e2e82e59b9`
- R2 bucket: `anlok-legacy-db-backups` (EU jurisdiction, private)
- Worker: `anlok-legacy-db-backup-upload`
- Worker secret: `BACKUP_TOKEN`

Objects under `legacy-rpi/` expire automatically after one year. Cloudflare's
default seven-day cleanup for incomplete multipart uploads is also preserved.
This lifecycle policy is bucket configuration outside `wrangler.jsonc`; verify
it after provisioning with:

```bash
CLOUDFLARE_ACCOUNT_ID=17aa9251c5fe4c0ee4e806e2e82e59b9 \
  cf r2 buckets lifecycle get anlok-legacy-db-backups \
  --cf-r2-jurisdiction eu
```

Deploy from this directory with `npm run deploy`. Never commit the upload token.

## Raspberry Pi files

- `/usr/local/sbin/anlok-db-backup.py`
- `/etc/anlok-db-backup.token` (root-only systemd credential)
- `/etc/systemd/system/anlok-db-backup.service`
- `/etc/systemd/system/anlok-db-backup.timer`

The timer runs nightly at 03:30 Europe/Prague with up to 15 minutes of random
delay. `Persistent=true` runs a missed backup after the Pi returns online.
Overlapping manual and scheduled runs are rejected with `flock`.

## Verification and restore

Check the most recent run and next scheduled run:

```bash
sudo systemctl status anlok-db-backup.service
sudo systemctl list-timers anlok-db-backup.timer
sudo journalctl -u anlok-db-backup.service
```

For a restore drill, download an object into a temporary path with an
authenticated Cloudflare tool, compare its SHA-256 with the object's
`sha256` metadata, and run `PRAGMA integrity_check`. Never replace the live
database while `door-api.service` is running.
