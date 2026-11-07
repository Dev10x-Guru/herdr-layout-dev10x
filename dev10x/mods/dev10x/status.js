import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { keys, run, spaces, theme } from "herdr";
import { ticketOf } from "./session.js";

// The binding as it is, not a hardcoded one; without a binding the hint stays true.
function hint() {
  const binding = keys().find((k) => k.section === "global" && k.action === "app.palette");
  if (!binding) return "commands";
  const name = { ctrl: "Ctrl", shift: "Shift", alt: "Alt", cmd: "Cmd" };
  return `${binding.keys.split("-").map((p) => name[p.toLowerCase()] ?? p.toUpperCase()).join("+")}  commands`;
}

export class Status {
  render() {
    const t = theme();
    const space = spaces().find((s) => s.active);
    const ticket = ticketOf(space?.branch);
    return h_flex().size_full().px(12).gap(14).items_center().bg(t.chrome).border_t(1).border_color(t.border)
      .text_size(11.5).text_color(t.muted)
      .when(!!space?.machine, (el) => el.child(space.machine))
      .when(!!space?.branch, (el) => el.child(h_flex().min_w(0).gap(6).items_center()
        .child(svg("mods/workspace-chrome/branch.svg").size(13).flex_none())
        .child(div().min_w(0).truncate().child(space.branch))))
      .when(!!ticket, (el) => el.child(div().flex_none().text_color(t.foreground).child(ticket)))
      .child(div().flex_1())
      .child(div().id("dx-palette").flex_none().text_color(t.dim).hover((s) => s.text_color(t.foreground))
        .on_click(() => run("app.palette")).child(hint()));
  }
}
