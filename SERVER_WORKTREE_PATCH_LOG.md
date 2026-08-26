# Server Worktree Patch Log

This document records surgical fixes applied to the dirty server worktree at:

```text
/mnt/cpfs02/akide/us/haoming/dsh-reca-toolkit
```

Policy:

1. When the server Git worktree is dirty, record the target, original content,
   replacement content, reason, verification, and rollback before applying a
   patch.
2. Never use a broad checkout/reset to apply or undo one fix.
3. Re-check the target file hash immediately before upload so concurrent edits
   are not overwritten.
4. Do not record credential values, private endpoint values, or `.env` content.
5. Append later dirty-worktree fixes as new entries using this same format.

## 2026-08-20 — Restore GPT Image 2 runtime mapping in `_smoke.py`

### Status

Applied and validated on 2026-08-20.

```text
Post-change SHA-256: 836895f2106bcc755f4b5fcfc14c48a12ac17d07594c240f9c9171329ad7b4a3
```

### Target

```text
Server: wan-dev-node-02-H100-haoming
Repository: /mnt/cpfs02/akide/us/haoming/dsh-reca-toolkit
Git branch: main
Git HEAD: aa95d1b
File: videorlm/framework/_scripts/_smoke.py
Pre-change SHA-256: 6a86b22a01bc89c1e52707b801493572908701df439cc2bee61037a70c456a41
Function: load_env()
Insertion point: immediately after the `.env` parsing loop and before the
DashScope fallback block
```

### Context and symptom

ReCA routes portrait, anchor, and image-edit requests to `gpt-image-2`, whose
OpenAI SDK client expects `OPENAI_BASE_URL` and `OPENAI_API_KEY`. The surrounding
ReCA runtime uses `RECA_GPT_RESPONSES_URL` and `RECA_GPT_API_KEY` for the same
internal GPT service. The server worktree removed the adapter between those two
naming conventions.

As a result, new image DAGs reached a different inherited/default endpoint and
every GPT Image 2 node returned HTTP 404. Each node retried 17 times, after
which ReCA reported unreachable image-DAG nodes. Earlier runs using the same
image backend had succeeded, so the prompts and model choice were not the
cause.

No environment or configuration values were inspected while diagnosing or
recording this patch.

### Original content

The `.env` parsing loop currently flows directly into the DashScope fallback:

```python
        file_values[key] = value
        os.environ.setdefault(key, value)
    # The working AVM deployment uses the DashScope OpenAI-compatible image
    # route for ReCA's image backends. Keep this fallback local to the
    # smoke/gateway entry point so the public source never contains a provider
    # credential and an explicit OPENAI_* override still wins.
    if not os.environ.get("OPENAI_API_KEY") and os.environ.get("DASHSCOPE_API_KEY"):
        os.environ["OPENAI_API_KEY"] = os.environ["DASHSCOPE_API_KEY"]
```

### Replacement content

Insert the following mapping block before the existing DashScope fallback:

```python
        file_values[key] = value
        os.environ.setdefault(key, value)
    # Gateway workers inherit the long-lived gateway environment. The internal
    # GPT credential is configured for the Responses endpoint, while the image
    # backend uses the OpenAI Images SDK. Derive the shared API base and map the
    # credential name without exposing either value.
    if file_values.get("RECA_GPT_RESPONSES_URL") and not file_values.get("OPENAI_BASE_URL"):
        responses_url = file_values["RECA_GPT_RESPONSES_URL"].rstrip("/")
        if responses_url.endswith("/responses"):
            os.environ["OPENAI_BASE_URL"] = responses_url[: -len("/responses")]
    if not os.environ.get("OPENAI_API_KEY") and os.environ.get("RECA_GPT_API_KEY"):
        os.environ["OPENAI_API_KEY"] = os.environ["RECA_GPT_API_KEY"]

    # The working AVM deployment uses the DashScope OpenAI-compatible image
    # route for ReCA's image backends. Keep this fallback local to the
    # smoke/gateway entry point so the public source never contains a provider
    # credential and an explicit OPENAI_* override still wins.
    if not os.environ.get("OPENAI_API_KEY") and os.environ.get("DASHSCOPE_API_KEY"):
        os.environ["OPENAI_API_KEY"] = os.environ["DASHSCOPE_API_KEY"]
```

### Behavioral change

- If the local runtime configuration has a Responses endpoint and no explicit
  Images base, strip only the terminal `/responses` component and provide the
  resulting `/v1` API base to the Images SDK.
- If the generic OpenAI SDK key is absent but the ReCA GPT key is available,
  expose the same credential under the SDK-compatible variable name.
- Preserve an explicitly configured `OPENAI_BASE_URL`.
- Preserve the existing DashScope fallback when no ReCA GPT mapping is
  available.

### Verification

1. Confirmed the remote file still matched the pre-change hash immediately
   before upload.
2. `python -m py_compile videorlm/framework/_scripts/_smoke.py`: passed.
3. Isolated mapping test with placeholder endpoint and key values: passed. It
   verified that an inherited unrelated base is replaced by the base derived
   from the configured Responses endpoint and that the ReCA GPT key is exposed
   under the OpenAI SDK variable name. No real values were printed.
