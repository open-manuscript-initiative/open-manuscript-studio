import { resolvePublicationProfile } from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';
import {
  type PreparedWebPublicationArtifact,
  type WebPublicationAssurance,
} from '../integrations/webPublicationContract';
import { BUILD_INFO } from '../version';
import {
  OMI_HTML_PUBLICATION_RENDERER_VERSION,
  buildPublicationHtmlArtifact,
  publicationHtmlFileName,
} from './publicationHtmlArtifact';
import { createPublicationBuildManifest } from './publicationBuildManifest';

export const OMI_WEB_PUBLICATION_RENDERER_VERSION = '0.1.0' as const;

export async function prepareWebPublicationArtifact(
  manuscript: OmiManuscript,
  assurance: WebPublicationAssurance,
): Promise<PreparedWebPublicationArtifact> {
  const profile = resolvePublicationProfile(manuscript);
  const rendered = await buildPublicationHtmlArtifact(manuscript, profile);
  const html = addAssuranceDisclosure(rendered, manuscript.locale, assurance);
  const bytes = new TextEncoder().encode(html);
  const fileName = publicationHtmlFileName(manuscript);
  const build = createPublicationBuildManifest({
    manuscript,
    profile,
    artifact: bytes,
    output: {
      format: 'html',
      mediaType: 'text/html;charset=utf-8',
      fileName,
    },
    generator: {
      applicationVersion: BUILD_INFO.version,
      applicationBuild: optionalBuildValue(BUILD_INFO.build, '0'),
      applicationCommit: optionalBuildValue(BUILD_INFO.commit, '-'),
      renderer: 'open-manuscript-studio-web-publication',
      rendererVersion: `${OMI_WEB_PUBLICATION_RENDERER_VERSION}+html-${OMI_HTML_PUBLICATION_RENDERER_VERSION}`,
    },
  });

  return { html, build, assurance };
}

function addAssuranceDisclosure(
  html: string,
  locale: string,
  assurance: WebPublicationAssurance,
): string {
  const copy = disclosureCopy(locale, assurance);
  const seal = assurance.reviewStatus === 'peer-reviewed'
    ? 'OMI\nPEER REVIEW\nVERIFIED'
    : 'OMI\nPEER REVIEW\nNOT VERIFIED';
  const palette = assurance.reviewStatus === 'peer-reviewed'
    ? { border: '#166534', background: '#f0fdf4', color: '#14532d' }
    : { border: '#92400e', background: '#fffbeb', color: '#78350f' };
  const metadata = [
    `  <meta name="omi-publication-intent" content="${assurance.intent}">`,
    `  <meta name="omi-review-status" content="${assurance.reviewStatus}">`,
    `  <meta name="omi-approval-authority" content="${assurance.approvalAuthority}">`,
    ...(assurance.reviewStatus === 'peer-reviewed'
      ? [
          `  <meta name="omi-editorial-decision-id" content="${escapeHtml(assurance.evidence.decisionId)}">`,
          `  <meta name="omi-editorial-evidence-sha256" content="${escapeHtml(assurance.evidence.evidenceDigest)}">`,
        ]
      : []),
  ].join('\n');
  const disclosed = html.replace(
    '  <title>',
    `${metadata}\n  <title>`,
  );
  const notice = [
    `    <aside class="omi-publication-assurance omi-publication-assurance--${assurance.reviewStatus}"`,
    '      data-omi-assurance-version="1"',
    `      data-omi-publication-intent="${assurance.intent}"`,
    `      data-omi-review-status="${assurance.reviewStatus}"`,
    ...(assurance.reviewStatus === 'peer-reviewed'
      ? [`      data-omi-editorial-decision-id="${escapeHtml(assurance.evidence.decisionId)}"`]
      : []),
    `      style="display:flex!important;visibility:visible!important;opacity:1!important;position:static!important;width:auto!important;height:auto!important;clip:auto!important;clip-path:none!important;overflow:visible!important;gap:.8rem;align-items:center;margin:0 0 1.5rem;padding:.75rem 1rem;border:1px solid ${palette.border};border-inline-start-width:.3rem;border-radius:.35rem;background:${palette.background}!important;color:${palette.color}!important;font:.95rem/1.45 system-ui,sans-serif!important"`,
    '      role="note">',
    `      <span class="omi-publication-assurance__seal" aria-hidden="true" style="display:inline-grid!important;visibility:visible!important;opacity:1!important;place-items:center;box-sizing:border-box;flex:0 0 5rem;width:5rem;min-height:5rem;padding:.35rem;border:.18rem double currentColor;border-radius:50%;text-align:center;text-transform:uppercase;white-space:pre-line;font-size:.58rem!important;font-weight:750;letter-spacing:.04em;line-height:1.12">${escapeHtml(seal)}</span>`,
    '      <span class="omi-publication-assurance__copy" style="display:grid;gap:.2rem">',
    `        <strong>${escapeHtml(copy.label)}</strong> ${escapeHtml(copy.text)}`,
    ...(assurance.reviewStatus === 'peer-reviewed'
      ? [`        <small>${escapeHtml(copy.evidence)} ${escapeHtml(shortEvidence(assurance.evidence.decisionId))}</small>`]
      : []),
    '      </span>',
    '    </aside>',
  ].join('\n');
  const styled = disclosed.replace(
    '  </style>',
    [
      '    .omi-publication-assurance { display: flex; gap: .8rem; align-items: center; margin: 0 0 1.5rem; padding: .75rem 1rem; border: 1px solid #6b7280; border-inline-start-width: .3rem; border-radius: .35rem; background: #f3f4f6; color: #1f2937; font: 0.95rem/1.45 system-ui, sans-serif; }',
      '    .omi-publication-assurance--peer-reviewed { border-color: #166534; background: #f0fdf4; color: #14532d; }',
      '    .omi-publication-assurance--not-peer-reviewed { border-color: #92400e; background: #fffbeb; color: #78350f; }',
      '    .omi-publication-assurance__seal { display: inline-grid; place-items: center; box-sizing: border-box; flex: 0 0 5rem; width: 5rem; min-height: 5rem; padding: .35rem; border: .18rem double currentColor; border-radius: 50%; text-align: center; text-transform: uppercase; white-space: pre-line; font-size: .58rem; font-weight: 750; letter-spacing: .04em; line-height: 1.12; }',
      '    .omi-publication-assurance__copy { display: grid; gap: .2rem; }',
      '    .omi-publication-assurance__copy small { overflow-wrap: anywhere; }',
      '  </style>',
    ].join('\n'),
  );
  return styled.replace(
    /( {2}<article class="omi-scholarly-article"[^>]*>)/,
    `$1\n${notice}`,
  );
}

