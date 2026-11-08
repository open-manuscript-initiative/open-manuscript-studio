# Privacy configuration and legal operations

Prepared 7 November 2026. Applies to the Studio web/API/native clients and each
independently operated server. This implementation is not a legal certification.
No production settings, notices, mailboxes, retention jobs or firewall rules are
changed by merging the source. Missing operator facts remain required work.

## 1. Publish the selected server's controller information

1. Copy `deployment/privacy/privacy-notice.example.json` outside the checkout,
   for example `/etc/omi/privacy-notice.json`. Keep it operator-owned and readable
   by the API service. All fields are **public**; never put credentials, private
   evidence, unpublished manuscripts or internal connection strings in this file.
2. Complete the controller's legal name, postal address and monitored privacy
   email. Add `dpoEmail` only if a DPO is actually appointed. Identify the competent
   supervisory authority and its public HTTPS URL. Do not infer the controller
   from the domain name, project maintainer or hosting provider.
3. Set `noticeUrl` to the installation's complete, accessible HTTPS notice.
   Add one `processing` entry per actual purpose: account/authentication,
   collaborative/review/publishing work, security logs, optional integrations,
   and communications where applicable. Each needs data categories, a specific
   legal basis, retention criteria, recipients, and applicable international
   transfer mechanisms or an explicit statement that there is no such transfer.
   For legitimate interests identify the actual interest and balancing assessment;
   for consent explain withdrawal. Do not use consent as a blanket account basis.
4. Complete rights and complaint instructions, direct/indirect data sources,
   mandatory/optional fields and consequences of not supplying them, any automated
   decisions/profiling, cookies/device storage, backups and retained shared data.
   Mention access, rectification, erasure, restriction, objection, applicable
   portability and withdrawal where relevant. Cover Art.14 indirect collection
   separately where invitations/co-authors or third-party metadata make it relevant.
5. Publish understandable notice text in the languages of the actual users.
   UI labels support English, Hungarian and German; configured legal text retains
   its declared language. The UI does not silently machine-translate legal facts.
6. Only after factual review set `operatorReviewed: true`, and configure
   `OMI_PRIVACY_CONFIG_PATH=/etc/omi/privacy-notice.json` in the API environment.
   From `server`, run `npm run privacy:check` before restarting through the normal
   deployment procedure. The checker validates shape, **not legal compliance**.
7. Verify `/api/v1/privacy`, `/?privacy=1`, registration, sign-in and Account on web
   and the selected native server. Invalid configured files fail startup with a
   generic error. An absent file explicitly displays missing information; it does
   not manufacture a controller or claim compliance. Existing login is preserved.
   **Do not open public registration until the actual notice is complete.**

The example deliberately fails validation. No person, address, legal basis,
external recipient, DPO, authority, retention duration or operator approval has
been invented. Text is rendered as text, not authored HTML; public URLs must be
HTTPS without embedded credentials. Notices are not fetched by the server.

## 2. Receive and fulfil data-subject requests

The Account privacy section and the public notice provide a `mailto:` link to the
configured controller. It opens the user's mail application; it does not create
a tracked case or send a message by itself. The operator must monitor that
mailbox and offer an accessible alternative for people unable to sign in.

Keep a **restricted** case register outside public Git/CI with: case ID, received
at, request type/scope, verified identity, original one-calendar-month deadline,
assigned owner, system inventory, third-party-rights review, decision, response
at and final deletion date. Do not ask for an identity document by default.
Use proportionate identity verification and avoid collecting unnecessary proof.

Respond without undue delay, normally within one calendar month. Calculate the
calendar deadline (not a fixed 30-day timer). Where legally justified by complexity
or number of requests, inform the person within the original month of an extension
of up to two additional months and its reasons. Refusals need reasons and complaint
and judicial-remedy information. Withdrawal of consent must be as easy as giving it.

`GET /api/v1/account/data` returns only the authenticated user's explicitly selected
profile, additional email addresses, linked sign-in metadata, memberships, session
metadata and passkey labels. It returns no password hash, token, key or identity
provider raw profile. The download is private/no-store and rate-limited. Sections
over 1,000 rows are explicitly marked incomplete. This **account overview is not
a complete Art.15 response, complete Art.20 package or manuscript backup**.

