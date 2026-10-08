import Ajv2020 from 'ajv2020/dist/2020.js';
import schema from '../schemas/omi-manuscript-0.2.schema.json';

const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: true });
ajv.addFormat('date-time', (value: string) =>
  /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$/u.test(value)
  && !Number.isNaN(Date.parse(value)),
);
ajv.addFormat('uri', (value: string) => {
  try { new URL(value); return true; } catch { return false; }
});
ajv.addFormat('uri-reference', (value: string) => {
  try { new URL(value, 'https://openmanuscript.org/'); return true; } catch { return false; }
});
const validateSchema = ajv.compile(schema);
export function validateOmiManuscriptSchema(value: unknown): string[] {
  if (validateSchema(value)) return [];
  return (validateSchema.errors ?? []).map(error =>
    `${error.instancePath || '/'} ${error.keyword}: ${error.message ?? 'schema validation failed'}`,
  );
}
