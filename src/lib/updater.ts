import { spawn } from "node:child_process";
import path from "node:path";

/**
 * In-app software update for a git + npm deployment. Runs on the server host as
 * the service user, so it needs a git checkout it can pull and write access to
 * node_modules/.next. Restarting the service (to load the new build) uses the
 * caller-provided system password piped to `sudo -S` — the password is only
 * ever passed to sudo's stdin and never stored or logged.
 */

// Ensure node's own bin dir is on PATH so `npm` resolves under systemd's
// minimal PATH.
function childEnv(): NodeJS.ProcessEnv {
  const nodeDir = path.dirname(process.execPath);
  return { ...process.env, PATH: `${nodeDir}:${process.env.PATH ?? ""}` };
}

function run(
  cmd: string,
  args: string[],
  opts: { input?: string; timeoutMs?: number } = {}
): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: process.cwd(), env: childEnv() });
    let output = "";
    const cap = (d: Buffer) => {
      output += d.toString();
      if (output.length > 200_000) output = output.slice(-200_000); // cap memory
    };
    child.stdout.on("data", cap);
    child.stderr.on("data", cap);
    if (opts.input !== undefined) {
      child.stdin.write(opts.input);
      child.stdin.end();
    }
    const timer = opts.timeoutMs ? setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs) : undefined;
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, output });
    });
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      resolve({ code: -1, output: `${output}\n${e.message}` });
    });
  });
}

export type UpdateCheck = {
  ok: boolean;
  reason?: string;
  branch?: string;
  behind?: number;
  current?: string;
  latest?: string;
};

/** Fetch and report how far behind the tracked upstream branch this checkout is. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  const isRepo = (await run("git", ["rev-parse", "--is-inside-work-tree"])).output.trim().startsWith("true");
  if (!isRepo) return { ok: false, reason: "This install isn’t a git checkout, so in-app updates aren’t available." };
  const fetched = await run("git", ["fetch", "--quiet"], { timeoutMs: 60_000 });
  if (fetched.code !== 0) return { ok: false, reason: fetched.output.trim() || "git fetch failed" };
  const branch = (await run("git", ["rev-parse", "--abbrev-ref", "HEAD"])).output.trim();
  const upstream = (await run("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"])).output.trim();
  if (!upstream) return { ok: true, branch, behind: 0, reason: "no_upstream" };
  const behind = Number((await run("git", ["rev-list", "--count", "HEAD..@{u}"])).output.trim()) || 0;
  const current = (await run("git", ["log", "-1", "--format=%h · %s"])).output.trim();
  const latest = (await run("git", ["log", "-1", "--format=%h · %s", "@{u}"])).output.trim();
  return { ok: true, branch, behind, current, latest };
}

/** git pull → npm install → npm run build. Returns combined output. */
export async function runUpdate(): Promise<{ ok: boolean; output: string }> {
  let output = "";
  const steps: Array<[string, string[]]> = [
    ["git", ["pull", "--ff-only"]],
    ["npm", ["install", "--no-audit", "--no-fund"]],
    ["npm", ["run", "build"]],
  ];
  for (const [cmd, args] of steps) {
    output += `\n$ ${cmd} ${args.join(" ")}\n`;
    const r = await run(cmd, args, { timeoutMs: 10 * 60_000 });
    output += r.output;
    if (r.code !== 0) return { ok: false, output };
  }
  return { ok: true, output: `${output}\n✓ Build complete. Restart to apply.` };
}

/** Restart the systemd service via `sudo -S` (password from stdin, never stored).
 *  On success this kills the current process, so the call usually won't return. */
export async function restartApp(password: string, service: string): Promise<{ ok: boolean; output: string }> {
  const svc = service.trim();
  if (!/^[A-Za-z0-9_.@-]+$/.test(svc)) return { ok: false, output: "Invalid service name." };
  const r = await run("sudo", ["-S", "-k", "systemctl", "restart", svc], {
    input: `${password}\n`,
    timeoutMs: 30_000,
  });
  return { ok: r.code === 0, output: r.output };
}
