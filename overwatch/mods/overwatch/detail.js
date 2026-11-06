import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { panes, run, settings, terminals, theme } from "herdr";
import { activeTab, card, chip, currentAgent, heading, mark, programIcon, quiet, shortPath, since } from "./look.js";
import { SessionWatch, ticketOf } from "./session.js";

function fact(t, label, value) {
  return h_flex().flex_none().gap(10).text_size(12)
    .child(div().w(76).flex_none().text_color(t.dim).child(label))
    .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(value || "—"));
}

const subStatus = (k) => (k.status === "error" ? "blocked" : k.status === "done" ? "idle" : k.status);

const TASK_MARK = { completed: "done", in_progress: "working", pending: "idle" };

function line(t, left, text, color) {
  return h_flex().flex_none().gap(8).items_center().text_size(12)
    .child(left)
    .child(div().flex_1().min_w(0).truncate().text_color(color ?? t.foreground).child(text));
}

export class Detail {
  init(cx) {
    this.watch = new SessionWatch({ withPr: true });
    this.watch.start(cx, currentAgent);
    this.showDone = false;
    cx.timer.every(30000, (cx) => cx.notify());
  }

  agentSection(t, agent, tab) {
    const p = panes().find((each) => each.pane === agent.pane);
    const kids = terminals().filter((k) => k.parent === agent.address && k.state === "live");
    return v_flex().flex_none().gap(8)
      .child(h_flex().gap(8).items_center()
        .child(programIcon(agent.program, 16, t.foreground) ?? div().w(16).flex_none())
        .child(div().flex_1().min_w(0).truncate().text_size(14).font_semibold().text_color(t.foreground)
          .child(agent.program.name))
        .child(chip(t, agent.status) ?? div()))
      .child(fact(t, "Title", agent.title))
      .child(fact(t, "Terminal", agent.address))
      .child(fact(t, "Folder", shortPath(p?.cwd)))
      .child(fact(t, "Branch", p?.branch))
      .child(fact(t, "Working", tab?.working_since ? since(tab.working_since) : ""))
      .when(kids.length > 0, (el) => el
        .child(div().pt(4).text_size(11.5).text_color(t.dim).child(`Sub-agents (${kids.length})`))
        .children(kids.map((k) => h_flex().id(`ow-sub-${k.address}`).h(24).px(6).gap(8).items_center()
          .rounded(5).text_size(12).hover((s) => s.bg(t.hover))
          .on_click(() => run("terminal.peek", { terminal: k.address }))
          .child(mark(t, subStatus(k)))
          .child(div().flex_1().min_w(0).truncate().text_color(t.muted)
            .child(k.name || k.template || k.program?.name || k.address)))));
  }

  tasksCard(t, s) {
    const open = s.tasks.filter((k) => k.status !== "completed");
    const done = s.tasks.filter((k) => k.status === "completed");
    return card(t, "Tasks", `${done.length}/${s.tasks.length} done`, [
      ...open.map((k) => line(t, mark(t, TASK_MARK[k.status] ?? "idle"), k.subject)),
      done.length > 0
        ? div().id("ow-tasks-done").flex_none().text_size(11.5).text_color(t.dim).hover((st) => st.text_color(t.foreground))
          .on_click((_e, cx) => { this.showDone = !this.showDone; cx.notify(); })
          .child(`${this.showDone ? "▾" : "▸"} ${done.length} completed`)
        : null,
      ...(this.showDone ? done.map((k) => line(t, mark(t, "done"), k.subject, t.muted)) : []),
    ].filter(Boolean));
  }

  waitingCard(t, s, agent) {
    const w = s.waiting;
    const title = agent.status === "blocked" ? "Waiting to run" : "Running";
    return card(t, title, w.name, [
      div().text_size(12).font_family(settings().font_family ?? "JetBrains Mono").text_color(t.foreground).child(w.target || "—"),
    ]);
  }

  recentCard(t, s) {
    return card(t, "Recent calls", null, s.recent.map((r) => line(t,
      div().w(12).flex_none().text_size(11).text_color(r.state === "error" ? t.blocked : r.state === "ok" ? t.done : t.dim)
        .child(r.state === "error" ? "✕" : r.state === "ok" ? "✓" : "…"),
      r.target ? `${r.name}  ${r.target}` : r.name)));
  }

  prCard(t, s, agent) {
    const branch = s.branch ?? panes().find((p) => p.pane === agent.pane)?.branch;
    const ticket = ticketOf(branch);
    const pr = this.watch.pr;
    return card(t, "Pull request and issue", null, [
      fact(t, "Issue", ticket),
      fact(t, "Pull request", pr ? `#${pr.number} ${pr.state.toLowerCase()}` : ""),
      pr ? div().text_size(12).text_color(t.muted).child(pr.title) : null,
    ].filter(Boolean));
  }

  render(cx) {
    const t = theme();
    const tab = activeTab();
    const agent = currentAgent();
    this.watch.follow(cx);
    const s = this.watch.of(agent);
    return v_flex().size_full().min_h(0).p(14).gap(14).overflow_y_scrollbar()
      .child(heading(t, "Session"))
      .child(agent ? this.agentSection(t, agent, tab) : quiet(t, "No agent runs in this tab."))
      .when(!!agent && !s, (el) => el.child(quiet(t, agent.app !== "claude-code"
        ? "Session details come from Claude Code transcripts; this agent isn't Claude Code."
        : this.watch.address === agent.address
          ? "No Claude transcript found for this agent's folder."
          : "Looking for its Claude session…")))
      .when(!!s?.title, (el) => el.child(card(t, s.title, s.sessionId?.slice(0, 8), [])))
      .when(!!s && s.tasks.length > 0, (el) => el.child(this.tasksCard(t, s)))
      .when(!!s?.waiting, (el) => el.child(this.waitingCard(t, s, agent)))
      .when(!!s && s.recent.length > 0, (el) => el.child(this.recentCard(t, s)))
      .when(!!s, (el) => el.child(this.prCard(t, s, agent)));
  }
}
