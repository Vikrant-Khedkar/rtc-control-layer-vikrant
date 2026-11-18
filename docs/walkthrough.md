# RTC assessment walkthrough

For the guided version, enter the workspace and choose **Guided tour**. Each button performs one real action using synthetic data. The tour shows the current role and offers a direct switch when the next action requires a different role. Reloading the same tour URL keeps your place. Select **Run another tour** after closing a job to start a fresh case.

For the manual version below, use the role dropdown in the header and click **Switch role**. The app keeps you on the same enquiry or job. Allow about 6 minutes.

| Time | What to show |
|---|---|
| 0:00–0:40 | Open God View. The **Jobs** grid shows the operational fields. **Enquiries & Quotes** is where work begins, before an approved job exists. |
| 0:40–1:35 | Enter as Operations, load a synthetic sample and clear Arrival port. Save. Point out **Needs Review** and the exact reason. Fill in the missing port, save, and draft the internal quote. Explain the mock cost and gross margin. |
| 1:35–2:20 | Show that Operations lacks the approval control. Switch to Manager on the same enquiry. Approve the quote and open the job. Explain the single transaction and one-job constraint. |
| 2:20–3:35 | Switch to Operations. Complete the first milestone. Raise a synthetic customs query, select the Operations assignee and enter a recovery action. Complete the remaining milestones. Billing is still blocked. Enter a resolution note and resolve the issue. |
| 3:35–4:15 | Switch to Accounts. Show **Billing ready**, close the job and reload. Point out the role, actor, time and details in audit history. |
| 4:15–5:05 | Switch to Admin. Open Configuration, change the gross margin and save. Switch to Operations and draft a fresh quote. The new draft reflects the change, while the first draft keeps its original total. For example, changing 15% to 20% changes the quote from ₹1,470.59 to ₹1,562.50. |
| 5:05–6:00 | Show the architecture diagram and the Postgres integration test results. Explain what the brief maps as mocks, the ownership of domain rules and the production path. |

For duplicate evidence, create another enquiry with the same intake reference and identical initial fields and show that the app opens the same record. For a direct unauthorized action, show the automated denial case in the integration test results.
