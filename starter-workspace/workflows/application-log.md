# Application Log Phase

Read this file only when the user requests tracking, supplies an application status, or asks to inspect `application-log.md`.

## Authorization

Tracking is not a workflow confirmation gate. Treat an explicit tracking request or supplied status as authorization for the matching narrow update. Otherwise leave the log unchanged and report `Not updated`.

Never infer `Submitted` from generated files, a completed analysis, or an application link. Record only a status the user supplied.

## Preserve Manual Edits

When the log includes an `agent-log-hash`:

1. read the full file;
2. remove the hash-comment line from the hash input;
3. compute SHA-256 and compare it with the stored value;
4. preserve and warn about possible manual edits when it differs;
5. make the smallest authorized update;
6. recompute and store the hash.

Do not normalize unrelated rows, rewrite notes globally, or repair historical paths unless requested. Keep notes concise and never invent outcomes or strategy labels.

Report whether the log changed, which status was recorded, whether a stored hash matched, and any unresolved path/history issue.
