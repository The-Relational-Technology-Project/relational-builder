import type { Tool } from '@/knowledge/types';
import { ExternalLink } from 'lucide-react';

interface ToolCardProps {
  tool: Tool;
}

export function ToolCard({ tool }: ToolCardProps) {
  return (
    <div className="border rounded-lg p-3 text-xs space-y-1.5 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-foreground leading-tight">{tool.name}</h4>
        {tool.url && (
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      <span className="inline-block text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
        {tool.tool_category}
      </span>
      <p className="text-muted-foreground leading-relaxed">
        {tool.summary ?? tool.description.slice(0, 120)}
        {!tool.summary && tool.description.length > 120 ? '...' : ''}
      </p>
    </div>
  );
}
