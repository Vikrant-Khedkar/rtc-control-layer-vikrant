# RTC assessment walkthrough

Enter as **Operations**, choose **Guided tour** and select **Start at the enquiry inbox**. The tour shows hints on the actual workspace screens. It stays on as you open records, reload and switch roles. Choose **End tour** to dismiss the hints.

The setup seeds two complete and two incomplete enquiries. **Simulate incoming enquiries** loads a fresh batch. The assessment allows manual creation or import. The demo simulates a feed, and each imported enquiry belongs to Operations. Operations updates verified details and leaves an enquiry in **Needs Review** while anything is missing. Assignment in this walkthrough is for an exception on an active job.

Use **Switch profile** in the header, select a demo user, then choose **Continue as** that user. The app brings you back to the same enquiry or job. Allow about 6 minutes.

| Time | What to show |
|---|---|
| 0:00–0:40 | Start in the **Enquiry inbox** on God View. Open **Orchid Homewares** or **Delta Components** for a complete enquiry and review the details. |
| 0:40–1:35 | Open **Cedar Instruments** to test **Needs Review**. Verify the missing arrival port reason. Select **Edit details**, enter **Nhava Sheva** as the synthetic arrival port and save. Once it is ready, select **Draft internal quote**. |
| 1:35–2:20 | Show that Operations lacks the approval control. Switch to Manager on the same enquiry. Approve the quote and open the job. Explain the single transaction and one-job constraint. |
| 2:20–3:35 | Switch to Operations. Complete the first milestone. Raise a synthetic customs query, select the Operations assignee and enter a recovery action. Complete the remaining milestones. Billing is still blocked. Enter a resolution note and resolve the issue. |
| 3:35–4:15 | Switch to Accounts. Show **Billing ready**, close the job and reload. Point out the role, actor, time and details in audit history. |
| 4:15–5:05 | Switch to Admin. Open Configuration, change the gross margin and save. Switch to Operations and draft a fresh quote. The new draft reflects the change, while the first draft keeps its original total. For example, changing 15% to 20% changes the quote from ₹1,470.59 to ₹1,562.50. |
| 5:05–6:00 | Show the architecture diagram and the Postgres integration test results. Explain what the brief maps as mocks, the ownership of domain rules and the production path. |

For duplicate evidence, create another enquiry with the same intake reference and identical initial fields and show that the app opens the same record. For a direct unauthorized action, show the automated denial case in the integration test results.
