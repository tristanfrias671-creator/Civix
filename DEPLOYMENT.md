# CIVIX deployment

This repo is prepared for a demo deployment with Vercel (React client) and Railway (Express API + MySQL). Keep the Railway MySQL service private and place it in the same region as the API. The Railway MySQL template is unmanaged; configure backups and recovery before storing real citizen submissions.

## 1. Deploy the API and database on Railway

1. Create a Railway project and add a MySQL service. Select Singapore if it is available for the account and meets the organization's data-location requirements.
2. Add this GitHub repository as a service and set its root directory to `/server`.
3. Configure the build command as `npm ci && npx prisma generate`, the pre-deploy command as `npx prisma migrate deploy`, the start command as `npm start`, and the health check path as `/api/health`.
4. Set the API service variables in Railway:
   - `DATABASE_URL`: a private variable reference to the MySQL service's `MYSQL_URL`.
   - `JWT_SECRET`: a newly generated random secret; do not reuse a sample value.
   - `CLIENT_URL`: the final Vercel origin, with no path or trailing slash.
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
   - `GOOGLE_CLIENT_ID` and mail provider variables only if those integrations are enabled.
5. Enable scheduled database backups and document how to restore one. Do not expose MySQL through a public TCP proxy for application traffic.

`PORT` is assigned by Railway. Do not set `UPLOAD_DIR` for production unless it points to persistent storage; Cloudinary is already supported for submission photos and avatars.

## 2. Deploy the client on Vercel

1. Import the same GitHub repository into Vercel and set the project root directory to `client`.
2. Use `npm run build` as the build command and `build` as the output directory. `client/vercel.json` sends client-side routes back to the React app.
3. Set these Vercel build environment variables for Production (and Preview only if a preview API is configured):
   - `REACT_APP_API_URL`: the Railway API origin followed by `/api`.
   - `REACT_APP_SERVER_URL`: the Railway API origin, without `/api`.
   - `REACT_APP_GOOGLE_CLIENT_ID`: only if Google sign-in is enabled.
4. After Vercel assigns the final production domain, set the API's `CLIENT_URL` to that exact origin and redeploy the API.

## 3. Production account safety

Do not run `server/prisma/seed.js` against a public deployment. It inserts demo submissions and creates/resets accounts to the documented demo passwords. Create a separate production administrator with a unique password before launch, and remove demo accounts/data from any public environment.

The checked-in `.env` files are ignored by Git. Never commit provider credentials or paste them into chat; enter them directly in each provider's secret-variable screen.

## 4. Current access requirement

The local GitHub CLI credentials are invalid, and no Railway account session is configured. A signed-in GitHub account and Railway account are required to connect the repository, provision MySQL, and publish the API. Vercel also needs an authenticated account to publish a persistent project/domain. Once those provider sessions are signed in on this machine, the deployment can continue from these settings.
