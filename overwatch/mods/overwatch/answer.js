import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, run, theme } from "herdr";
import { activeTab, currentAgent, heading, mark, pending, quiet } from "./look.js";

function button(t, id, label, onClick) {
  return div().id(id).flex_none().px(10).h(26).flex().items_center().rounded(6)
    .bg(t.solid).text_color(t.solid_foreground).text_size(12).font_medium()
    .hover((s) => s.opacity(0.9))
    .on_click(onClick)
    .child(label);
}

export class Answer {
  render() {
    const t = theme();
    const tab = activeTab();
    const agent = currentAgent();
    const elsewhere = agents().filter((a) => a.status === "blocked" && a.tab !== tab?.id);
    const asking = agent?.status === "blocked";
    const body = v_flex().size_full().min_h(0).p(14).gap(10).overflow_y_scrollbar()
      .child(h_flex().flex_none().items_center().justify_between()
        .child(heading(t, "Question"))
        .child(div().text_size(11.5).text_color(elsewhere.length ? t.blocked : t.dim)
          .child(elsewhere.length ? `${elsewhere.length} waiting elsewhere` : "")));

    if (asking) {
      return body
        .child(h_flex().flex_none().gap(8).items_center()
          .child(mark(t, "blocked"))
          .child(div().flex_1().min_w(0).truncate().text_size(14).font_semibold().text_color(t.blocked)
            .child(`${agent.program.name} needs you`)))
        .child(quiet(t, agent.title || agent.tab_name))
        .child(pending(t, "Question and options",
          "The question, its options and the answer buttons show here once this layout reads the Claude session behind the agent. Answer in its terminal for now."))
        .child(h_flex().flex_none().gap(8)
          .child(button(t, "ow-answer-focus", "Go to its terminal",
            () => run("pane.focus", { terminal: agent.address })))
          .when(elsewhere.length > 0, (el) => el.child(button(t, "ow-answer-next", "Next waiting",
            () => run("agent.focus", { terminal: elsewhere[0].address })))));
    }

    return body
      .child(quiet(t, agent ? "Nothing in this tab is waiting for you." : "No agent runs in this tab."))
      .when(elsewhere.length > 0, (el) => el.child(v_flex().flex_none().gap(4).children(
        elsewhere.slice(0, 6).map((a) => h_flex().id(`ow-wait-${a.address}`).h(26).px(8).gap(8).items_center()
          .rounded(6).text_size(12.5).hover((s) => s.bg(t.hover))
          .on_click(() => run("agent.focus", { terminal: a.address }))
          .child(mark(t, a.status))
          .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(`${a.space_name} / ${a.tab_name}`))
          .child(div().flex_none().text_size(11).text_color(t.dim).child(a.program.name))))));
  }
}
