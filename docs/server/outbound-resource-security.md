# Outbound-resource security boundaries

## PDF rendering

The authenticated publication PDF endpoint invokes Vivliostyle on user-supplied HTML. Treat all manuscript HTML as untrusted. The server rejects active HTML, imports, and non-embedded subresources, including unquoted `src`, `poster`, `data`, SVG `href`, and `srcset` attributes. Before passing a document to the renderer, it adds an early HTML Content Security Policy that allows **only embedded images, fonts and inline CSS**. External hyperlinks (`<a href="https://…">`) may remain as PDF annotations; they are not permission to fetch that URL during rendering.

The HTML validation and CSP are complementary, not interchangeable. PDF workers should execute as **unprivileged, resource-constrained processes with outbound network access denied**. Apply limits on concurrency, CPU, memory and wall-clock execution at the deployment level. Test the generated PDF on representative fonts, SVG, and MathML before production rollout.

## WebDAV / Nextcloud connections

The cloud connection form accepts a user-supplied HTTPS WebDAV endpoint. The server rejects private or special-purpose DNS results, including loopback, RFC 1918, link-local/metadata, carrier-grade NAT, IPv4-mapped IPv6 and IPv6 transition prefixes, and refuses redirects. Do not loosen this filtering to support an internal Nextcloud host on a public multi-tenant Studio.

The direct WebDAV/Nextcloud transport now uses a fresh, checked A/AAAA answer
**at socket connection time**: it does not perform a separate unrestricted
DNS lookup after validation. It preserves TLS hostname verification and
does not follow redirects. This protects that one connector, not all API
outbound request paths.

**DNS rebinding remains a separate deployment concern**: an address can resolve differently between validation and the actual outbound connection. Production must enforce an egress firewall or equivalent network policy that prevents the Studio API/worker from reaching loopback, RFC 1918 and link-local ranges, cloud metadata endpoints and other internal services, even if DNS changes.

For intentionally self-hosted internal Nextcloud systems, use a dedicated private Studio installation and a separately reviewed network policy rather than a global exception to the URL safety checks.

## Verification

Run `npm run test:release-security` and `npm run test:vivliostyle-pdf` in CI. These checks do not replace a live egress-policy test or penetration assessment. No secret values should appear in repository files, logs, manuscript exports or rendered content.
