import { prisma } from '../../lib/prisma.js';
import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';
import type { LaunchClaims } from './launchVerifier.js';

export type OjsReviewFormElementType =
  | 'small_text'
  | 'text'
  | 'textarea'
  | 'checkboxes'
  | 'radio'
  | 'dropdown';

export interface OjsReviewFormOption {
  value: string;
  label: string;
}

export interface OjsReviewFormElement {
  externalId: string;
  type: OjsReviewFormElementType;
  question: string;
  description: string;
  required: boolean;
  authorVisible: boolean;
  options: OjsReviewFormOption[];
  value: string | string[] | null;
}

export interface OjsReviewFormDefinition {
  externalId: string;
  elements: OjsReviewFormElement[];
}

export interface OjsReviewFormResponse {
  elementExternalId: string;
  value: string | string[] | null;
}

interface StoredReviewFormRow {
  form_external_id: string | null;
  definition: unknown;
  responses: unknown;
}

function hasScope(claims: LaunchClaims, scope: string): boolean {
  return claims.scope?.includes(scope) ?? false;
}

function parseDefinition(value: unknown): OjsReviewFormDefinition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.externalId !== 'string' || !Array.isArray(record.elements)) return null;
  return record as unknown as OjsReviewFormDefinition;
}

function parseResponses(value: unknown): OjsReviewFormResponse[] {
  return Array.isArray(value) ? value as OjsReviewFormResponse[] : [];
}

export async function loadOjsReviewForm(
  claims: LaunchClaims,
  payload: string,
  signature: string,
  installationBaseUrl: string,
): Promise<OjsReviewFormDefinition | null> {
  if (claims.actorMode !== 'review') return null;
  if (!hasScope(claims, 'review.form.read')) {
    throw new Error('The reviewer launch does not grant review.form.read.');
  }
  if (!claims.apiBaseUrl) throw new Error('The OJS reviewer launch does not include apiBaseUrl.');

  const trustedBase = await assertTrustedIntegrationUrl(claims.apiBaseUrl, installationBaseUrl);
  const target = new URL(`${trustedBase.toString().replace(/\/$/, '')}/review-form`);
  if (target.origin !== new URL(installationBaseUrl).origin || target.search || target.hash) {
    throw new Error('The OJS review form URL is not trusted.');
  }

  const response = await fetch(target, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `OMI ${payload}.${signature}`,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const text = (await response.text()).slice(0, 500);
    throw new Error(`OJS review form request failed with HTTP ${response.status}${text ? `: ${text}` : ''}`);
  }

  const data = await response.json() as { reviewForm?: unknown };
  if (data.reviewForm === null || data.reviewForm === undefined) return null;
  const definition = parseDefinition(data.reviewForm);
  if (!definition) throw new Error('OJS returned an invalid native review form definition.');
  return definition;
}

export async function rememberOjsReviewForm(
  assignmentId: string,
  definition: OjsReviewFormDefinition | null,
): Promise<void> {
  const formExternalId = definition?.externalId ?? null;
  const definitionJson = definition ? JSON.stringify(definition) : null;
  const initialResponses = definition
    ? definition.elements
        .filter((element) => element.value !== null && element.value !== '')
        .map((element) => ({ elementExternalId: element.externalId, value: element.value }))
    : [];
  const responsesJson = JSON.stringify(initialResponses);

  await prisma.$executeRaw`
    INSERT INTO ojs_review_form_contexts
      (assignment_id, form_external_id, definition, responses, updated_at)
    VALUES (
      ${assignmentId}::uuid,
      ${formExternalId},
      ${definitionJson}::jsonb,
      ${responsesJson}::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (assignment_id)
    DO UPDATE SET
      form_external_id = EXCLUDED.form_external_id,
      definition = EXCLUDED.definition,
      responses = EXCLUDED.responses,
      updated_at = CURRENT_TIMESTAMP
  `;
}

export async function getOjsReviewFormContext(
  assignmentId: string,
): Promise<{ definition: OjsReviewFormDefinition | null; responses: OjsReviewFormResponse[] } | null> {
  const rows = await prisma.$queryRaw<StoredReviewFormRow[]>`
    SELECT form_external_id, definition, responses
    FROM ojs_review_form_contexts
    WHERE assignment_id = ${assignmentId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    definition: parseDefinition(row.definition),
    responses: parseResponses(row.responses),
  };
}

export async function saveOjsReviewFormResponses(
  assignmentId: string,
  responses: OjsReviewFormResponse[],
): Promise<void> {
  const context = await getOjsReviewFormContext(assignmentId);
  if (!context?.definition) throw new Error('This review assignment does not have an OJS review form.');
  const elements = new Map(context.definition.elements.map((element) => [element.externalId, element]));
  const normalized = new Map<string, OjsReviewFormResponse>();

  for (const response of responses) {
    const element = elements.get(response.elementExternalId);
    if (!element) throw new Error('A response references an element outside the assigned OJS review form.');
    const value = normalizeValue(element, response.value);
    normalized.set(element.externalId, { elementExternalId: element.externalId, value });
  }

  const merged = new Map(context.responses.map((response) => [response.elementExternalId, response]));
  for (const [id, response] of normalized) merged.set(id, response);
  const payload = [...merged.values()];
  const json = JSON.stringify(payload);
  await prisma.$executeRaw`
    UPDATE ojs_review_form_contexts
    SET responses = ${json}::jsonb, updated_at = CURRENT_TIMESTAMP
    WHERE assignment_id = ${assignmentId}::uuid
  `;
}

export async function validateOjsReviewFormComplete(assignmentId: string): Promise<void> {
  const context = await getOjsReviewFormContext(assignmentId);
  if (!context?.definition) return;
  const values = new Map(context.responses.map((response) => [response.elementExternalId, response.value]));
  for (const element of context.definition.elements) {
    if (!element.required) continue;
    const value = values.get(element.externalId);
    if (isEmpty(value)) throw new Error(`Required OJS review form field is incomplete: ${element.question}`);
  }
}

function normalizeValue(
  element: OjsReviewFormElement,
  value: string | string[] | null,
): string | string[] | null {
  const allowed = new Set(element.options.map((option) => option.value));
  if (element.type === 'checkboxes') {
    if (!Array.isArray(value)) throw new Error(`Review form field "${element.question}" requires multiple-choice values.`);
    const values = [...new Set(value.map(String))];
    for (const item of values) if (!allowed.has(item)) throw new Error(`Review form field "${element.question}" contains an invalid option.`);
    return values;
  }
  if (element.type === 'radio' || element.type === 'dropdown') {
    if (Array.isArray(value)) throw new Error(`Review form field "${element.question}" requires a single value.`);
    const scalar = value === null ? '' : String(value);
    if (scalar && !allowed.has(scalar)) throw new Error(`Review form field "${element.question}" contains an invalid option.`);
    return scalar;
  }
  if (Array.isArray(value)) throw new Error(`Review form field "${element.question}" requires text.`);
  const text = value === null ? '' : String(value);
  if (text.length > 100_000) throw new Error(`Review form field "${element.question}" is too long.`);
  return text;
}

function isEmpty(value: string | string[] | null | undefined): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return !value?.trim();
}
