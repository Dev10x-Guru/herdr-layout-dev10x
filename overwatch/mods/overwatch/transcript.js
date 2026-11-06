import { div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { theme } from "herdr";
import { currentAgent, heading, quiet } from "./look.js";
import { SessionWatch } from "./session.js";

function bubble(t, m) {
  const mine = m.role === "user";
  return v_flex().flex_none().gap(3).p(8).rounded(6)
    .when(mine, (el) => el.ml(24).bg(t.selected))
    .when(!mine, (el) => el.mr(24).bg(t.surface).border(1).border_color(t.border))
    .child(div().text_size(10.5).font_semibold().text_color(t.dim).child(mine ? "YOU" : "CLAUDE"))
    .child(div().text_size(12).text_color(t.foreground).child(m.text));
}

export class Transcript {
  init(cx) {
    this.watch = new SessionWatch();
    this.watch.start(cx, currentAgent);
  }

  render(cx) {
    const t = theme();
    const agent = currentAgent();
    this.watch.follow(cx);
    const s = this.watch.of(agent);
    const body = v_flex().size_full().min_h(0).p(14).gap(8).overflow_y_scrollbar()
      .child(heading(t, "Transcript"));
    if (!agent) return body.child(quiet(t, "No agent runs in this tab."));
    if (!s) {
      return body.child(quiet(t, agent.app === "claude-code"
        ? "No Claude transcript read for this agent yet."
        : "Transcripts come from Claude Code; this agent isn't Claude Code."));
    }
    return body
      .when(s.partial, (el) => el.child(quiet(t, `The last ${s.messages.length} messages; newest at the bottom.`)))
      .children(s.messages.map((m) => bubble(t, m)));
  }
}
