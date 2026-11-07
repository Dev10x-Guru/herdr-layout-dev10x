import { agents, exec, home, panes, terminals } from "herdr";
import { sessionAt } from "./fleet.js";

// Transcripts reach several MB, mostly attachments and API logs: scan the last SCAN_BYTES,
// keep only conversation lines, and parse at most KEEP_BYTES of them.
const SCAN_BYTES = 6000000;
const KEEP_BYTES = 1000000;
const CONVERSATION = `tail -c ${SCAN_BYTES} "$1" | grep -E '"type":"(user|assistant)"' | tail -c ${KEEP_BYTES}`;
const POLL_MS = 3000;
const PR_TTL_MS = 60000;
const RECENT = 8;
const MESSAGES = 40;
const MESSAGE_CHARS = 600;

const loaded = new Map();
const teammate = new Map();
const prs = new Map();

export const slugOf = (cwd) => cwd.replace(/[^A-Za-z0-9]/g, "-");

export const ticketOf = (branch) => branch?.match(/\b([A-Z][A-Z0-9]+-\d+)\b/)?.[1] ?? null;

const projectDir = (cwd) => `${home()}/.claude/projects/${slugOf(cwd)}`;

const paneCwd = (agent) => panes().find((p) => p.pane === agent.pane)?.cwd ?? null;

function labelsOf(address) {
  const raw = terminals().find((k) => k.address === address)?.labels;
  if (!raw) return {};
  if (!Array.isArray(raw)) return raw;
  return Object.fromEntries(raw.map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)]));
}

// Newest first; `ls -t` and `wc -c` behave the same on Linux and macOS.
async function transcriptsIn(dir) {
  const r = await exec("ls", ["-t", dir]).catch(() => null);
  return (r?.code === 0 ? r.stdout : "").split("\n").filter((name) => name.endsWith(".jsonl"))
    .map((name) => `${dir}/${name}`);
}

// Team members of a Claude session write their own transcript in the same folder; skip them.
async function isTeammate(path) {
  if (teammate.has(path)) return teammate.get(path);
  const r = await exec("head", ["-c", "4096", path]).catch(() => null);
  const head = r?.stdout ?? "";
  const answer = head.includes('"agentName"');
  if (answer || head.length >= 4096) teammate.set(path, answer);
  return answer;
}

async function sizeOf(path) {
  const r = await exec("wc", ["-c", path]).catch(() => null);
  if (!r || r.code !== 0) return null;
  return { path, size: Number(r.stdout.trim().split(/\s+/)[0]) };
}

// The transcript behind a terminal (`currentTarget()`): a label when Herdr or a hook set one;
// the session `claude agents` runs in that terminal; else, for a Claude Code agent, the newest
// transcripts in its folder paired with that folder's Claude agents by recency.
export async function sessionOf(agent) {
  if (!agent) return null;
  const labels = labelsOf(agent.address);
  const cwd = paneCwd(agent);
  if (labels["claude.transcript"]) return sizeOf(labels["claude.transcript"]);
  if (labels["claude.session"] && cwd) return sizeOf(`${projectDir(cwd)}/${labels["claude.session"]}.jsonl`);
  const running = sessionAt(agent.address);
  if (running) return sizeOf(`${projectDir(running.cwd)}/${running.sessionId}.jsonl`);
  if (!cwd || agent.app !== "claude-code") return null;
  const siblings = agents().filter((a) => a.app === "claude-code" && paneCwd(a) === cwd)
    .sort((x, y) => y.seq - x.seq);
  const wanted = Math.max(0, siblings.findIndex((a) => a.address === agent.address));
  const mine = [];
  for (const path of await transcriptsIn(projectDir(cwd))) {
    if (await isTeammate(path)) continue;
    mine.push(path);
    if (mine.length > wanted) break;
  }
  return mine[wanted] ? sizeOf(mine[wanted]) : null;
}

// A line cut by `tail -c`, or still being written, doesn't parse and is skipped.
function records(text) {
  const out = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch { /* partial line */ }
  }
  return out;
}

const firstLine = (s) => String(s ?? "").split("\n")[0];

export function targetOf(input) {
  if (!input) return "";
  const raw = input.command ?? input.file_path ?? input.notebook_path ?? input.pattern ?? input.url
    ?? input.query ?? input.skill ?? input.subject ?? input.description ?? input.prompt ?? "";
  const line = firstLine(raw);
  return line.startsWith(home() + "/") ? "~" + line.slice(home().length) : line;
}

