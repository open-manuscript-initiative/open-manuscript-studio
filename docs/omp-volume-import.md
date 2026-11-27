# OMP complete-volume receiver (server slice)

The OMP plugin's dedicated volume assertion is accepted only by the volume verifier. The Studio checks exact scope, actor, press and current publication identity, trusted installation origin, signature, expiry and durable one-time launch nonce. The ordinary manuscript receiver rejects volume grants.

The signed manifest is validated before fetching any source. Edited volumes prefer a complete ordered set of chapter files; authored works prefer a complete manuscript. If only one complete representation exists it is selected, never both. A partial chapter set with no whole manuscript fails without handoff. Chapter metadata remains available even for a full-manuscript source; no chapter boundaries are guessed.

Downloads use the existing pinned OMP transport with same-origin redirects, 8 MiB manifest, 32 MiB per source and 64 MiB aggregate source limits. Converted handoff data is limited to 32 MiB; at most two simultaneous imports and eight pending handoffs are allowed. Source conversion reuses rich DOCX semantics including notes, references and tables. A separate ten-minute single-use handoff is issued only after complete conversion.

The dedicated GET /integrations/omp/volume-launch endpoint redirects to the Studio with a one-time handoff token. The browser consumes it and atomically assembles a native volume or monograph. Separate chapters become editable studies with stable external identity mappings; shared contributors are unified by native author ID. Whole-book sources retain their DOCX hierarchy, with chapter metadata stored but no guessed boundary mapping. Open copies are not overwritten. Progress, persistent reimport reconciliation and native launch UI remain subsequent work. Native browser E2E and memory/large-volume testing remain required.

## Import progress

The launch redirects immediately to a random OMP-only progress ticket in the URL fragment. The UI polls a no-store status route and displays real completed source counts, download/conversion phases and localized labels (en, hu, de, fr, it, es, nl, pl). A whole book counts as one source rather than as its number of chapters. Only a complete import yields a one-time handoff. Login redirects preserve the volume handoff through the existing session storage mechanism. OJS progress tickets and OMP progress tickets are isolated. Browser E2E testing is still required before native launcher activation.

## Press, series and format identifiers

The optional OMP publication matter snapshot is retained with the imported origin. Publisher, place, localized series title, print and online ISSN and unambiguous physical/digital ISBNs populate native book front matter. Multiple ISBNs in a format group are kept in the snapshot instead of choosing an arbitrary edition. Shortcodes [omi:electronic-isbn], [omi:series], [omi:series-number] and [omi:press] complement existing publisher, ISBN and DOI codes; original chapter titles supply requested-language contents when available. Missing translations remain unresolved.

## Reimport review

A repeated launch of an already open volume selects its existing tab and compares upstream source fingerprints, chapter identities and metadata. Existing text, layout, chapter order and identities are never overwritten. Older imports without source fingerprints are reported as not verifiable. Publisher and series metadata can be refreshed explicitly only for the same publication and representation, with field-level local conflict detection. New/changed/removed chapters are listed for review; chapter insertion, replacement, cross-version lineage resolution and persistent saved-document discovery remain future work.

## Additive chapter reconciliation

Explicitly add new native chapters at the end of the existing volume without changing local content, order or layout. New imports persist exact native contributor-to-agent mappings; additions reuse verified local identities and preserve chapter-specific source/contributor fingerprints. Older volumes without identity mappings block additions involving existing contributors instead of guessing. Publication version or work-type/representation changes also block additions. Replacements and persistent saved-volume lookup remain separate work.

## Individual chapter review

A changed mapped chapter can be compared as a bounded plain-text preview of its original imported revision (when still available), local text, and new OMP source. The preview is not a formatting or full scholarly-object diff. The editor can explicitly retain the local version, recorded as a versioned decision bound to the exact incoming chapter/source/contributor fingerprint; a later upstream change invalidates the decision. Source provenance is never advanced by retaining local text. Destructive replacement or cross-chapter anchor remapping is not yet enabled.
