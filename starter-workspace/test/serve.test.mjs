import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createWorkspaceServer,
  parseArgs,
  PREVIEW_HOST,
  resolveRequestPath,
} from "../scripts/serve.mjs";

test("preview server stays local and serves workspace files", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "resume-serve-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, "index.html"), "synthetic preview\n", "utf8");

  const server = createWorkspaceServer(directory);
  const result = await dispatch(server, { method: "GET", url: "/" });
  assert.equal(PREVIEW_HOST, "127.0.0.1");
  assert.equal(result.status, 200);
  assert.equal(result.body.toString("utf8"), "synthetic preview\n");
});

function dispatch(server, request) {
  return new Promise((resolve) => {
    const response = {
      status: 0,
      headers: {},
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers;
      },
      end(body = Buffer.alloc(0)) {
        resolve({
          status: this.status,
          headers: this.headers,
          body: Buffer.isBuffer(body) ? body : Buffer.from(String(body)),
        });
      },
    };
    server.emit("request", request, response);
  });
}

test("preview server rejects traversal and validates port options", () => {
  const root = path.resolve("synthetic-root");
  assert.equal(resolveRequestPath(root, "/../outside.txt"), null);
  assert.equal(resolveRequestPath(root, "/%2e%2e/outside.txt"), null);
  assert.deepEqual(parseArgs(["--port", "0"]), { port: 0, help: false });
  assert.throws(() => parseArgs(["--port", "70000"]), /0 to 65535/);
});
