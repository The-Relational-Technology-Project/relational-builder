/** Row types matching the RTS Studio Supabase schema */

export interface Tool {
  id: string;
  name: string;
  description: string;
  summary: string | null;
  tool_category: string;
  url: string | null;
  github_url: string | null;
  image_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface Story {
  id: string;
  title: string | null;
  story_text: string;
  full_story_text: string | null;
  attribution: string;
  created_at: string;
}

export interface Prompt {
  id: string;
  title: string;
  description: string | null;
  category: string;
  example_prompt: string;
  parent_tool_id: string | null;
  created_at: string;
}
