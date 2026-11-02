# Security acceptance reconciliation — 2026-11-02

Reviewed source: `7c4b2826e7b6a2d718f45fced917e9cfab4d42a9`.
Decision: [ADR-031](../architecture/adr-031-outbound-security-and-acceptance.md).
This is a record of known evidence and pending receipt mapping, not a completed
release receipt or an instruction to reopen issues. It changes no runtime policy.

| Gate | Issue state observed 2026-11-02 | Available evidence | Receipt status / next owner action |
|---|---|---|---|
| `host-pdf-sandbox` | #774 closed 2026-11-01 15:35:19 UTC | [Concurrent/per-owner jobs](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/774#issuecomment-6559798888), [idle process cleanup](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/774#issuecomment-6559820812), merged #819 process-group cleanup and synthetic timeout tests | Exact candidate mapping not supplied by this document. Operator links existing controlled timeout/recovery and host isolation records, including deployed SHA/environment/time; release owner accepts them against the candidate. |
| `host-egress` | #765 closed 2026-11-01 17:02:52 UTC | [Original staged plan](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6560592698); merged #822 shared-UID service policy, #823–#825 protected transport/IdP/Office paths | The earlier dedicated-UID plan is superseded for this Plesk topology. Operator links effective service policy, IPv4/IPv6 negative results, positive DB/login/cloud/PKP/Office regressions, rollback and persistence observations. Record localhost/public egress and helper-coverage residuals explicitly. |
| `security-review` | Independent of issue closure | 22 focused synthetic/mocked source tests passed; public HTTPS, exact-origin and no-redirect compatibility documented | Candidate CI/CodeQL/PKP results and owner-reviewed residual risks still required; other providers/HTTP helpers need their own inventory. |

## Final record to attach to the existing receipt

For each gate, record: gate ID; source/deployed SHA; candidate build/run IDs and
artifact hashes where relevant; environment scope; observed-at timestamp; owner;
result; accepted evidence HTTPS reference; residual risks; reviewer/approval.
Use the existing `RC_MANUAL_GATES` / `rc-evidence.mjs` format rather than inventing
a second approval contract. Every gate must still be `pass` and match the
candidate before release publication.

Find and reconcile existing operator evidence first. Perform only identified
missing tests in staging or approved maintenance. Never force a production hang,
change UID/firewall or weaken sandboxing merely to produce screenshot evidence.
An owner report of working cloud/OJS/PDF establishes that observed positive flow;
it does not supply the result of every negative network/timeout test.

Evidence references may be access-controlled HTTPS records. Keep credentials,
full query-token URLs, raw host inventories and private manuscript content,
titles, filenames, author metadata and local paths out of public Git/CI. Do not
copy private manuscripts into regression fixtures. Do not fill a missing result
with a green marker inferred from issue state.
