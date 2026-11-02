import validateSchema from './generated/manuscript.js';
export function validateOmiManuscriptSchema(value: unknown): string[] {
  if (validateSchema(value)) return [];
  return (validateSchema.errors ?? []).map(error =>
    `${error.instancePath || '/'} ${error.keyword}: ${error.message ?? 'schema validation failed'}`,
  );
}
