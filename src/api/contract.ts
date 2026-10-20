import fs from 'node:fs';
import path from 'node:path';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Validates API responses against the published OpenAPI document (committed snapshot
 * in docs/reference/openapi.json; tests/contract/spec-drift.spec.ts keeps it honest).
 * The schema is the single source of truth: if the API and its docs disagree, the test says so.
 */

type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

const SPEC_PATH = path.resolve(__dirname, '../../docs/reference/openapi.json');
const REF_PREFIX = '"#/components/';

interface OpenApiDoc {
  paths: Record<string, Partial<Record<HttpMethod, { responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> }>>>;
  components: Record<string, unknown>;
}

let ajv: Ajv | undefined;
let spec: OpenApiDoc | undefined;
const cache = new Map<string, ValidateFunction | null>();

function load(): { ajv: Ajv; spec: OpenApiDoc } {
  if (!ajv || !spec) {
    spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8')) as OpenApiDoc;
    ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const components = JSON.parse(JSON.stringify(spec.components).replaceAll(REF_PREFIX, '"openapi#/components/'));
    ajv.addSchema({ $id: 'openapi', components });
  }
  return { ajv, spec };
}

export interface ContractResult {
  ok: boolean;
  /** Human-readable reason when !ok. */
  problem?: string;
}

/**
 * @param template OpenAPI path template, e.g. `/folders/{id}/contents`
 */
export function checkContract(method: string, template: string, status: number, body: unknown): ContractResult {
  const { ajv, spec } = load();
  const op = spec.paths[template]?.[method.toLowerCase() as HttpMethod];
  if (!op) return { ok: false, problem: `${method.toUpperCase()} ${template} is not documented` };

  const response = op.responses?.[String(status)];
  if (!response) {
    const documented = Object.keys(op.responses ?? {}).join(', ');
    return { ok: false, problem: `${method.toUpperCase()} ${template} returned undocumented status ${status} (documented: ${documented})` };
  }

  const schema = response.content?.['application/json']?.schema;
  if (!schema) return { ok: true }; // e.g. 204 No Content

  const key = `${method} ${template} ${status}`;
  if (!cache.has(key)) {
    const rewritten = JSON.parse(JSON.stringify(schema).replaceAll(REF_PREFIX, '"openapi#/components/'));
    cache.set(key, ajv.compile(rewritten));
  }
  const validate = cache.get(key)!;
  if (validate(body)) return { ok: true };
  return {
    ok: false,
    problem: `${method.toUpperCase()} ${template} ${status} body does not match the spec: ${ajv.errorsText(validate.errors, { separator: '; ' })}`,
  };
}