function disclosureCopy(
  locale: string,
  assurance: WebPublicationAssurance,
): { label: string; text: string; evidence: string } {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  const reviewed = assurance.reviewStatus === 'peer-reviewed';
  if (language === 'hu') {
    return {
      label: assurance.intent === 'public-interest'
        ? 'Közérdekű közlemény.'
        : assurance.intent === 'popular-science'
          ? 'Ismeretterjesztő közlemény.'
          : assurance.intent === 'newsletter'
            ? 'Hírlevél-közlemény.'
            : assurance.intent === 'book-chapter'
              ? 'Tudományos könyvfejezet.'
              : 'Tudományos tanulmány.',
      text: reviewed
        ? 'A Studio lezárt tudományos lektori fordulót és ehhez a forrásrevízióhoz kötött szerkesztői elfogadó döntést ellenőrzött.'
        : 'A közzétevő fiók tulajdonosa jóváhagyta a közzétételt; ehhez a revízióhoz nincs igazolt tudományos lektorálás.',
      evidence: 'Szerkesztői döntési bizonyíték:',
    };
  }
  if (language === 'de') {
    return {
      label: assurance.intent === 'public-interest'
        ? 'Veröffentlichung im öffentlichen Interesse.'
        : assurance.intent === 'popular-science'
          ? 'Populärwissenschaftliche Veröffentlichung.'
          : assurance.intent === 'newsletter'
            ? 'Newsletter-Veröffentlichung.'
            : assurance.intent === 'book-chapter'
              ? 'Wissenschaftliches Buchkapitel.'
              : 'Wissenschaftlicher Beitrag.',
      text: reviewed
        ? 'Studio hat eine abgeschlossene wissenschaftliche Begutachtungsrunde und eine an diese Quellrevision gebundene redaktionelle Annahmeentscheidung verifiziert.'
        : 'Die Inhaberin bzw. der Inhaber des veröffentlichenden Kontos hat die Veröffentlichung freigegeben; für diese Revision ist keine wissenschaftliche Begutachtung nachgewiesen.',
      evidence: 'Redaktioneller Entscheidungsnachweis:',
    };
  }
  return {
    label: assurance.intent === 'public-interest'
      ? 'Public-interest publication.'
      : assurance.intent === 'popular-science'
        ? 'Popular-science publication.'
        : assurance.intent === 'newsletter'
          ? 'Newsletter publication.'
          : assurance.intent === 'book-chapter'
            ? 'Scholarly book chapter.'
            : 'Scholarly article.',
    text: reviewed
      ? 'Studio verified a completed scholarly review round and an editorial acceptance decision bound to this source revision.'
      : 'The publishing account holder approved this publication; no scholarly peer review is verified for this revision.',
    evidence: 'Editorial-decision evidence:',
  };
}

function shortEvidence(decisionId: string): string {
  return decisionId.length > 16
    ? `${decisionId.slice(0, 8)}…${decisionId.slice(-8)}`
    : decisionId;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function optionalBuildValue(
  value: string,
  placeholder: string,
): string | undefined {
  const normalized = value.trim();
  return normalized && normalized !== placeholder ? normalized : undefined;
}
