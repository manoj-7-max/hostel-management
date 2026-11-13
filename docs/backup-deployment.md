# Local backup and deployment notes

## Keep secrets out of source control

Copy `.env.example` to `.env` and set PostgreSQL credentials plus a long random `JWT_SECRET`. The root `.env` is ignored by Git. Replace demo passwords before putting real resident data in this system. Set `CLIENT_ORIGIN` to the exact trusted frontend origin when deploying; the local development origins are allowed for localhost.

Admission documents are written under `private_uploads/` and are not served as static files. Back up this directory separately from PostgreSQL and restrict operating-system access to it. Do not place it in a public web root.

## PostgreSQL backup on Windows PowerShell

Set a task-specific destination before backup:

```powershell
$backupFile = "D:\HostelBackups\hostel_db-$(Get-Date -Format yyyyMMdd-HHmmss).dump"
pg_dump --format=custom --host=localhost --port=5432 --username=postgres --file=$backupFile hostel_db
```

The command prompts for the PostgreSQL password unless `PGPASSWORD` is configured in the process environment. Avoid putting a database password in shell history. Copy the matching `private_uploads/` backup to the same protected backup set.

Restore into a new empty database first, which lets you inspect the result without replacing the current database:

```powershell
createdb --host=localhost --port=5432 --username=postgres hostel_restore_check
pg_restore --host=localhost --port=5432 --username=postgres --dbname=hostel_restore_check $backupFile
```

Verify the restored app with the health endpoint, then run the versioned migrations if the restore came from an older application release:

```powershell
Invoke-RestMethod http://localhost:3000/health
node scripts/migrate.js
```

Keep encrypted, access-controlled backups and periodically check that a restore succeeds. Database and private-file backups must be taken together to keep document metadata and stored files aligned.

## Deployment checklist

- Use a supported Node.js and PostgreSQL release and install dependencies from the lockfiles.
- Set strong `JWT_SECRET`, database credentials, `PORT`, and exact `CLIENT_ORIGIN` values through the deployment environment.
- Create the database, load `hostel_schema.sql` once for a fresh database, and apply migrations with `node scripts/migrate.js`.
- Create an administrator account with a unique password; do not expose the demo accounts on a public instance.
- Serve the built frontend over HTTPS and proxy API requests to the Express service. Configure TLS and request-size limits at the reverse proxy.
- Keep `private_uploads/` outside public static content and persist it on protected storage.
- Schedule encrypted database and document backups; record and rehearse a restore procedure.
- Monitor `GET /health`, application logs, disk use, and PostgreSQL availability.
- Load-test search and reports against representative resident counts before making capacity claims.

## Public VPS deployment package

The repository now includes `Dockerfile`, `compose.yaml`, and `Caddyfile` for a single-domain deployment. This expects a Linux VPS with Docker Engine and the Docker Compose plugin. Point the domain's DNS A record at the VPS, allow inbound ports 80 and 443, and copy `.env.hosting.example` to `.env.hosting` on the server. Fill in unique database/JWT/admin passwords; the JWT secret must be at least 32 characters.

Generate secret values on the server with `openssl rand -base64 48`, then place them in `.env.hosting`. Do not reuse the local demo password. Start the services:

```sh
docker compose --env-file .env.hosting up --build -d
docker compose --env-file .env.hosting ps
docker compose --env-file .env.hosting logs -f app caddy
```

The PostgreSQL container is private to the compose network and persists its data in a named volume. Uploaded files use a separate named volume. Caddy obtains and renews public HTTPS certificates when the configured domain resolves to the server and ports 80/443 are reachable; see the [Caddy reverse-proxy guide](https://caddyserver.com/docs/quick-starts/reverse-proxy) and [automatic HTTPS guide](https://caddyserver.com/docs/automatic-https). Compose waits for the database health check before starting the app, following [Docker's service startup guidance](https://docs.docker.com/compose/how-tos/startup-order).

The app applies database migrations and creates one super-administrator on first boot from the environment values. The initial password is not printed and must be changed at first sign-in. The public build omits the local demo-password panel and does not run the demo-data preparation script. Review the base schema's sample resident and operations rows before entering real business data.

## Temporary free demo on Render

`render.yaml` defines a one-click Render Blueprint with a Docker web service and private PostgreSQL database. Put this source in a GitHub repository you control, then in Render choose **New → Blueprint** and connect that repository. Render prompts for `ADMIN_EMAIL` and `ADMIN_PASSWORD`; use an email you control and a unique password with at least 12 characters. The initial admin must change that password after signing in. Render supplies the public `onrender.com` URL and HTTPS.

This option is for temporary demonstrations with synthetic data. Render's free web service sleeps after 15 minutes without traffic and can take about a minute to wake. Its filesystem is ephemeral, so uploaded documents can disappear after a restart or sleep. The free PostgreSQL database has a 1 GB limit, expires after 30 days, has no backups, and is eventually deleted unless upgraded. Do not enter real residents' identity documents, contact information, or payment data on this free demo. See [Render's current free-tier limits](https://render.com/docs/free).
