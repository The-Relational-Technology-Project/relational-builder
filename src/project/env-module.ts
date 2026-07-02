/**
 * Generate the env modules injected into previews, exports, and deploys.
 * PUBLIC vars only — secrets never leave the builder except as deploy-time
 * platform env vars for serverless functions.
 *
 * Two shapes, because generated apps come in two shapes:
 *   /env.js     — plain browser JS for static/vanilla apps: defines a global
 *                 `env` and also works as an ES module import from "./env.js"
 *   /src/env.ts — typed module for React apps: import { env } from "./env"
 */

export interface PublicEnvVar {
  key: string;
  value: string;
}

export function buildEnvJs(vars: PublicEnvVar[]): string {
  const entries = vars
    .map(v => `  ${JSON.stringify(v.key)}: ${JSON.stringify(v.value)},`)
    .join('\n');
  return [
    '// Auto-generated from the Relational Builder Environment panel — public vars only',
    'export const env = {',
    entries,
    '};',
    "if (typeof window !== 'undefined') window.env = env;",
    '',
  ].join('\n');
}

export function buildEnvTs(vars: PublicEnvVar[]): string {
  const entries = vars
    .map(v => `  ${JSON.stringify(v.key)}: ${JSON.stringify(v.value)},`)
    .join('\n');
  return [
    '// Auto-generated from the Relational Builder Environment panel — public vars only',
    'export const env = {',
    entries,
    '} as const;',
    '',
  ].join('\n');
}
