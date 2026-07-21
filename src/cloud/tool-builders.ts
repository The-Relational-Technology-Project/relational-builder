import { builderClient } from '@/cloud/builder-client';

/**
 * Builders behind gallery tools. `tool_builders` (Builder backend, public
 * read) says WHO grew a tool; HOW to reach them comes from the connections
 * directory, which only surfaces builders whose connection settings are
 * open. The association is public credit; contact stays consent-gated.
 */

export interface ToolBuilder {
  tool_id: string;
  user_id: string;
  builder_name: string | null;
  role: string;
}

export async function listToolBuilders(toolId: string): Promise<ToolBuilder[]> {
  if (!builderClient) return [];
  const { data, error } = await builderClient
    .from('tool_builders')
    .select('tool_id, user_id, builder_name, role')
    .eq('tool_id', toolId);
  if (error) return [];
  return (data ?? []) as ToolBuilder[];
}
