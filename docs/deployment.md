# Protected assessment preview

1. Create a dedicated Neon demo project and database. Get the **direct** owner URL. As the database owner, create `rtc_app` using `CREATE ROLE rtc_app LOGIN PASSWORD '<generated password>'`. Use a separate generated password. A SQL-created role should have no elevated memberships.
2. Run `npm run db:setup` with the direct owner URL in `MIGRATION_DATABASE_URL` and `RTC_RUNTIME_ROLE=rtc_app`. The setup script installs grants and seeds the four roles. Get a **pooled** URL for `rtc_app` with TLS enabled. Save the owner URL in your local secret store for migrations.
3. Create or link a Vercel project from the private GitHub repository. Enable **Vercel Authentication → Standard Protection** before deploying. Use Node.js 24 and Fluid compute.
4. Set `DATABASE_URL` to the restricted pooled URL in **Preview** only. Set `RTC_DEMO_ACCESS_CODE` to a random secret of at least 24 characters in **Preview** only. The app uses Vercel's system environment variables and disables the demo on Vercel Production. The owner URL and `RTC_LOCAL_DEMO` belong in local configuration.
5. Run `vercel deploy` or build a Git preview. Check that the anonymous preview request is gated and authorized reviewers can reach the demo entrance. Verify Operations intake, Manager approval, Operations milestones and recovery, Accounts closure and Admin configuration. Reload a job and confirm the state and audit entries persist. View Vercel function logs for errors. Share preview access and the reviewer code with the approved reviewers only.

Keep live RTC credentials, files and customer data out of this project. Disable the preview and revoke reviewer access when the assessment is over.
