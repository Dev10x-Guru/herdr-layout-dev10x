import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, panes, run, settings, theme } from "herdr";
import { sessionAt } from "./fleet.js";
import { activeSpace, activeTab, card, chip, currentStatus, currentTarget, heading, mark, programIcon, quiet, shortPath, since, tabStatus } from "./look.js";
import { prOf, SessionWatch, ticketOf } from "./session.js";

const POLL_MS = 5000;
const TASK_MARK = { completed: "done", in_progress: "working", pending: "idle" };
const CALL_MARK = { ok: "done", error: "blocked", pending: "working" };
const CALL_WORD = { ok: "ran", error: "failed", pending: "waiting" };
const FAILED = new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE", "ERROR"]);

// `gh` mixes check runs (status + conclusion) and commit statuses (state) in one list.
export function checksOf(rollup) {
  const out = { passed: 0, failed: 0, running: 0 };
  for (const c of rollup ?? []) {
    const result = c.conclusion || c.state;
    if ((c.status && c.status !== "COMPLETED") || result === "PENDING" || result === "EXPECTED") out.running += 1;
    else if (FAILED.has(result)) out.failed += 1;
    else out.passed += 1;
  }
  return out;
}

function fact(t, label, value) {
  return h_flex().flex_none().gap(10).text_size(12)
    .child(div().w(64).flex_none().text_color(t.dim).child(label))
    .child(div().flex_1().min_w(0).truncate().text_color(value ? t.foreground : t.dim).child(value || "—"));
}

function line(t, left, text, color) {
  return h_flex().flex_none().gap(8).items_center().text_size(12)
    .child(left)
    .child(div().flex_1().min_w(0).truncate().text_color(color ?? t.foreground).child(text));
}

// The shown tab's folder and branch: its focused terminal, else its first one.
function where() {
  const tab = activeTab();
  if (!tab) return null;
  const mine = panes().filter((p) => p.tab === tab.id && p.terminal);
  const p = mine.find((each) => each.focused) ?? mine[0];
  return p ? { cwd: p.cwd, branch: p.branch } : null;
}

const keyOf = (w) => (w ? `${w.cwd}\n${w.branch}` : null);

export class Work {
  init(cx) {
    this.watch = new SessionWatch();
    this.watch.start(cx, currentTarget);
    this.pr = null;
    this.prKey = null;
    this.busy = false;
    this.showDone = false;
    cx.timer.every(POLL_MS, (cx) => this.poll(cx));
    cx.timer.every(30000, (cx) => cx.notify());
    this.poll(cx);
  }

