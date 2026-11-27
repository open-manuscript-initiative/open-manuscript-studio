import { z } from 'zod';
import { ompMetadataRequest, ompMetadataResponse } from './ompMetadataContract.js';
import { ompWorkflowInspectionResponse } from './ompWorkflowContract.js';
import { ompChapterPagesRequest, ompChapterPagesResponse } from './ompChapterPagesContract.js';
import { ojsIssuePagesRequest, ojsIssuePagesResponse } from './ojsIssuePagesContract.js';
import {
  productionCommandSchema,
  productionResponseSchema,
  productionTasksSchema,
} from './editorialProductionContract.js';
import {
  ojsMetadataRequest,
  ojsMetadataResponse,
} from './ojsMetadataContract.js';
import {
  workflowInspectionRequest,
  workflowInspectionResponse,
  editorialCapabilitiesSchema,
  editorialErrorSchema,
} from './editorialConnectorContract.js';
/** Checked transport snapshot generated from the DTOs used by the HTTP handlers. */
export function editorialOpenApi() {
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const json = (schema: unknown) => ({
    content: { 'application/json': { schema } },
  });
  const parameter = (name: string) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  });
  const security = [{ session: [] }, { bearer: [] }];
  const headers = {
    'Cache-Control': { schema: { const: 'no-store' } },
    'X-Request-Id': { schema: { type: 'string', format: 'uuid' } },
  };
  const responses = (schema: string) => ({
    '200': {
      description:
        'Current authorized projection. A workflow version is a CAS precondition, not a publication approval.',
      headers,
      ...json(ref(schema)),
    },
    ...Object.fromEntries(
      [400, 401, 403, 404, 409, 422, 500, 502, 503].map((status) => [
        String(status),
        {
          description:
            status === 409
              ? 'Stale version/token or unsupported connector capability; inspect current state, never blind retry.'
              : 'Request denied or unavailable; no side effects on validation/authorization failure.',
          ...json(ref('EditorialError')),
        },
      ]),
    ),
  });
  const production = '/api/v1/native-editorial/production';
  const connector = '/api/v1/integrations/connections/{connectionId}';
  const operation = (
    operationId: string,
    response: string,
    request?: string,
  ) => ({
    operationId,
    security,
    responses: responses(response),
    ...(request
      ? { requestBody: { required: true, ...json(ref(request)) } }
      : {}),
  });
  return {
    openapi: '3.1.0',
    info: {
      title: 'Studio editorial production and publishing profile APIs',
      version: '1.0.0-draft.1',
    },
    paths: {
      [`${production}/tasks`]: {
        get: operation('listEditorialProductionTasks', 'ProductionTasks'),
      },
      [`${production}/{submissionId}`]: {
        parameters: [parameter('submissionId')],
        get: operation('getEditorialProduction', 'ProductionResponse'),
        post: {
          ...operation(
            'changeEditorialProduction',
            'ProductionResponse',
            'ProductionCommand',
          ),
          description:
            'version is mandatory; immutable file IDs, dual source/proof approvals and READY gate remain server authority. No automatic retry after an unknown result: reload state and files. No document editing lock.',
        },
      },
      [`${production}/{submissionId}/files/{fileId}`]: {
        parameters: [parameter('submissionId'), parameter('fileId')],
        get: {
          operationId: 'downloadEditorialProductionFile',
          security,
          responses: {
            '200': {
              description:
                'Participant-only immutable source JSON or exact HTML/PDF proof. Attachment; no-store; sandbox CSP.',
              content: {
                'application/octet-stream': {
                  schema: { type: 'string', format: 'binary' },
                },
              },
            },
            '403': { description: 'Not a current participant.' },
            '404': { description: 'File not in this production.' },
          },
        },
      },
      [`${connector}/editorial-capabilities`]: {
        parameters: [parameter('connectionId')],
        get: operation(
          'getEditorialConnectorCapabilities',
          'EditorialCapabilities',
        ),
      },
      [`${connector}/workflow-status`]: {
        parameters: [parameter('connectionId')],
        post: operation(
          'inspectEditorialWorkflow',
          'WorkflowResponse',
          'WorkflowRequest',
        ),
      },
      [`${connector}/metadata`]: {
        parameters: [parameter('connectionId')],
        post: {
          ...operation(
            'reconcileEditorialMetadata',
            'MetadataResponse',
            'MetadataRequest',
          ),
          description:
            'OJS profile only. Inspect before apply; exact publicationId/locale/expectedStateToken and confirmed are required. Only selected fields are written. An unknown remote outcome requires reinspection; no automatic replay or distributed transaction is claimed.',
        },
      },
      [`${connector}/omp-workflow-status`]: {
        parameters: [parameter('connectionId')],
        post: {
          ...operation('inspectOmpEditorialWorkflow', 'OmpWorkflowResponse', 'WorkflowRequest'),
          description: 'OMP profile only. Read-only native press workflow; submission-scoped editorial permission is revalidated by OMP. No editorial decisions are written.',
        },
      },
      [`${connector}/omp-metadata`]: {
        parameters: [parameter('connectionId')],
        post: {
          ...operation('reconcileOmpVolumeMetadata', 'OmpMetadataResponse', 'OmpMetadataRequest'),
          description: 'OMP profile only. Exact installation/press/submission/current publication identity is required for inspect and apply. Confirm selected language and title/subtitle/abstract/keyword fields with expectedStateToken. Validate the bound receipt; uncertain outcomes require native reinspection with no automatic replay. Series, identifiers, contributors, chapters and publication decisions remain native authority.',
        },
      },
      [`${connector}/chapter-page-range`]: {
        parameters: [parameter('connectionId')],
        post: {
          ...operation('reconcileOmpChapterPages', 'OmpChapterPagesResponse', 'OmpChapterPagesRequest'),
          description: 'OMP profile only. Inspect exact chapter identity before confirmed printed page-range writeback with expectedWorkflowToken. Native production permission and unpublished state remain required. No physical-screen page indices or publication approval.',
        },
      },
      [`${connector}/issue-page-range`]: {
        parameters: [parameter('connectionId')],
        post: {
          ...operation('reconcileOjsIssuePages', 'OjsIssuePagesResponse', 'OjsIssuePagesRequest'),
          description: 'OJS profile only. Inspect exact issue/article/publication identity before confirmed printed page-range writeback with expectedWorkflowToken; native permission and unpublished state remain required.',
        },
      },
    },
    components: {
      securitySchemes: {
        session: { type: 'apiKey', in: 'cookie', name: 'omi_session' },
        bearer: { type: 'http', scheme: 'bearer' },
      },
      schemas: Object.fromEntries(
        Object.entries({
          ProductionCommand: productionCommandSchema,
          ProductionResponse: productionResponseSchema,
          ProductionTasks: productionTasksSchema,
          MetadataRequest: ojsMetadataRequest,
          MetadataResponse: ojsMetadataResponse,
          OmpMetadataRequest: ompMetadataRequest,
          OmpMetadataResponse: ompMetadataResponse,
          OmpWorkflowResponse: ompWorkflowInspectionResponse,
          OmpChapterPagesRequest: ompChapterPagesRequest,
          OmpChapterPagesResponse: ompChapterPagesResponse,
          OjsIssuePagesRequest: ojsIssuePagesRequest,
          OjsIssuePagesResponse: ojsIssuePagesResponse,
          WorkflowRequest: workflowInspectionRequest,
          WorkflowResponse: workflowInspectionResponse,
          EditorialCapabilities: editorialCapabilitiesSchema,
          EditorialError: editorialErrorSchema,
        }).map(([name, schema]) => [name, z.toJSONSchema(schema)]),
      ),
    },
  };
}
