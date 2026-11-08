import { z } from 'zod';
import { privacyNoticeSchema, publicPrivacyNoticeSchema, accountOverviewSchema, privacyErrorSchema } from './privacyContract.js';

type Schema = { type?: string | string[]; const?: unknown; enum?: unknown[]; anyOf?: Schema[];
  oneOf?: Schema[]; properties?: Record<string, Schema>; required?: string[]; items?: Schema };
/** Small, fail-closed generator for the JSON Schema subset emitted by these DTOs.
 * Frontend builds consume plain types and never need server or Zod dependencies. */
function typeOf(schema: Schema): string {
  if ('const' in schema) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map(value => JSON.stringify(value)).join(' | ');
  const alternatives = schema.anyOf ?? schema.oneOf;
  if (alternatives) return alternatives.map(typeOf).map(value => `(${value})`).join(' | ');
  if (Array.isArray(schema.type)) return schema.type.map(type => typeOf({ ...schema, type })).join(' | ');
  if (schema.type === 'object') return `{ ${Object.entries(schema.properties ?? {}).map(([key, value]) =>
    `${JSON.stringify(key)}${schema.required?.includes(key) ? '' : '?'}: ${typeOf(value)};`).join(' ')} }`;
  if (schema.type === 'array' && schema.items) return `Array<${typeOf(schema.items)}>`;
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'string' || schema.type === 'boolean' || schema.type === 'null') return schema.type;
  throw new Error('Unsupported privacy DTO JSON Schema type; extend the generator explicitly.');
}
export function privacyClientTypes(): string {
  const schemas = { PrivacyNotice: privacyNoticeSchema, PublicPrivacyNotice: publicPrivacyNoticeSchema,
    AccountOverview: accountOverviewSchema, PrivacyError: privacyErrorSchema };
  return '// Generated from server/src/contracts/privacyContract.ts. Do not edit.\n'
    + '// Run npm run api:privacy:generate; strict runtime validation stays at the server boundary.\n\n'
    + Object.entries(schemas).map(([name, schema]) => `export type ${name} = ${typeOf(z.toJSONSchema(schema) as Schema)};\n`).join('\n');
}
