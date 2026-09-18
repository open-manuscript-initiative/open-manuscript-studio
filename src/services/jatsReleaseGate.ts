import {
  isJatsReleaseBlockingDiagnostic,
  OMI_JATS_CONFORMANCE_TAG_SET,
  OMI_JATS_CONFORMANCE_VERSION,
} from '../model/jatsConformance';
import type { JatsExportResult } from './exportJats';
import type { JatsSchemaValidationResult } from './jatsValidationApi';

export type PublicationReleaseGateStatus = 'pass' | 'fail';

export interface PublicationReleaseGate {
  id:
    | 'renderer-diagnostics'
    | 'semantic-fidelity'
    | 'jats-target'
    | 'dtd-validation';
  status: PublicationReleaseGateStatus;
  detail: string;
}

export interface JatsPublicationReleaseResult {
  releasable: boolean;
  gates: PublicationReleaseGate[];
  blockingDiagnosticCodes: string[];
}

/**
 * Evaluates the mandatory JATS publication-release boundary.
 *
 * DTD validity alone is deliberately insufficient: JATS is permissive enough
 * that an XML document can be schema-valid while Studio has had to flatten or
 * downgrade a semantic construct. Those known fidelity fallbacks are encoded
 * in the conformance matrix and block a publication release while remaining
 * visible as renderer diagnostics.
 */
export function evaluateJatsPublicationRelease(
  render: Pick<JatsExportResult, 'diagnostics'>,
  validation: JatsSchemaValidationResult,
): JatsPublicationReleaseResult {
  const rendererErrors = render.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  const blockingDiagnostics = render.diagnostics.filter((diagnostic) =>
    isJatsReleaseBlockingDiagnostic(diagnostic.code),
  );
  const blockingDiagnosticCodes = Array.from(
    new Set(blockingDiagnostics.map((diagnostic) => diagnostic.code)),
  );

  const targetMatches =
    validation.standard === 'NISO JATS' &&
    validation.version === OMI_JATS_CONFORMANCE_VERSION &&
    validation.tagSet === OMI_JATS_CONFORMANCE_TAG_SET &&
    validation.schema === 'DTD' &&
    validation.schemaVariant === 'MathML3';

  const gates: PublicationReleaseGate[] = [
    {
      id: 'renderer-diagnostics',
      status: rendererErrors.length === 0 ? 'pass' : 'fail',
      detail: rendererErrors.length === 0
        ? 'The JATS renderer reported no error-level diagnostics.'
        : `The JATS renderer reported ${rendererErrors.length} error-level diagnostic(s).`,
    },
    {
      id: 'semantic-fidelity',
      status: blockingDiagnostics.length === 0 ? 'pass' : 'fail',
      detail: blockingDiagnostics.length === 0
        ? 'No conformance-matrix fidelity fallback is present.'
        : `Release-blocking JATS fidelity diagnostics: ${blockingDiagnosticCodes.join(', ')}.`,
    },
    {
      id: 'jats-target',
      status: targetMatches ? 'pass' : 'fail',
      detail: targetMatches
        ? 'Validation evidence targets JATS 1.4 Article Authoring / MathML 3 DTD.'
        : 'Validation evidence does not match the pinned JATS 1.4 Article Authoring target.',
    },
    {
      id: 'dtd-validation',
      status: validation.valid ? 'pass' : 'fail',
      detail: validation.valid
        ? 'The generated artifact passed full offline DTD validation.'
        : `DTD validation failed with ${validation.diagnostics.length} diagnostic(s).`,
    },
  ];

  return {
    releasable: gates.every((gate) => gate.status === 'pass'),
    gates,
    blockingDiagnosticCodes,
  };
}

export function jatsPublicationReleaseFailureMessage(
  result: JatsPublicationReleaseResult,
): string {
  return result.gates
    .filter((gate) => gate.status === 'fail')
    .map((gate) => gate.detail)
    .join(' ');
}
