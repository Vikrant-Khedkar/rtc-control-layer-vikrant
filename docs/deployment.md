# Assessment preview

The preview uses the dedicated Neon project `rtc-control-layer-demo`. Use **Share → Copy Link** on the current assessment deployment to copy its public link. Reviewers choose one of the four synthetic profiles and work in a shared demo workspace.

On 18 November 2026, the deployed workflow test verified quote pricing from Admin configuration, approval from the Manager queue, one job for the quote, the billing block during an open exception, and Accounts closure after resolution. Closure persisted after reload and History showed the event actors. The default margin was restored to 15%.

## Prepare the release

- [ ] Run `npm ci`, `npm run typecheck`, `npm run test:local`, and `npm run build` from the release checkout. Use a separate local test database for the integration suite.
- [ ] Confirm the release commit is in the GitHub repository and environment files are excluded from the release.

## Set up Neon

- [ ] Create a dedicated Neon demo project and database. Use synthetic data throughout.
- [ ] Connect as the database owner and create a restricted runtime login with SQL. Use a generated password for `rtc_app`.

  ```sql
  CREATE ROLE rtc_app LOGIN PASSWORD '<generated-password>';
  ```

  [Neon role management](https://neon.com/docs/manage/roles)

- [ ] Set `MIGRATION_DATABASE_URL` to the **direct owner URL** and `RTC_RUNTIME_ROLE=rtc_app` in your local shell, then run `npm run db:setup`. It applies migrations and grants, then seeds the four demo profiles, enquiries, and sample jobs.
- [ ] Get the **pooled `rtc_app` URL** with TLS for Vercel. Keep the owner URL in your local secret store. [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)

## Deploy a Vercel Preview

- [ ] Create a Vercel Next.js project for the source repository. Use Node.js 24 and enable Fluid compute.
- [ ] Under **Deployment Protection**, enable **Vercel Authentication → Standard Protection**. [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
- [ ] Under **Environment Variables**, keep system environment variables enabled. The app uses `VERCEL` and `VERCEL_ENV` to recognize a preview. [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [ ] Set `DATABASE_URL` for **Preview** only, using the TLS-enabled pooled Neon URL for `rtc_app`. Set `RTC_PUBLIC_DEMO=1` on the assessment deployment. Keep `MIGRATION_DATABASE_URL`, `RTC_RUNTIME_ROLE` and `RTC_LOCAL_DEMO` in the local setup.

- [ ] If Vercel requires an initial Production deployment, use a standalone static placeholder with no app source or environment variables. The public URL for this project serves only that placeholder.
- [ ] Deploy the release commit with `vercel deploy -e RTC_PUBLIC_DEMO=1` from a clean checkout linked to the Vercel project. Use the generated **Preview URL**. [Vercel preview deployments](https://vercel.com/docs/projects/deploy-from-cli)

## Verify the deployed demo

- [ ] Open the shared link in an incognito window. Choose a demo profile and verify God View loads directly.
- [ ] As **Operations**, import a synthetic enquiry and draft its quote. As **Manager**, approve it and confirm one job appears in **Job execution**.
- [ ] As **Operations**, raise and assign an exception, finish the milestones, and confirm billing remains blocked. Resolve the exception and confirm the job moves to **Billing ready**.
- [ ] As **Accounts**, close the job. Reload and verify it stays closed and **History** shows approval, milestones, exception recovery, and closure.
- [ ] As **Admin**, confirm Configuration opens and a change applies to new work. Restore the demo defaults after the check. Check Vercel runtime logs for errors.

## Prepare the handoff

- [ ] Copy the public link from the preview’s **Share** dialog. [Vercel preview sharing](https://vercel.com/docs/deployments/sharing-deployments)
- [ ] Confirm the brief’s submission format and video length before sharing the source or recording. Record the walkthrough against the verified preview and add the final video link and actual time spent to the README.
