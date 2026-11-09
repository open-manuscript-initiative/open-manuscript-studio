# Central Android closed-test signup

This is an **opt-in applicant list**, not a Google Play enrolment API. Only the central
OMI service should run it. It does not create Studio accounts or change manuscript
permissions. The public website is `https://openmanuscript.org/android-test/`.

## Deployment and activation

1. Merge and deploy the API PR. Apply the main PostgreSQL migration using
   `npm --prefix server run prisma:migrate:deploy` (or the existing production
   deployment migration step) **before** enabling the endpoint.
2. Verify that `MAIL_FROM` and `SENDMAIL_PATH` can deliver password-reset
   mail; signup confirmation uses the same local sendmail-compatible transport.
3. On the **central** API only, configure
   `OMI_ANDROID_TEST_SIGNUPS_ENABLED=true` and
   `OMI_ANDROID_TEST_ORIGIN=https://studio.openmanuscript.org`.
   The default is **disabled** so institutional/federated installations never
   unintentionally run a central Google Play intake programme.
4. Deploy the OMI website PR after the API is live. Confirm a test signup
   with a non-production Google Account and verify that an email is delivered,
   the link requires an actual confirmation-button POST, cancellation works,
   and the confirmed applicant appears in the administrator-only export.
5. Run the normal API and site CI suites before merging/promoting.

### Google Play Console

In the **Closed testing** track for `org.openmanuscript.studio`,
set up a dedicated e-mail tester list (or an authorised Google Group).
Only verified requests should be added. The existing opt-in link is:

`https://play.google.com/apps/testing/org.openmanuscript.studio`

From a trusted server console, export confirmed applicant addresses:

```bash
cd /path/to/open-manuscript-studio/server
node dist/cli/exportAndroidTestSignups.js > /root/omi-android-verified-testers.csv
chmod 600 /root/omi-android-verified-testers.csv
```

The CSV contains **one e-mail address per line without BOM**. The Play Console
CSV upload **replaces** the existing addresses in that particular list. Reconcile
previous testers before import, or use a separate intake list. Never publish,
commit, or attach the CSV to an issue. Delete the local export after use.

An applicant is **not yet** a Play tester after e-mail confirmation.
The administrator must grant test eligibility; the applicant must then
open the opt-in link and explicitly select *Become a tester*.
Google Play may show a different build from the direct-download RC APK.

## Security and privacy

- POST requires the relevant email address, explicit consent and validated
  language. A hidden honeypot and IP-based per-endpoint throttling limit spam.
- A random 256-bit one-time e-mail confirmation token is stored only as a
  SHA-256 digest. Confirmation is completed by POST to prevent link-scanners
  from consenting on the applicant's behalf. Links expire in 48 hours.
- The cancellation link is also random; its digest is stored separately.
  Removing a registration does not automatically remove existing Google
  Play / Google Group access: an administrator must reconcile the Play list.
- Pending applications are retained for up to seven days; confirmed ones
  for up to 180 days. Stale records are pruned on submissions and during
  the administrator export. Arrange daily administrator export/pruning or
  end-of-test deletion if there is no incoming signup traffic.
- The test applicant table has no name, password, Studio account relationship,
  document contents or account identifier. It only stores email, token digests
  and timestamp metadata. No applicant list is exposed to an HTTP client.
- The API defaults to disabled and keeps a scoped CORS allow-list for the
  public OMI website. Other authenticated API CORS rules remain unchanged.
- Record the actual central controller, privacy contact, retention, and
  Google Play/Google Groups recipients in the **central server privacy notice**
  before enabling the form. In particular, never imply that pressing Submit
  grants Google Play eligibility.
