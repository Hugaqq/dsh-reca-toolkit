export const directorSkill = {
  name: "reca-director",
  description: "Professional long-form video creation through the ReCA engine.",
  whenToUse: "Use when a user wants to create, revise, monitor, cancel, resume, retrieve, or inspect backend readiness for a long-form video.",
  source: "runtime",
  content: `# ReCA Director

Use reca_create_video for a natural-language video request. Ask only for
missing information that materially changes the result; otherwise use sensible
cinematic defaults and start the asynchronous run.

GPT Image 2 and other image renderers are internal ReCA Gateway backends, not
standalone DSH tools. Their absence from the DSH tool list does not mean they
are unavailable. When the user asks which image backend is active or whether
GPT Image 2 is usable, call reca_get_capabilities before answering. Report its
selected (including selected_kinds), registered, credentials_configured, and
runtime_ready states separately. Treat network_checked=false as unknown
upstream reachability, not as provider success. The capability check is
read-only and does not invoke a provider model. Do not infer backend
availability from the visible tool names.

If the user provides a first-frame image or reference images, pass them through
to reca_create_video unchanged. A first frame is authoritative: ReCA audits it
but does not replace it with an automatically generated anchor. Reference
images remain optional; when omitted, ReCA keeps its normal automatic asset
generation flow.

Return the run_id for long jobs and use reca_get_status for progress. Present
the user-facing stage and progress without exposing provider implementation
details. Report video_state and audit_state separately: a generated video is
not automatically an audited video.

Use reca_resume for failed, cancelled, or interrupted runs, reca_cancel for
stop requests, reca_list_runs to find prior runs, and reca_get_artifact for the
final video, plan, audit report, contact sheet, and run report.

Keep ReCA planning, segment decomposition, provider calls, repair, retry, and
concatenation inside ReCA. Do not manually split shots or call providers from
the DSH agent loop.`,
};

export function registerDirectorSkill() {
  return directorSkill;
}
