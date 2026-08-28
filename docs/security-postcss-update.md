# PostCSS security update

This temporary branch refreshes the npm lockfile so the transitive PostCSS dependency resolves to a patched release (>= 8.5.23), addressing the Dependabot alert for the incomplete GHSA-6g55-p6wh-862q fix.

The temporary lockfile-refresh workflows are removed from the branch after the generated lockfile commit lands, before merge.
