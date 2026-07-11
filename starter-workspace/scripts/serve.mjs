#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const PREVIEW_HOST = "127.0.0.1";
const DEFAULT_PORT = 8000;
const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);

if (isDirectExecution()) {
  main().catch((error) => {
    console.error(`Preview server failed: ${error.message}`);
    process.exit(1);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const rootDirectory = process.cwd();
  const server = createWorkspaceServer(rootDirectory);
  server.on("error", (error) => {
    console.error(`Preview server failed: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(args.port, PREVIEW_HOST, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : args.port;
    console.log(`Serving ${rootDirectory} at http://${PREVIEW_HOST}:${port}/`);
    console.log("Open /base/index.html or /base/cover-letter-template.html. Press Ctrl+C to stop.");
  });
}

export function parseArgs(argv) {
  const args = { port: DEFAULT_PORT, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--port") {
      args.port = parsePort(argv[++index], "--port");
    } else if (arg.startsWith("--port=")) {
      args.port = parsePort(arg.slice("--port=".length), "--port");
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return args;
}

function parsePort(value, optionName) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${optionName} must be an integer from 0 to 65535.`);
  }
  const port = Number(normalized);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error(`${optionName} must be an integer from 0 to 65535.`);
  }
  return port;
}

function printHelp() {
  console.log(`Usage:
  node scripts/serve.mjs [--port NUMBER]

The server always binds to ${PREVIEW_HOST}. The default port is ${DEFAULT_PORT}.
Use --port 0 to select an available port automatically.
`);
}

export function createWorkspaceServer(rootDirectory) {
  const root = path.resolve(rootDirectory);
  return createServer(async (request, response) => {
    try {
      if (!["GET", "HEAD"].includes(request.method || "")) {
        sendText(response, 405, "Method Not Allowed\n", { Allow: "GET, HEAD" });
        return;
      }

      const requestUrl = new URL(request.url || "/", `http://${PREVIEW_HOST}`);
      let filePath = resolveRequestPath(root, requestUrl.pathname);
      if (!filePath) {
        sendText(response, 403, "Forbidden\n");
        return;
      }

      let fileInfo;
      try {
        fileInfo = await stat(filePath);
        if (fileInfo.isDirectory()) {
          filePath = path.join(filePath, "index.html");
          fileInfo = await stat(filePath);
        }
      } catch {
        sendText(response, 404, "Not Found\n");
        return;
      }

      if (!fileInfo.isFile()) {
        sendText(response, 404, "Not Found\n");
        return;
      }

      const [realRoot, realFile] = await Promise.all([
        realpath(root),
        realpath(filePath),
      ]);
      if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) {
        sendText(response, 403, "Forbidden\n");
        return;
      }

      const body = await readFile(filePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": String(body.length),
        "Content-Type": CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      sendText(response, 500, `Internal Server Error: ${error.message}\n`);
    }
  });
}

export function resolveRequestPath(rootDirectory, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded.includes("\0")) return null;
  const relativePath = decoded.replace(/^[/\\]+/, "");
  const resolved = path.resolve(rootDirectory, relativePath || "index.html");
  const root = path.resolve(rootDirectory);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

function sendText(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  response.end(body);
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}