function textOf(content) {
  if (typeof content === "string") return content;
  return (content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("\n");
}

function trimmed(text) {
  const clean = text.trim();
  return clean.length > MESSAGE_CHARS ? clean.slice(0, MESSAGE_CHARS) + "…" : clean;
}

export function parse(lines) {
  const out = { sessionId: null, branch: null, waiting: null, question: null, tasks: [], recent: [], messages: [] };
  const uses = [];
  const byId = new Map();
  const results = new Map();
  const tasks = new Map();
  const created = new Map();
  let todos = null;
  let lastResult = -1;

  lines.forEach((r, line) => {
    if (r.sessionId) out.sessionId = r.sessionId;
    if (r.gitBranch) out.branch = r.gitBranch;
    if (r.isSidechain || r.isMeta) return;
    const content = r.message?.content;
    if (r.type === "assistant" && Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === "tool_use") {
          const use = { id: block.id, name: block.name, input: block.input ?? {}, line };
          uses.push(use);
          byId.set(block.id, use);
          if (block.name === "TaskUpdate" && block.input?.taskId) {
            const id = String(block.input.taskId);
            if (block.input.status === "deleted") tasks.delete(id);
            else tasks.set(id, { id, subject: block.input.subject ?? tasks.get(id)?.subject ?? `Task #${id}`,
              status: block.input.status ?? tasks.get(id)?.status ?? "pending" });
          }
          if (block.name === "TaskCreate") created.set(block.id, block.input?.subject ?? "");
          if (block.name === "TodoWrite") todos = block.input?.todos ?? [];
        } else if (block?.type === "text" && block.text?.trim()) {
          out.messages.push({ role: "assistant", text: trimmed(block.text) });
        }
      }
    } else if (r.type === "user") {
      if (typeof content === "string") {
        if (!content.startsWith("<")) out.messages.push({ role: "user", text: trimmed(content) });
        return;
      }
      for (const block of content ?? []) {
        if (block?.type === "tool_result") {
          results.set(block.tool_use_id, { error: !!block.is_error });
          lastResult = line;
          const made = textOf(block.content).match(/Task #(\d+) created/);
          if (made && created.has(block.tool_use_id)) {
            const id = made[1];
            tasks.set(id, { id, subject: created.get(block.tool_use_id), status: tasks.get(id)?.status ?? "pending" });
          }
        } else if (block?.type === "text" && block.text?.trim() && !block.text.startsWith("<")) {
          out.messages.push({ role: "user", text: trimmed(block.text) });
        }
      }
    }
  });

  const waiting = uses.find((u) => u.line > lastResult && !results.has(u.id));
  if (waiting) {
    out.waiting = { id: waiting.id, name: waiting.name, input: waiting.input, target: targetOf(waiting.input) };
    if (waiting.name === "AskUserQuestion") out.question = waiting.input.questions ?? [];
  }
  out.tasks = tasks.size
    ? [...tasks.values()].sort((a, b) => Number(a.id) - Number(b.id))
    : (todos ?? []).map((todo, i) => ({ id: String(i + 1), subject: todo.content ?? "", status: todo.status ?? "pending" }));
  out.recent = uses.slice(-RECENT).reverse().map((u) => ({
    id: u.id, name: u.name, target: targetOf(u.input),
    state: results.has(u.id) ? (results.get(u.id).error ? "error" : "ok") : "pending",
  }));
  out.messages = out.messages.slice(-MESSAGES);
  return out;
}

async function titleOf(path) {
  const r = await exec("grep", ["-ohE", '"(customTitle|aiTitle)":"[^"]*"', path]).catch(() => null);
  const found = (r?.stdout ?? "").split("\n").filter(Boolean).map((pair) => {
    try { return JSON.parse(`{${pair}}`); } catch { return {}; }
  }).reverse();
  return found.find((f) => f.customTitle)?.customTitle ?? found.find((f) => f.aiTitle)?.aiTitle ?? null;
}

// Transcripts only grow, so their size is the cache key.
export async function load(file) {
  const key = file.size;
  const hit = loaded.get(file.path);
  if (hit?.key === key) return hit.data;
  const r = await exec("sh", ["-c", CONVERSATION, "sh", file.path]);
  const data = parse(records(r.stdout));
  data.title = await titleOf(file.path);
  data.path = file.path;
  data.partial = file.size > SCAN_BYTES || r.stdout.length >= KEEP_BYTES;
  loaded.set(file.path, { key, data });
  return data;
}

export async function prOf(cwd, branch, ttl = PR_TTL_MS) {
  if (!cwd || !branch) return null;
  const key = `${cwd}\n${branch}`;
  const hit = prs.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const r = await exec("gh", ["pr", "view", "--json", "number,title,state,url,statusCheckRollup"], { cwd }).catch(() => null);
  let value = null;
  try { value = r?.code === 0 ? JSON.parse(r.stdout) : null; } catch { value = null; }
  prs.set(key, { at: Date.now(), value });
  return value;
}

// Follows one agent's session for a part: polls only the agent the part shows, never blocks render.
export class SessionWatch {
  constructor({ withPr = false } = {}) {
    this.withPr = withPr;
    this.address = null;
    this.data = null;
    this.pr = null;
    this.busy = false;
  }

  start(cx, pick) {
    this.pick = pick;
    cx.timer.every(POLL_MS, (cx) => this.poll(cx));
    this.poll(cx);
  }

  // Render calls this so a newly shown agent loads at once, not on the next tick.
  follow(cx) {
    if ((this.pick()?.address ?? null) !== this.address) this.poll(cx);
  }

  poll(cx) {
    if (this.busy) return;
    const agent = this.pick();
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const file = await sessionOf(agent);
        const data = file ? await load(file) : null;
        const cwd = agent ? paneCwd(agent) : null;
        const pr = this.withPr && agent ? await prOf(cwd, data?.branch ?? panes().find((p) => p.pane === agent.pane)?.branch) : null;
        const address = agent?.address ?? null;
        if (address !== this.address || data !== this.data || pr !== this.pr) {
          this.address = address;
          this.data = data;
          this.pr = pr;
          cx.notify();
        }
      } catch (e) {
        console.log(`dev10x session: ${e}`);
      } finally {
        this.busy = false;
      }
    });
  }

  of(agent) {
    return agent && agent.address === this.address ? this.data : null;
  }
}
