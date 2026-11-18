# RTC assessment walkthrough

Run this from a fresh local demo or protected preview. Allow about 6 minutes.

| Time | What to show |
|---|---|
| 0:00–0:40 | Open God View. The **Jobs** grid shows the operational fields. **Enquiries & Quotes** is where work begins, before an approved job exists. |
| 0:40–1:35 | Enter as Operations, load a synthetic sample and clear Arrival port. Save. Point out **Needs Review** and the exact reason. Fill in the missing port, save, and draft the internal quote. Explain the mock cost and gross margin. |
| 1:35–2:20 | Show that Operations lacks the approval control. Switch to Manager on the same enquiry. Approve the quote and open the job. Explain the single transaction and one-job constraint. |
| 2:20–3:35 | Switch to Operations. Complete the first milestone. Raise a synthetic customs query, select the Operations assignee and enter a recovery action. Complete the remaining milestones. Billing is still blocked. Enter a resolution note and resolve the issue. |
| 3:35–4:15 | Switch to Accounts. Show **Billing ready**, close the job and reload. Point out the role, actor, time and details in audit history. |
| 4:15–5:05 | Switch to Admin. Open Configuration, change gross margin to 20% and save. Switch to Operations and draft a fresh quote. Its ₹1,562.50 quote reflects the new margin. The original ₹1,470.59 draft totals remain unchanged. |
| 5:05–6:00 | Show the architecture diagram and the Postgres integration test results. Explain what the brief maps as mocks, the ownership of domain rules and the production path. |

For duplicate evidence, create another enquiry with the same intake reference and identical initial fields and show that the app opens the same record. For a direct unauthorized action, show the automated denial case in the integration test results.
