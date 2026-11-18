<!-- read_when: Deploying, verifying or restoring the Mělnická Raspberry Pi installation. -->

# Raspberry Pi deployment

SSH host: `rpi.melnicka7.cz` (user `pi`, through Cloudflare Access).

- Backend checkout: `/home/pi/anlok`, service directory `services/access-api`.
- Service: `door-api.service`, running as `pi` with `gpio` and `input` groups.
- Runtime: system Python 3.11 and the project's locked uv environment.
- Database: `/home/pi/door-pin/data.db`. Set
  `DATABASE_URL=sqlite:////home/pi/door-pin/data.db` in the service `.env`.
- Production settings: private `.env` in the service directory; never commit it.
- API: <https://door-api.melnicka7.cz> through the existing port 8000 tunnel route.
- Web: <https://unlock.melnicka7.cz>, Pages project `door-control-web-app`.

The API and SSH share a tunnel connector. An API deployment does not require
restarting cloudflared or Docker. Keep a person at the door with alternative
access during hardware changes. Application imports initialize GPIO; isolate
migration rehearsals with mocked hardware and a database snapshot.

## Updating

Commit and push intended changes, then pull the chosen revision into the Pi's
checkout. Run `uv sync --locked --python /usr/bin/python3` in the service
directory before interrupting the running API. Keep one API worker.

Take a consistent SQLite snapshot and preserve the old unit, environment and
source revision. Stop the API, take a final snapshot, then start the chosen
release. Never run first-time setup against the production database.

Build `apps/web` with explicit production URLs, overriding local development
settings. Upload a Pages preview before publishing the static `out` directory
to production. Automatic builds from the legacy standalone repository are
disabled; deployments are currently manual.

Verify public health, authentication, reader startup and physical PIN/RFID/app
unlocking, including relay deactivation. Check activity and configured push
delivery. `/health` alone does not verify the hardware.

Run `sudo systemctl start anlok-db-backup.service` and verify its result. The
existing nightly timer still backs up the same database path to private R2.

## Recovery

The initial deployment recovery directory is
`/home/pi/anlok-recovery/20261118T094802Z`. It contains the original service,
private environment, legacy Git bundle and pre-cutover database snapshots.
The original checkout and virtual environment remain at `/home/pi/door-pin`.

Stop the candidate before restoring the old unit or database. Preserve a copy
of the current database and account for writes since cutover. Restore a
snapshot only if required; validate database compatibility before retaining a
migrated database with older code. Reload systemd, start the old service, and
verify physical access. Restore the earlier Pages deployment separately if
needed. Previous Pages production deployment:
`3dc40837-b6f1-49ae-9660-53258f1386f9`.

## Initial release

Backend source revision: `13c92c31ad8c57d7684624f8b20f66f9ad5fe233`.
The isolated migration rehearsal used a database snapshot and mocked GPIO;
existing account and credential records were preserved. All 74 backend tests,
four web tests and five native-app tests passed. The web production build
passed compilation, lint and type checking.

The user confirmed existing PIN, RFID and native-app unlocking after the
switch. Logs show relay deactivation after 10 seconds for each test, and the
corresponding activity events were recorded. Live account and credential
records matched the final pre-cutover snapshot. The post-upgrade backup
completed successfully. Public health, OAuth discovery, unauthenticated access
denial and the production web sign-in screen were verified.

Web sign-in/unlocking and the complete browser OAuth consent flow remain
unverified. Physical startup behavior was not observed at the door; the user
plans to watch the next Pi boot. Boot enablement was checked without rebooting.
Pages production deployment: `4201284e-b3cd-492f-8601-c571ce075ac9`.

APNs and FCM delivery credentials remain absent from the Pi. Push delivery is
unconfigured and unverified; it requires separate configuration and testing.
