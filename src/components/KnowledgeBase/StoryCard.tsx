import type { Story } from '@/knowledge/types';

interface StoryCardProps {
  story: Story;
}

export function StoryCard({ story }: StoryCardProps) {
  const title = story.title ?? 'Community Story';
  const preview = story.story_text.slice(0, 150);

  return (
    <div className="border rounded-lg p-3 text-xs space-y-1.5 hover:bg-muted/50 transition-colors">
      <h4 className="font-medium text-foreground leading-tight">{title}</h4>
      <p className="text-[10px] text-muted-foreground font-medium">
        {story.attribution}
      </p>
      <p className="text-muted-foreground leading-relaxed">
        {preview}
        {story.story_text.length > 150 ? '...' : ''}
      </p>
    </div>
  );
}
