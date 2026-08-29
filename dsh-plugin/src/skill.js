export const directorSkill = {
  name: "reca-director",
  description: "Professional long-form video creation through the ReCA engine.",
  whenToUse: "Use when a user wants to create, revise, monitor, cancel, resume, retrieve, or inspect backend readiness for a long-form video.",
  source: "runtime",
  content: `# ReCA Director

Use reca_create_video_interactive when the user explicitly asks for
"Interactive", "ask me first", "confirm before generating", or Demo tuning.
Give the tool at most three clarifying questions in one batch. Ask only about
missing preferences that materially change the result, prioritizing sound
design, character consistency, scene/spatial logic, and camera rhythm. Never
repeat information already established in the conversation or structured
brief. The tool itself collects the answers, presents the Creative Brief, and
submits a run only after explicit approval.

Use reca_create_video when the user asks to generate directly, run
automatically, or run a batch. Otherwise use sensible cinematic defaults and
start the asynchronous run without the interactive review. If an interactive
review is declined, dismissed, cancelled, or unavailable, stop and wait for
the user's next message. Never fall back to reca_create_video after an
interactive path fails or is not approved.

Interactive creation defaults to backend=wan, force_i2v=false,
resolution=1280x720, aspect_ratio=16:9, and enable_audit=true. This is
R2V-preferred rather than an absolute guarantee; ReCA may fall back when a
segment has no usable reference media. Preserve the existing automatic tool's
defaults separately.

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
to the selected creation tool unchanged. A first frame is authoritative: ReCA audits it
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
Resume an existing run directly; do not repeat the Creative Brief review.

Keep ReCA planning, segment decomposition, provider calls, repair, retry, and
concatenation inside ReCA. Do not manually split shots or call providers from
the DSH agent loop.`,
};

export function registerDirectorSkill() {
  return directorSkill;
}