For full access search both Identity and Studio stores, collaboration/review
history, submitted versions, service logs, support cases and relevant processors.
Review shared content to protect other people's rights and reviewer confidentiality;
provide a reasoned response rather than automatically exporting every shared record.
For portability check the consent/contract and automated-processing conditions,
then supply the applicable user-provided/observed data in a usable machine-readable
format. Use the normal manuscript exports where appropriate. Restriction and
objection need an actual processing decision; merely disabling login is insufficient.

## 3. Erasure, retained shared history and restoration

The existing self-service deletion removes live Identity data and credentials,
clears account integration records and pseudonymizes the Studio participant.
A stable participant ID or identifiable shared content can remain personal data.
**Pseudonymization is not anonymization**, and scholarly provenance alone is not
blanket permission for indefinite retention. Review the full record, lawful basis,
necessary scope and retention; assess research/publication exceptions individually.

The last-owner safety block must not indefinitely defeat an erasure request.
Offer a verified operator-assisted handover/alternative within the same request
process. Record and explain any lawful partial refusal. Review publication venues,
shared annotations, signatures, audit JSON, profile snapshots, object storage,
queues/caches and previous exports as well as the primary user table.

Keep a minimal, restricted erasure/restriction register for the approved backup
window. A restored backup must remain isolated until deletions/restrictions are
reapplied and obsolete sessions/credentials invalidated, before normal traffic or
external synchronization. Test this with synthetic accounts. The register itself
contains personal data and needs a purpose, access control and expiry.

The software cannot enforce a VPS backup rotation. Inventory all replicas,
snapshots and offsite/provider copies, set a justified maximum age, restrict access,
and test expiry plus recovery. Honour any previously published 30-day commitment;
do not silently extend it through this generic notice update. External OJS/OMP or
user-controlled cloud copies need the responsible destination's own procedure.

## 4. Retention and expiry cleanup

Maintain a restricted schedule for each store: purpose, legal basis, data owner,
retention trigger, maximum age/criteria, deletion/anonymization method, legal hold,
processor propagation and evidence of an executed job. Include access/auth logs,
review history, invitations, OAuth states, exports, support cases, audit events and
backups. No universal statutory log-retention period is assumed.

From `server`, `npm run privacy:cleanup` is **dry-run** and prints only counts of
expired authentication records. After reviewing counts and recovery needs,
`npm run privacy:cleanup -- --apply` deletes only expired sessions, invitations,
password reset tokens, passkey challenges and OAuth states in the Identity and
legacy Studio stores. It never removes live accounts, manuscripts or audit history.
Arrange an operator-reviewed timer/cron only after acceptance; this PR installs none.
Failures may leave partial progress and a later rerun is safe. Review other data
classes separately rather than treating this utility as full retention automation.

## 5. Personal-data breach procedure

Assign an incident owner, deputy and monitored security/privacy contacts. Detect,
contain, preserve restricted evidence, record when the organization became aware,
and assess confidentiality, integrity and availability impacts on people.
Register **every personal-data breach**, including the reasons for not notifying.

The processor informs the controller without undue delay. A controller notifies
the competent supervisory authority without undue delay and, where feasible,
within 72 hours of awareness unless the breach is unlikely to risk individuals'
rights/freedoms. Explain delays and provide information in phases if needed.
Inform affected people without undue delay where the breach is likely to create
high risk, subject to the legal exceptions. Do not automatically send private logs
or manuscripts to GitHub, providers, authorities or users.

Restricted incident record: ID; discovery/awareness UTC; reporter/owner; affected
systems and data categories; approximate people/records; likely consequences;
containment and recovery; risk and notification decisions/reasons; authority and
individual notifications/times; processor notices; corrective actions; review date.
Use synthetic tabletop and restore exercises to test responsibilities and timing.

## 6. Institutions, providers and international transfers

Map controllers/processors/joint controllers per activity. A software maintainer
is not automatically controller for an institution's independently hosted data.
Where hosting/processing is on an institution's behalf, conclude the Art.28
agreement before processing: scope, duration, data/people, instructions,
confidentiality, security, subprocessor authorization/change notification,
rights/incident assistance, deletion/return, audits and international transfers.

