# OMP complete-volume receiver (server slice)

The OMP plugin's dedicated volume assertion is accepted only by the volume verifier. The Studio checks exact scope, actor, press and current publication identity, trusted installation origin, signature, expiry and durable one-time launch nonce. The ordinary manuscript receiver rejects volume grants.

The signed manifest is validated before fetching any source. Edited volumes prefer a complete ordered set of chapter files; authored works prefer a complete manuscript. If only one complete representation exists it is selected, never both. A partial chapter set with no whole manuscript fails without handoff. Chapter metadata remains available even for a full-manuscript source; no chapter boundaries are guessed.

Downloads use the existing pinned OMP transport with same-origin redirects, 8 MiB manifest, 32 MiB per source and 64 MiB aggregate source limits. Converted handoff data is limited to 32 MiB; at most two simultaneous imports and eight pending handoffs are allowed. Source conversion reuses rich DOCX semantics including notes, references and tables. A separate ten-minute single-use handoff is issued only after complete conversion.

The dedicated GET /integrations/omp/volume-launch endpoint currently returns a JSON handoff token. GET /integrations/omp/volume-handoff/:token consumes it. Browser project assembly and progress UI are not enabled in this slice; the OMP launch UI must remain disabled until those are implemented. Native integration, browser E2E and memory/large-volume testing remain required.
