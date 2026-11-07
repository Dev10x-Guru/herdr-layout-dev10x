import { exec, hc, panes, setShared, shared } from "herdr";

const KEY = "dev10x.fleet";
const EMPTY = { byAddress: {}, elsewhere: [], at: 0, error: null };

// Claude Code started in a shell reports nothing to Herdr, so its status comes from
// `claude agents --json`, the list the Overwatch daemon reads.
export const STATUS = { waiting: "blocked", busy: "working", idle: "idle" };

export const fleet = () => shared(KEY) ?? EMPTY;

export const sessionAt = (address) => fleet().byAddress[address] ?? null;

const localClaude = (p) => p.terminal && !p.terminal.includes("/") && p.program?.key === "claude";

async function pidAt(address) {
  const r = await hc(["get", address]).catch(() => null);
  if (r?.code !== 0) return null;
  try {
    return JSON.parse(r.stdout).foreground?.pid ?? null;
  } catch {
    return null;
  }
}

function publish(next) {
  const { at: _at, ...now } = next;
  const { at: _was, ...was } = fleet();
  const sameMinute = Math.floor(next.at / 60000) === Math.floor(fleet().at / 60000);
  if (sameMinute && JSON.stringify(now) === JSON.stringify(was)) return;
  setShared(KEY, next);
}

// Only the process id ties a session to its terminal: several sessions share one folder,
// and most running sessions live outside this window.
export async function refreshFleet() {
  const r = await exec("claude", ["agents", "--json"]).catch((e) => ({ code: 1, stderr: String(e) }));
  if (r.code !== 0) {
    publish({ ...fleet(), at: Date.now(), error: r.stderr.trim() || "claude agents failed" });
    return;
  }
  const sessions = JSON.parse(r.stdout);
  const byPid = new Map(sessions.map((s) => [s.pid, s]));
  const byAddress = {};
  const here = new Set();
  for (const p of panes().filter(localClaude)) {
    const session = byPid.get(await pidAt(p.terminal));
    if (!session) continue;
    byAddress[p.terminal] = session;
    here.add(session.sessionId);
  }
  publish({ byAddress, elsewhere: sessions.filter((s) => !here.has(s.sessionId)), at: Date.now(), error: null });
}