Inventory actual hosting, mail, OJS/OMP, Office, identity, storage, translation,
reference/research and AI providers, including locations, recipients, subprocessors
and enabled data flows. Record applicable adequacy decisions or safeguards and
required transfer assessments; user initiation of a connection does not waive
these obligations. Disable unused integrations and minimize transmitted content.
Perform DPIA screening before high-risk deployments, especially sensitive or
large-scale research data. Assess Art.9 conditions where special-category data
is involved, Art.30 records and Art.37 DPO criteria; do not declare them universal
or automatically exempt a small provider from recurring processing records.

## 7. Cookies and device storage

Inventory cookies, local/session storage and SDK/network behavior on web/native
and the documentation site. The current change adds no tracking, analytics or
consent checkbox. Classify by actual purpose; not every local-storage use is exempt.
If all storage is strictly necessary for a requested service, explain it without
an unnecessary consent banner. Before adding optional tracking, implement prior
purpose-specific opt-in, equally accessible refusal, withdrawal and a minimal
consent record. Prevent the optional technology from running before choice.

## 8. Conditional regulatory register

Keep each decision with legal entity, deployment/service scope, evidence,
responsible owner and next review date. No eligibility decision is made by code.

| Regime | Required determination and resulting work |
| --- | --- |
| Hungarian cybersecurity law / NIS2 | Assess the actual operator's sector, size and designation under Act LXIX of 2024; covered operators need the applicable registration, risk/security, incident and audit duties. Software use alone does not determine scope. |
| Cyber Resilience Act | Assess manufacturer/commercial distribution versus noncommercial FOSS or qualifying steward roles and remote-processing scope. In-scope manufacturer Art.14 reporting applies from 11 September 2026 (24h early warning / 72h notification); the main obligations apply from 11 December 2027. Steward Art.24(3) reporting starts 11 December 2027. Prepare vulnerability handling, supported-update policy, technical documentation/SBOM, required conformity evidence and reporting only for the applicable role/scope. No CE/compliance claim is created here. |
| Accessibility | Assess public-sector operator obligations under Act LXXV of 2018, and separately EAA-covered services/products and exemptions. Where applicable provide tested keyboard/screen-reader access, an accurate accessibility statement, feedback and enforcement contacts. Automated UI tests alone are insufficient. |

Before declaring compliance, fill the controller notice, assign real staff,
activate and verify actual retention/backup processes, sign necessary agreements
and obtain the relevant role/scope assessments. A source merge is not that evidence.

## Official references

- [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj): Arts.5–6, 9, 12–22, 25, 28, 30, 32–37, 44–49 and 89.
- [EDPB: individual rights](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en).
- [EDPB: cookie consent](https://www.edpb.europa.eu/contact/frequently-asked-questions_en).
- [Commission: breaches](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en).
- [CRA open source](https://digital-strategy.ec.europa.eu/en/policies/cra-open-source), [reporting](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting), [implementation](https://digital-strategy.ec.europa.eu/en/factpages/cyber-resilience-act-implementation).
- [Hungarian cybersecurity act](https://njt.jog.gov.hu/jogszabaly/2024-69-00-00).
- [Hungarian public-sector accessibility act](https://njt.jog.gov.hu/jogszabaly/2018-75-00-00).
- [EAA scope](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=legissum:4403933).

## API compatibility and architecture

Use `/api/v1/privacy` and `/api/v1/account/data` for new clients. The original
`/api/privacy` and `/api/account/data` remain shared-handler compatibility facades
with deprecation headers and content-free route-usage events. There is no removal
date yet. Both aliases share authentication, no-store behaviour and the same export
quota; switching paths cannot reset it. Deploy the API before updated clients.

The executable DTO/error contract and generated OpenAPI are described in
[ADR-034](../architecture/adr-034-privacy-api-and-account-overview.md). Existing
identity/API/privacy release gates include `npm run test:privacy`; source tests do
not replace operator notice review or deployed-system acceptance. No new database
migration is introduced by this boundary repair.
