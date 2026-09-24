# CIVIX demo deployment

The no-cost demonstration route is a Vercel static client, a Render Free Express API, and a TiDB Cloud Starter MySQL-compatible database. This is for demos with synthetic data only. Render Free can sleep after 15 minutes without traffic, can take about a minute to wake, and has an ephemeral filesystem; uploaded files stored locally can disappear after a restart, sleep, or deploy. TiDB Starter has monthly free quotas and uses the MySQL protocol; Prisma compatibility must be confirmed by a successful migration before the demo is used.

Vercel Hobby is limited to personal, non-commercial use. Render says its free services are not for production. Do not use this free route for an official government service or real citizen records. Use an organization-approved paid host with backups, access controls, and data-location approval for that purpose.

## 1. Create the database

1. Create a TiDB Cloud Starter instance and database named `civix`. Choose Singapore if available and appropriate for the demo.
2. Create a database named `civix`, a read/write SQL user for the API, and a separate admin SQL user for schema migrations. Use TLS-enabled MySQL connection strings and keep both private. Percent-encode special characters in usernames or passwords before putting them in URLs.
3. Do not add real citizen data. First deployment runs `prisma migrate deploy` to create the tables.

TiDB Starter's documented free quota is up to 5 GiB row data, 5 GiB columnar data, and 50 million request units per instance each month. TiDB supports the MySQL protocol and common MySQL syntax, but that does not by itself guarantee that this Prisma schema and migration set will work unchanged. Treat a successful deployment migration and health check as a required compatibility check.

## 2. Deploy the API on Render

1. In Render, create a Blueprint from `https://github.com/tristanfrias671-creator/Civix`, branch `main`. The repository contains `render.yaml`; select the Free plan and Singapore region.
2. Enter the API user's TLS connection string as `DATABASE_URL`, the migration admin user's TLS connection string as `MIGRATION_DATABASE_URL`, and the exact Vercel production origin as `CLIENT_URL`. Render generates `JWT_SECRET`; keep it secret. Do not add a payment method for this demo. Render notes that accounts with a payment method can be billed for overage bandwidth or build-pipeline usage.
3. The startup wrapper runs Prisma migrations with the admin URL, then removes that URL from the API process before loading the app. The API itself uses the read/write SQL user.
4. After the API deploys, copy its `onrender.com` origin and visit `/api/health`. It should return JSON with `status: "ok"`.

The Blueprint runs Prisma migrations on service startup because Render's separate pre-deploy command is not available on Free services. It does not run the demo seed script.

## 3. Deploy the client on Vercel

1. Sign in to the intended Vercel account and import the CIVIX GitHub repository. Set the root directory to `client`, build command to `npm run build`, and output directory to `build`.
2. Add Production environment variables:
   - `REACT_APP_API_URL`: the Render API origin followed by `/api`.
   - `REACT_APP_SERVER_URL`: the Render API origin, without `/api`.
   - `REACT_APP_GOOGLE_CLIENT_ID`: only if Google sign-in is configured.
3. Deploy the client and copy its production origin. Add that exact origin as `CLIENT_URL` in the Render API environment, then redeploy the API.

`client/vercel.json` sends client-side routes back to the React app.

## 4. Create the administrator

Do not run `server/prisma/seed.js` against the public demo. It inserts sample accounts and submissions and refuses to run in production.

For a Render Free service, create the first administrator from a trusted local checkout that can connect to the TiDB public endpoint. Allowlist only the developer's current IP in TiDB, set `DATABASE_URL`, `CIVIX_ADMIN_NAME`, `CIVIX_ADMIN_EMAIL`, and a unique `CIVIX_ADMIN_PASSWORD` of at least 16 characters in the local process environment, then run `npm run admin:create` from `server`. The command hashes the password and refuses to overwrite an existing account. Remove those temporary variables immediately and remove the IP allowlist entry after setup if remote administration is not needed.

## 5. Uploaded files

Without Cloudinary, CIVIX stores uploads on the API's local filesystem. Render Free does not preserve those files after a sleep, restart, or deployment. Do not rely on local uploads for this demo. To keep image uploads, configure a dedicated Cloudinary account by adding its three secret environment variables (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) directly in Render. Never paste provider credentials into chat or commit them.

## 6. Existing Railway project

The Railway screenshot showed an expired trial for `shopelite-backend`, which is a different repository. It is paused and cannot host CIVIX unless that Railway account is upgraded. No plan upgrade or charge has been made.
