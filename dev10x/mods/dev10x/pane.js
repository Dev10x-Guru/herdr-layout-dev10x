import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme } from "herdr";
import { chip, mark, paneName, paneStatus, programIcon, shortPath } from "./look.js";

const BUTTONS = [
  ["split-right", "pane.split", { direction: "right" }],
  ["split-down", "pane.split", { direction: "down" }],
  ["zoom", "pane.zoom", {}],
  ["close", "pane.close", {}],
];

export class PaneHeader {
  init() {
    this.hovered = false;
  }

  button(t, pane, [icon, command, args], zoomed) {
    const glyph = icon === "zoom" && zoomed ? "unzoom" : icon;
    return div().id(`dx-ph-${icon}-${pane}`).p(3).rounded(4).text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, { ...args, pane });
      })
      .child(svg(`mods/pane/${glyph}.svg`).size(14));
  }

  render() {
    const t = theme();
    const p = panes().find((each) => each.pane === props()?.pane);
    if (!p) return div();
    const status = paneStatus(p);
    return h_flex().id(`dx-pane-head-${p.pane}`).size_full().px(10).gap(8).items_center()
      .bg(t.background).border_b(1).border_color(t.border).text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane: p.pane }))
      .child(mark(t, status))
      .child(programIcon(p.program, 14, t.dim) ?? div().w(14).flex_none())
      .child(div().flex_none().max_w(240).truncate().font_medium().text_color(t.foreground).child(paneName(p)))
      .child(div().flex_1().min_w(0).truncate().text_color(t.dim)
        .child([shortPath(p.cwd), p.branch].filter(Boolean).join(" · ")))
      .when(status === "blocked" && !this.hovered, (el) => el.child(chip(t, status)))
      .when(this.hovered, (el) => el.children(BUTTONS.map((b) => this.button(t, p.pane, b, p.zoomed))));
  }
}
