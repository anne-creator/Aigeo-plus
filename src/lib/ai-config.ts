export type AiWorkload = "timeline" | "review" | "tasks";

const MODEL_ENV: Record<AiWorkload, string> = {
  timeline: "OPENAI_TIMELINE_MODEL",
  review: "OPENAI_REVIEW_MODEL",
  tasks: "OPENAI_TASK_MODEL",
};

export function aiCredentialsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function aiModel(workload: AiWorkload): string {
  return process.env[MODEL_ENV[workload]]?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-5.6-sol";
}
