import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, hc, run, settings, theme } from "herdr";
import { activeTab, button, card, currentAgent, heading, mark, quiet } from "./look.js";
import { SessionWatch } from "./session.js";

// Claude Code's question picker opens on the first option: arrow down to the chosen one, Enter.
const keysFor = (index) => [...Array(index).fill("down"), "enter"];

function option(t, id, label, description, onClick) {
  return v_flex().id(id).flex_none().px(10).py(6).gap(2).rounded(6).border(1).border_color(t.border)
    .hover((s) => s.bg(t.hover).border_color(t.accent))
    .on_click(onClick)
    .child(div().text_size(12.5).font_medium().text_color(t.foreground).child(label))
    .when(!!description, (el) => el.child(div().text_size(11.5).text_color(t.muted).child(description)));
}

export class Answer {
  init(cx) {
    this.watch = new SessionWatch();
    this.watch.start(cx, currentAgent);
    this.sent = null;
  }

  choose(agent, call, index, label) {
    return (_e, cx) => {
      this.sent = { address: agent.address, call, label };
      cx.notify();
      cx.spawn(async (cx) => {
        const r = await hc(["keys", agent.address, ...keysFor(index)]).catch((e) => ({ code: 1, stderr: String(e) }));
        if (r.code !== 0) this.sent = { ...this.sent, error: r.stderr.trim() || "hc keys failed" };
        cx.notify();
      });
    };
  }

  questionView(t, agent, call, questions) {
    const single = questions.length === 1 && !questions[0].multiSelect;
    if (single) {
      const q = questions[0];
      return v_flex().flex_none().gap(8)
        .child(div().text_size(13).text_color(t.foreground).child(q.question))
        .children((q.options ?? []).map((o, i) =>
          option(t, `ow-opt-${i}`, o.label, o.description, this.choose(agent, call, i, o.label))));
    }
    return v_flex().flex_none().gap(8).children(questions.map((q, i) => card(t, q.header || `Question ${i + 1}`,
      q.multiSelect ? "pick several" : null, [
        div().text_size(12.5).text_color(t.foreground).child(q.question),
        ...(q.options ?? []).map((o) => div().text_size(12).text_color(t.muted).child(`• ${o.label}`)),
      ])))
      .child(quiet(t, "Several questions or several picks: answer in its terminal."));
  }

  permissionView(t, waiting) {
    return card(t, `${waiting.name} wants to run`, null, [
      div().text_size(12).font_family(settings().font_family ?? "JetBrains Mono").text_color(t.foreground)
        .child(waiting.target || "—"),
    ]);
  }

  render(cx) {
    const t = theme();
    const tab = activeTab();
    const agent = currentAgent();
    this.watch.follow(cx);
    const s = this.watch.of(agent);
    const elsewhere = agents().filter((a) => a.status === "blocked" && a.tab !== tab?.id);
    const asking = agent?.status === "blocked";
    if (this.sent && (!asking || this.sent.address !== agent?.address || (s && s.waiting?.id !== this.sent.call))) {
      this.sent = null;
    }
    const body = v_flex().size_full().min_h(0).p(14).gap(10).overflow_y_scrollbar()
      .child(h_flex().flex_none().items_center().justify_between()
        .child(heading(t, "Question"))
        .child(div().text_size(11.5).text_color(elsewhere.length ? t.blocked : t.dim)
          .child(elsewhere.length ? `${elsewhere.length} waiting elsewhere` : "")));

    if (asking) {
      const waiting = s?.waiting;
      const sent = this.sent;
      const done = !!sent && !sent.error;
      return body
        .child(h_flex().flex_none().gap(8).items_center()
          .child(mark(t, "blocked"))
          .child(div().flex_1().min_w(0).truncate().text_size(14).font_semibold().text_color(t.blocked)
            .child(`${agent.program.name} needs you`)))
        .child(quiet(t, agent.title || agent.tab_name))
        .when(!!sent, (el) => el.child(div().text_size(12).text_color(sent.error ? t.blocked : t.muted)
          .child(sent.error ? `Couldn't answer: ${sent.error}` : `Sent: ${sent.label}`)))
        .when(!done && !!s?.question, (el) => el.child(this.questionView(t, agent, waiting.id, s.question)))
        .when(!!waiting && !s?.question, (el) => el.child(this.permissionView(t, waiting)))
        .when(!s, (el) => el.child(quiet(t, "Its Claude session isn't readable here: answer in its terminal.")))
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