  poll(cx) {
    if (this.busy) return;
    const w = where();
    const local = !activeSpace()?.machine;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const pr = w && local ? await prOf(w.cwd, w.branch) : null;
        if (keyOf(w) !== this.prKey || pr !== this.pr) {
          this.prKey = keyOf(w);
          this.pr = pr;
          cx.notify();
        }
      } catch (e) {
        console.log(`dev10x work: ${e}`);
      } finally {
        this.busy = false;
      }
    });
  }

  prCard(t, w, pr) {
    if (!pr) {
      return card(t, "Pull request", null, [quiet(t, w?.branch
        ? "No pull request found for this branch (needs gh)."
        : "This tab's folder has no git branch.")]);
    }
    const c = checksOf(pr.statusCheckRollup);
    const total = c.passed + c.failed + c.running;
    const summary = [c.failed && `${c.failed} failing`, c.running && `${c.running} running`, c.passed && `${c.passed} passed`]
      .filter(Boolean).join(" · ");
    return card(t, `#${pr.number} ${pr.title}`, pr.state.toLowerCase(), [
      h_flex().flex_none().gap(8).items_center().text_size(12)
        .child(mark(t, c.failed ? "blocked" : c.running ? "working" : total ? "done" : null))
        .child(div().flex_1().min_w(0).truncate()
          .text_color(c.failed ? t.blocked : t.muted).child(total ? `Checks: ${summary}` : "No checks")),
    ]);
  }

  agentsCard(t, mine) {
    return card(t, "Agents", String(mine.length), mine.map((a) => h_flex().id(`dx-work-agent-${a.address}`)
      .flex_none().h(24).px(4).gap(8).items_center().rounded(5).text_size(12)
      .hover((s) => s.bg(t.hover))
      .on_click(() => run("pane.focus", { terminal: a.address }))
      .child(mark(t, a.status))
      .child(programIcon(a.program, 13, t.dim) ?? div().w(13).flex_none())
      .child(div().flex_none().text_color(t.foreground).child(a.program.name))
      .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(a.title))));
  }

  tasksCard(t, s) {
    const open = s.tasks.filter((k) => k.status !== "completed");
    const done = s.tasks.filter((k) => k.status === "completed");
    return card(t, "Tasks", `${done.length}/${s.tasks.length} done`, [
      ...open.map((k) => line(t, mark(t, TASK_MARK[k.status] ?? "idle"), k.subject)),
      done.length > 0
        ? div().id("dx-tasks-done").flex_none().text_size(11.5).text_color(t.dim).hover((st) => st.text_color(t.foreground))
          .on_click((_e, cx) => { this.showDone = !this.showDone; cx.notify(); })
          .child(`${this.showDone ? "▾" : "▸"} ${done.length} completed`)
        : null,
      ...(this.showDone ? done.map((k) => line(t, mark(t, "done"), k.subject, t.muted)) : []),
    ].filter(Boolean));
  }

  waitingCard(t, s) {
    return card(t, currentStatus() === "blocked" ? "Waiting to run" : "Running", s.waiting.name, [
      div().text_size(12).font_family(settings().font_family ?? "JetBrains Mono").text_color(t.foreground)
        .child(s.waiting.target || "—"),
    ]);
  }

  recentCard(t, s) {
    return card(t, "Recent calls", null, s.recent.map((call) => h_flex().flex_none().gap(8).items_center().text_size(12)
      .child(mark(t, CALL_MARK[call.state]))
      .child(div().flex_none().text_color(t.foreground).child(call.name))
      .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(call.target))
      .child(div().flex_none().text_size(11).text_color(call.state === "error" ? t.ansi1 : t.dim).child(CALL_WORD[call.state]))));
  }

  render(cx) {
    const t = theme();
    const space = activeSpace();
    const tab = activeTab();
    const body = v_flex().size_full().min_h(0).p(14).gap(12).overflow_y_scrollbar().child(heading(t, "Work"));
    if (!space || !tab) return body.child(quiet(t, "No tab is shown."));
    const w = where();
    if (keyOf(w) !== this.prKey) this.poll(cx);
    this.watch.follow(cx);
    const agent = currentTarget();
    const s = this.watch.of(agent);
    const mine = agents().filter((a) => a.tab === tab.id);
    const branch = w?.branch ?? space.branch;
    const pr = keyOf(w) === this.prKey ? this.pr : null;
    const status = tabStatus(tab);
    const running = agent ? sessionAt(agent.address) : null;
    return body
      .child(h_flex().flex_none().gap(8).items_center().text_size(13)
        .child(mark(t, status))
        .child(div().flex_none().max_w(160).truncate().text_color(t.muted).child(space.name))
        .child(div().flex_none().text_color(t.dim).child("/"))
        .child(div().flex_1().min_w(0).truncate().font_semibold().text_color(t.foreground).child(tab.name))
        .child(chip(t, status) ?? div()))
      .child(v_flex().flex_none().gap(6)
        .child(fact(t, "Branch", branch))
        .child(fact(t, "Ticket", ticketOf(branch) ?? ticketOf(running?.name)))
        .child(fact(t, "Folder", shortPath(w?.cwd)))
        .when(!!tab.working_since, (el) => el.child(fact(t, "Working", since(tab.working_since))))
        .child(fact(t, "Session", running?.name ?? (s ? s.title || s.sessionId?.slice(0, 8) : ""))))
      .child(this.prCard(t, w, pr))
      .when(mine.length > 0, (el) => el.child(this.agentsCard(t, mine)))
      .when(!!s && s.tasks.length > 0, (el) => el.child(this.tasksCard(t, s)))
      .when(!!s?.waiting, (el) => el.child(this.waitingCard(t, s)))
      .when(!!s && s.recent.length > 0, (el) => el.child(this.recentCard(t, s)));
  }
}
