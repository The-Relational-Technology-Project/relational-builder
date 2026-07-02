import type { FileEntry } from './virtual-fs';
import { useEnvStore } from '@/store/env-store';

/**
 * Publish-time security scan — the neighborhood-scale version of Lovable's
 * Security Overview. Deterministic and instant: catch secret-shaped strings
 * and actual secret env values before they ship in public code. Findings
 * warn (with exactly what and where); the builder can still publish after
 * reading them.
 */

export interface SecurityFinding {
  path: string;
  line: number;
  issue: string;
  snippet: string;
}

/** Secret-shaped strings that should never appear in shipped client code */
const SECRET_PATTERNS: { re: RegExp; issue: string }[] = [
  { re: /sk-ant-[a-zA-Z0-9_-]{10,}/, issue: 'Anthropic API key' },
  { re: /sk-(?:live|proj|test)?-?[a-zA-Z0-9]{20,}/, issue: 'API secret key (sk-…)' },
  { re: /AKIA[0-9A-Z]{16}/, issue: 'AWS access key' },
  { re: /re_[a-zA-Z0-9]{20,}/, issue: 'Resend API key' },
  { re: /AIza[0-9A-Za-z_-]{35}/, issue: 'Google API key' },
  { re: /ghp_[a-zA-Z0-9]{36}/, issue: 'GitHub personal access token' },
  { re: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, issue: 'JWT (check it is not a service-role key)' },
  { re: /(?:service_role|SERVICE_ROLE)/, issue: 'Reference to a service-role key (server-only — never in client code)' },
  { re: /(?:password|secret)\s*[:=]\s*["'][^"'\s]{8,}["']/i, issue: 'Hardcoded password/secret' },
];

/** Paths that legitimately hold long base64 blobs */
const SKIP_PATHS = [/^\/?assets\/[\w-]+\.js$/, /^\/?env\.js$/];

export function runSecurityScan(files: FileEntry[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  // Secret env vars whose actual values leak into shipped files — the most
  // damaging and most checkable mistake
  const secretValues = useEnvStore.getState().vars
    .filter(v => v.isSecret && v.value.trim().length >= 8)
    .map(v => ({ key: v.key, value: v.value.trim() }));

  for (const file of files) {
    if (SKIP_PATHS.some(re => re.test(file.path))) continue;
    const lines = file.content.split('\n');

    lines.forEach((lineText, i) => {
      for (const { key, value } of secretValues) {
        if (lineText.includes(value)) {
          findings.push({
            path: file.path,
            line: i + 1,
            issue: `The value of your secret env var ${key} is pasted into this file`,
            snippet: lineText.trim().slice(0, 80),
          });
        }
      }
      for (const { re, issue } of SECRET_PATTERNS) {
        if (re.test(lineText)) {
          findings.push({
            path: file.path,
            line: i + 1,
            issue,
            snippet: lineText.trim().slice(0, 80),
          });
          break; // one pattern finding per line is enough
        }
      }
    });
  }

  // Dedupe identical (path, line) rows
  const seen = new Set<string>();
  return findings.filter(f => {
    const key = `${f.path}:${f.line}:${f.issue}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
