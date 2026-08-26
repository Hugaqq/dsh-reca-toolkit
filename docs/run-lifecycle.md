# Run Lifecycle

Gateway states are `queued`, `running`, `interrupted`, `cancelling`,
`cancelled`, `failed`, and `succeeded`.

ReCA stages are independent: `planning`, `asset_generation`, `rendering`,
`validating`, `repairing`, `concat`, `succeeded`, and `failed`.

Audit state is reported separately and can be `audit_pending`,
`audit_running`, `audit_retrying`, `audit_failed`, `audit_skipped`,
`audit_repaired`, or `audited`. A successful video with `audit_failed` is a
valid, diagnosable outcome and must not be presented as audited.

On Gateway restart, active Gateway states are marked `interrupted`. Provider
jobs are never submitted automatically during recovery. `reca_resume` is the
explicit action that lets ReCA inspect its persisted run directory and resume.
Both the dedicated resume endpoint and `resume_run_id` accept only `failed`,
`cancelled`, or `interrupted` runs; a succeeded run is never overwritten.
`interrupted` is already inactive, so cancelling it is an idempotent no-op that
leaves the state `interrupted` and available for explicit resume.

## Harness trace binding

The browser trace is bound by Gateway instance, Harness session, run id, and
the sequence/tool that produced that run. A session cache is used only when the
current conversation window no longer contains the original tool call. A
Gateway instance mismatch or HTTP 404/410 invalidates that cache and terminates
polling instead of retrying forever. Query/global run overrides are explicitly
marked as debug bindings.

Overlay and Details surfaces subscribe only while visible. All polling is
deterministic Host RPC/HTTP work and does not involve an LLM.
