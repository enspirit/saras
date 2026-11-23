// A prompt: a way of replying.
export interface PromptRow {
  id: number;
  org_id: number;
  user_id: number;
  name: string;
  description: string;
  system_prompt: string;
  created_at: Date;
}
