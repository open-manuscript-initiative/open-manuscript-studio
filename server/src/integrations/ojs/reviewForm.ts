import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';

export type OjsReviewFormOption = {
  value: string;
  label: string;
  localizations?: Record<string, string>;
};

export type OjsReviewFormElement = {
  id: number;
  sequence: number;
  type: 'smallTextField' | 'smallTextArea' | 'textArea' | 'checkBoxes' | 'radioButtons' | 'dropDownBox';
  question: string;
  description?: string | null;
  required: boolean;
  authorVisible: boolean;
  options: OjsReviewFormOption[];
  localizations?: Record<string, {
    question?: string;
    description?: string | null;
    options?: Record<string, string>;
  }>;
};

export type OjsReviewFormDefinition = {
  id: number;
  title?: string | null;
  description?: string | null;
  elements: OjsReviewFormElement[];
};

export type OjsReviewFormResponseValue = string | string[] | null;

export type OjsReviewFormState = {
  form: OjsReviewFormDefinition;
  responses: Record<string, OjsReviewFormResponseValue>;
};

export async function replaceOjsReviewFormState(
  assignmentId: string,
  state: OjsReviewFormState | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "ojs_review_form_responses" WHERE "assignment_id" = ${assignmentId}::uuid`;
    await tx.$executeRaw`DELETE FROM "ojs_review_form_contexts" WHERE "assignment_id" = ${assignmentId}::uuid`;

    if (!state) return;

    const normalized = normalizeDefinition(state.form);
    await tx.$executeRaw`
      INSERT INTO "ojs_review_form_contexts" ("assignment_id", "external_form_id", "definition", "created_at", "updated_at")
      VALUES (${assignmentId}::uuid, ${normalized.id}, ${JSON.stringify(normalized)}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    for (const element of normalized.elements) {
      const value = normalizeResponseValue(element, state.responses[String(element.id)] ?? null);
      if (isEmpty(value)) continue;
      await tx.$executeRaw`
        INSERT INTO "ojs_review_form_responses" ("assignment_id", "external_element_id", "response", "created_at", "updated_at")
        VALUES (${assignmentId}::uuid, ${element.id}, ${JSON.stringify(value)}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    }
  });
}

export async function getOjsReviewFormState(assignmentId: string): Promise<OjsReviewFormState | null> {
  const contexts = await prisma.$queryRaw<Array<{ definition: unknown }>>`
    SELECT "definition"
    FROM "ojs_review_form_contexts"
    WHERE "assignment_id" = ${assignmentId}::uuid
    LIMIT 1
  `;
  if (!contexts[0]) return null;

  const form = normalizeDefinition(contexts[0].definition);
  const rows = await prisma.$queryRaw<Array<{ external_element_id: number; response: unknown }>>`
    SELECT "external_element_id", "response"
    FROM "ojs_review_form_responses"
    WHERE "assignment_id" = ${assignmentId}::uuid
  `;
  const responses: Record<string, OjsReviewFormResponseValue> = {};
  for (const row of rows) {
    const element = form.elements.find((item) => item.id === row.external_element_id);
    if (!element) continue;
    responses[String(element.id)] = normalizeResponseValue(element, row.response);
  }
  return { form, responses };
}

export async function saveOjsReviewFormResponses(
  assignmentId: string,
  input: Record<string, unknown>,
): Promise<OjsReviewFormState> {
  const state = await getOjsReviewFormState(assignmentId);
  if (!state) throw new Error('This review assignment has no OJS review form.');

  const normalized: Record<string, OjsReviewFormResponseValue> = { ...state.responses };
  for (const element of state.form.elements) {
    const key = String(element.id);
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    normalized[key] = normalizeResponseValue(element, input[key]);
  }

  await prisma.$transaction(async (tx) => {
    for (const element of state.form.elements) {
      const key = String(element.id);
      if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
      const value = normalized[key] ?? null;
      if (isEmpty(value)) {
        await tx.$executeRaw`
          DELETE FROM "ojs_review_form_responses"
          WHERE "assignment_id" = ${assignmentId}::uuid AND "external_element_id" = ${element.id}
        `;
        continue;
      }
      await tx.$executeRaw`
        INSERT INTO "ojs_review_form_responses" ("assignment_id", "external_element_id", "response", "created_at", "updated_at")
        VALUES (${assignmentId}::uuid, ${element.id}, ${JSON.stringify(value)}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("assignment_id", "external_element_id") DO UPDATE SET
          "response" = EXCLUDED."response",
          "updated_at" = CURRENT_TIMESTAMP
      `;
    }
  });

  return { form: state.form, responses: normalized };
}

export async function assertOjsReviewFormComplete(assignmentId: string): Promise<void> {
  const state = await getOjsReviewFormState(assignmentId);
  if (!state) return;
  for (const element of state.form.elements) {
    if (!element.required) continue;
    if (isEmpty(state.responses[String(element.id)])) {
      throw new Error(`Required review form field is incomplete: ${plainText(element.question)}`);
    }
  }
}

export function authorVisibleOjsReviewFormResponses(state: OjsReviewFormState | null): Array<{
  elementId: number;
  question: string;
  response: OjsReviewFormResponseValue;
}> {
  if (!state) return [];
  return state.form.elements
    .filter((element) => element.authorVisible)
    .map((element) => ({
      elementId: element.id,
      question: plainText(element.question),
      response: state.responses[String(element.id)] ?? null,
    }))
    .filter((item) => !isEmpty(item.response));
}

function normalizeDefinition(value: unknown): OjsReviewFormDefinition {
  if (!value || typeof value !== 'object') throw new Error('Invalid OJS review form definition.');
  const form = value as Record<string, unknown>;
  const id = Number(form.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid OJS review form id.');
  const rawElements = Array.isArray(form.elements) ? form.elements : [];
  return {
    id,
    title: typeof form.title === 'string' ? plainText(form.title) : null,
    description: typeof form.description === 'string' ? plainText(form.description) : null,
    elements: rawElements.map(normalizeElement).sort((a, b) => a.sequence - b.sequence),
  };
}

function normalizeElement(value: unknown): OjsReviewFormElement {
  if (!value || typeof value !== 'object') throw new Error('Invalid OJS review form element.');
  const element = value as Record<string, unknown>;
  const id = Number(element.id);
  const sequence = Number(element.sequence ?? 0);
  const type = String(element.type ?? '') as OjsReviewFormElement['type'];
  const allowedTypes = new Set<OjsReviewFormElement['type']>([
    'smallTextField', 'smallTextArea', 'textArea', 'checkBoxes', 'radioButtons', 'dropDownBox',
  ]);
  if (!Number.isInteger(id) || id <= 0 || !allowedTypes.has(type)) throw new Error('Invalid OJS review form element.');

  const options = Array.isArray(element.options)
    ? element.options.map((option) => {
        if (!option || typeof option !== 'object') throw new Error('Invalid OJS review form option.');
        const item = option as Record<string, unknown>;
        const optionLocalizations = normalizeStringMap(item.localizations);
        return {
          value: String(item.value ?? ''),
          label: plainText(String(item.label ?? item.value ?? '')),
          ...(Object.keys(optionLocalizations).length > 0 ? { localizations: optionLocalizations } : {}),
        };
      })
    : [];

  const elementLocalizations = normalizeElementLocalizations(element.localizations);

  return {
    id,
    sequence: Number.isFinite(sequence) ? sequence : 0,
    type,
    question: plainText(String(element.question ?? '')),
    description: typeof element.description === 'string' ? plainText(element.description) : null,
    required: Boolean(element.required),
    authorVisible: Boolean(element.authorVisible),
    options,
    ...(Object.keys(elementLocalizations).length > 0 ? { localizations: elementLocalizations } : {}),
  };
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [locale, text] of Object.entries(value as Record<string, unknown>)) {
    if (typeof text === 'string' && text.trim()) result[locale] = plainText(text);
  }
  return result;
}

function normalizeElementLocalizations(value: unknown): NonNullable<OjsReviewFormElement['localizations']> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: NonNullable<OjsReviewFormElement['localizations']> = {};
  for (const [locale, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const question = typeof item.question === 'string' ? plainText(item.question) : undefined;
    const description = typeof item.description === 'string' ? plainText(item.description) : undefined;
    const localizedOptions = normalizeStringMap(item.options);
    if (!question && !description && Object.keys(localizedOptions).length === 0) continue;
    result[locale] = {
      ...(question ? { question } : {}),
      ...(description ? { description } : {}),
      ...(Object.keys(localizedOptions).length > 0 ? { options: localizedOptions } : {}),
    };
  }
  return result;
}

function normalizeResponseValue(element: OjsReviewFormElement, value: unknown): OjsReviewFormResponseValue {
  const allowed = new Set(element.options.map((option) => option.value));
  if (element.type === 'checkBoxes') {
    if (value === null || value === undefined || value === '') return [];
    if (!Array.isArray(value)) throw new Error(`Review form field "${plainText(element.question)}" requires multiple values.`);
    const values = [...new Set(value.map(String))];
    for (const item of values) if (!allowed.has(item)) throw new Error(`Review form field "${plainText(element.question)}" contains an invalid option.`);
    return values;
  }
  if (element.type === 'radioButtons' || element.type === 'dropDownBox') {
    if (Array.isArray(value)) throw new Error(`Review form field "${plainText(element.question)}" requires a single value.`);
    const scalar = value === null || value === undefined ? '' : String(value);
    if (scalar && !allowed.has(scalar)) throw new Error(`Review form field "${plainText(element.question)}" contains an invalid option.`);
    return scalar;
  }
  if (Array.isArray(value)) throw new Error(`Review form field "${plainText(element.question)}" requires text.`);
  const text = value === null || value === undefined ? '' : String(value);
  if (text.length > 100_000) throw new Error(`Review form field "${plainText(element.question)}" is too long.`);
  return text;
}

function isEmpty(value: string | string[] | null | undefined): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return !value?.trim();
}

function plainText(value: string): string {
  // Strip markup before decoding entities. Decoding &lt;script&gt; first would
  // manufacture new tag-looking text after the sanitization pass.
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p\s*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:0*39|x0*27);/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
