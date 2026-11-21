# In-app feedback / Alkalmazáson belüli visszajelzés

## Purpose / Cél

The same **Send feedback / Visszajelzés küldése** action is available in the shared Studio navigation on Android, iOS, desktop and web. The three report types are **bug**, **suggestion**, and **testing experience**. Test reports may indicate a successful test or a problem. Reports are not Google Play usage measurements and do not substitute for Play Console closed-testing eligibility.

A visszajelző űrlap a közös Súgó melletti menüpontból nyitható meg. A felhasználó hibát jelenthet, fejlesztést javasolhat, vagy beszámolhat egy teszt eredményéről. **A beküldött tesztjelentés nem bizonyítja a Google Play telepítést vagy használatot.**

## Data flow / Adatfolyam

1. The authenticated client sends JSON to `POST /api/v1/feedback` using the selected server's normal Studio API transport, including native bearer authentication.
2. The server validates the strictly allow-listed fields and applies **6 requests per authenticated account per hour**.
3. If `OMI_FEEDBACK_RECIPIENT` is configured, the local sendmail-compatible transport accepts a plain-text report addressed to that recipient.
4. Only after successful transport handoff does the server respond `201 { "id": "OMI-<uuid>", "received": true }`.
5. On failure, the client preserves form values and offers **Copy report text**. No in-app historical report archive or automatic retry queue is created.

The receiver is **disabled by default**. It does **not** forward reports to `openmanuscript.org` unless an instance operator deliberately configures that address. Feedback from an institutional Studio stays under that institution's selected server/operator.

### Configuration / Beállítás

In the Studio API server's environment (Plesk/systemd/compose as applicable):

```dotenv
MAIL_FROM=Open Manuscript Studio <no-reply@openmanuscript.org>
SENDMAIL_PATH=/usr/sbin/sendmail
OMI_FEEDBACK_RECIPIENT=contact@openmanuscript.org
```

The address above is an **example for the central OMI server only**. Institutional operators must supply their own managed mailbox. Leave the variable unset to disable the endpoint. Confirm sendmail operation and mail forwarding before enabling the feature. Deploy the API before rolling out updated clients.

The feedback form and recipient e-mail are localized in Hungarian, German, English, French, Italian, Spanish, Dutch and Polish. Other supported Studio interface locales currently fall back to English for this particular feature; their general Studio localization remains unchanged.

## Privacy / Adatvédelem

- No automatic document text, manuscript identifier, citation, note, screenshot, stack trace, raw log, token, precise location or device ID is included in the JSON report.
- App version, broad platform name and interface language in **diagnostic metadata** are sent only when the user opts in (checkbox off by default).
- The form sends a minimal `messageLocale` code independently of diagnostics so the server can format field names and enumerated values in the chosen interface language; no document or device fingerprint is attached.
- Contact e-mail is optional and entered manually. Login is required for misuse control, but the report itself does not add the account identifier or account e-mail.
- The report is held in the operator's **mailbox**, not a new Studio database table. This makes the operator's mail retention, access policy, backup rotation, deletion and subject-access procedures relevant. For the central OMI instance, align mailbox deletion with the published one-month default unless a documented legal retention exception applies.
- The operator must update the public privacy notice to cover feedback mail processing and verify its real retention configuration **before** enabling the receiving address.
- No analytics SDK, Play device tracking or permanent activity ledger is added.

## API response codes

| Code | Meaning |
| --- | --- |
| 201 | Accepted by the local mail transport; returns report ID |
| 400 `INVALID_FEEDBACK` | Missing or rejected fields, unsupported fields |
| 401 `NOT_AUTHENTICATED` | Studio authentication required |
| 429 `FEEDBACK_RATE_LIMITED` | Account-level throttle |
| 503 `FEEDBACK_DISABLED` | No receiving mailbox configured |
| 503 `FEEDBACK_DELIVERY_FAILED` | Local mail transport did not accept message |

## Acceptance checklist / Ellenőrzőlista

- [ ] Android closed-test build: login, open main menu > Send feedback and submit a test result; verify local mailbox receives identical fields and receipt ID.
- [ ] Web and native clients: account/session credentials are forwarded only to the selected trusted Studio server.
- [ ] With technical checkbox **off**: inspect request payload; no `technical` object is sent; `messageLocale` alone is permitted for translation.
- [ ] With checkbox **on**: only version, broad platform and locale are sent.
- [ ] Missing mailbox: 503 and unchanged text; copy action still works.
- [ ] Network failure: the form keeps the entered contents.
- [ ] Invalid report (too long or unexpected fields): 400; email transport is not invoked.
- [ ] Six submitted reports from one account are permitted within one hour; the next is throttled; another account is not affected by a shared NAT IP.
- [ ] No document contents or personal data is automatically inserted into reports.
- [ ] Verify multilingual e-mails for hu/de/en/fr/it/es/nl/pl, HTML/mail-client charset decoding, and unsupported-language English fallback.
- [ ] Verify the mailbox retention and update the actual operator's published privacy notice.
- [ ] Recheck Google Play Data safety answers and the app privacy-policy URL before uploading the updated closed-test AAB; optional contact and feedback data must be accurately disclosed.
- [ ] Confirm accessible labels, keyboard navigation and mobile touch targets.

Run `npm run test:studio-feedback` for the strict contract checks, then normal build/CI and on-device manual acceptance. **Passing unit checks does not demonstrate successful e-mail delivery or Play Console testing activity.**
