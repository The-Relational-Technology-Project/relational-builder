/**
 * The five core principles of the Relational Technology Project.
 * These are always included in the AI system prompt.
 */
export const RTP_PRINCIPLES = [
  {
    name: 'Built by the people it serves',
    description:
      'Technology should be created with — not just for — the communities that will use it. The people closest to the challenges are closest to the solutions.',
  },
  {
    name: 'River, not gardener',
    description:
      'Technology should flow through a community like a river — nourishing what already grows rather than imposing a plan. Support existing relationships and patterns rather than replacing them.',
  },
  {
    name: 'Relationships first',
    description:
      'The primary purpose of relational technology is to strengthen human connections. Every feature, interface, and interaction should be evaluated by whether it deepens or diminishes real relationships.',
  },
  {
    name: 'Asset-based',
    description:
      'Start from what a community already has — existing knowledge, relationships, gathering places, traditions — and build technology that amplifies these assets rather than cataloging deficits.',
  },
  {
    name: 'Speed of trust',
    description:
      'Move at the pace that relationships allow. Technology adoption should follow trust-building, not outpace it. Rushing deployment undermines the relational foundation that makes technology useful.',
  },
];

/** Format principles for system prompt injection */
export function formatPrinciplesForPrompt(): string {
  const lines = RTP_PRINCIPLES.map(
    (p, i) => `${i + 1}. **${p.name}**: ${p.description}`,
  );
  return [
    '## Relational Technology Principles',
    '',
    'Your builds should reflect these five core principles:',
    '',
    ...lines,
  ].join('\n');
}
