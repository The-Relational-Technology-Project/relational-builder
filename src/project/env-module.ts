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
    // Same global the plain env.js sets, so code that cannot import this
    // module (the kit's lib/ai helper, which has no env of its own in the
    // builder repo) still finds the app's public env at call time
    "if (typeof window !== 'undefined') (window as unknown as { env: unknown }).env = env;",
    '',
  ].join('\n');
}