4. Real one-image GPT Image 2 smoke: passed.

```text
Backend: gpt-image-2
Output: /tmp/dsh-reca-gpt-image2-mapping-smoke-20260820/portrait.png
Output bytes: 1125639
HTTP 404: not reproduced
```

The direct backend smoke returned a valid local image with no public URL. The
dirty server `pipeline.py` currently rejects non-HTTP image results, so that is
a separate follow-up blocker for full ReCA runs. It is intentionally not
changed under this patch entry.

### Rollback

Remove only the inserted mapping block shown above. Do not reset or checkout
the complete file because it contains unrelated uncommitted server changes.
The pre-change temporary snapshot for this maintenance session is:

```text
/private/tmp/dsh-reca-smoke.prechange.py
```

That snapshot is a short-lived safety artifact and is not a substitute for the
recorded inverse patch.

## 2026-08-20 — Accept valid local GPT Image results in `pipeline.py`

### Status

Applied and validated on 2026-08-20.

```text
Post-change SHA-256: 13b36d313a12548e93b0415f6d761db7571473b945a0caeb04aba53c86fd4ef5
```

### Target

```text
Server: wan-dev-node-02-H100-haoming
Repository: /mnt/cpfs02/akide/us/haoming/dsh-reca-toolkit
Git branch: main
Git HEAD: aa95d1b
File: videorlm/framework/pipeline.py
Pre-change SHA-256: cfc64c055bbe6f3e621807fb7354d90995fa998be0b4e1067d46f7f51aa67979
Function: _dispatch_one_image()
```

### Context and symptom

After the `_smoke.py` mapping fix, a real GPT Image 2 request succeeded and
wrote a 1,125,639-byte local PNG. The backend returned no public URL because no
publisher URL was available in that process. The dirty server `pipeline.py`
currently rejects every non-HTTP result even when the returned local file
exists, so a complete ReCA image DAG would fail immediately after successful
image generation.

Wan3.0 can stage readable local media, and the Git HEAD implementation already
treats an existing local file as a valid cache/result. This patch restores only
that behavior. It does not restore Director inputs, source-anchor chaining, or
any other removed pipeline feature.

### Original content

Cached local results always attempt publication and then fail if publication
is unavailable:

```python
    if cached:
        if cached.startswith("http"):
            print(f"[render-skip] {rr['request_id']} cached -> {cached[:80]}", flush=True)
            return cached
        new_url = _republish_local_to_oss(
            cached,
            request_id=rr["request_id"],
            kind=kind,
            log_dir=rr.get("log_dir"),
        )
```

Fresh local results are rejected solely because they are not HTTP URLs:

```python
    result = dispatch_image(req)
    url = getattr(result, "output_url", None) or getattr(result, "output_path", None) or ""
    if not url.startswith("http"):
        raise RuntimeError(
            f"_dispatch_one_image[{rr['request_id']}]: refusing to cache non-URL "
            f"({url!r}); OSS publish likely failed"
        )
    _save_cached_url(rr.get("output_path"), url)
```

### Replacement content

Update the function description from “all non-HTTP results fail” to “results
fail only when they are neither HTTP URLs nor existing local files.”

Return a readable cached local file before attempting publication:

```python
    if cached:
        if cached.startswith("http"):
            print(f"[render-skip] {rr['request_id']} cached -> {cached[:80]}", flush=True)
            return cached
        if Path(cached).is_file():
            print(f"[render-skip-local] {rr['request_id']} cached -> {cached}", flush=True)
            return cached
        new_url = _republish_local_to_oss(
            cached,
            request_id=rr["request_id"],
            kind=kind,
            log_dir=rr.get("log_dir"),
        )
```

Accept a fresh non-HTTP result only when it is a real local file:

```python
    result = dispatch_image(req)
    url = getattr(result, "output_url", None) or getattr(result, "output_path", None) or ""
    if not url.startswith("http") and not Path(url).is_file():
        raise RuntimeError(
            f"_dispatch_one_image[{rr['request_id']}]: refusing to cache non-URL "
            f"({url!r}); OSS publish likely failed"
        )
    if not url.startswith("http"):
        print(f"[render-local] {rr['request_id']} -> {url}", flush=True)
    _save_cached_url(rr.get("output_path"), url)
```

### Verification

1. Confirmed the remote file still matched the recorded pre-change hash
   immediately before upload.
2. `python -m py_compile videorlm/framework/pipeline.py`: passed.
3. Mocked local-result boundary test: passed.
   - Existing local result accepted.
   - Second call used the local cache without dispatching again.
   - Missing local result remained rejected.
4. Pipeline-level real GPT Image 2 smoke: passed.

```text
Output: /tmp/dsh-reca-pipeline-image-smoke-20260820/portrait.png
Output bytes: 1061444
Resolved result: existing local path
Sidecar cache: created
HTTP 404: not reproduced
Non-URL rejection: not reproduced for the valid local file
```

### Rollback

Remove only the two local-file acceptance branches shown above. Do not reset or
checkout the complete file. The pre-change temporary snapshot for this
maintenance session is:

```text
/private/tmp/dsh-reca-pipeline.prechange.py
```
