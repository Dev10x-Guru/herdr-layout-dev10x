import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { panes, run, terminals, theme } from "herdr";
import { activeTab, chip, currentAgent, heading, mark, pending, programIcon, quiet, shortPath, since } from "./look.js";

function fact(t, label, value) {
  return h_flex().flex_none().gap(10).text_size(12)
    .child(div().w(76).flex_none().text_color(t.dim).child(label))
    .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(value || "—"));
}

const subStatus = (k) => (k.status === "error" ? "blocked" : k.status === "done" ? "idle" : k.status);

export class Detail {
  init(cx) {
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

  render() {
    const t = theme();
    const tab = activeTab();
    const agent = currentAgent();
    return v_flex().size_full().min_h(0).p(14).gap(14).overflow_y_scrollbar()
      .child(heading(t, "Session"))
      .child(agent ? this.agentSection(t, agent, tab) : quiet(t, "No agent runs in this tab."))
      .child(pending(t, "Callsign and summary",
        "The session's callsign and one-line summary, from the Claude session behind this agent."))
      .child(pending(t, "Tasks",
        "The session's task list: open tasks first, completed ones folded."))
      .child(pending(t, "Waiting to run",
        "The tool call waiting for approval: an edit as a diff, a command as its full text."))
      .child(pending(t, "Recent calls",
        "The session's recent tool calls and how each ended, with pre-approve."))
      .child(pending(t, "Pull request and issue",
        "The PR and issue linked to this branch, with their state."));
  }
}
