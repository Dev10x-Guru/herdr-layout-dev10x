import { div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { layout, openOverlay, panes, run, spaces, theme } from "herdr";
import { currentStatus, findNode, mark, tabStatus, waitingHere } from "./look.js";

const stop = (_e, cx) => cx.stop_propagation();

// The shipped tab bar also owns a Files and Changes column; here they live in the right column.
export class Tabs {
  init() {
    this.pressed = null;
  }

  item(t, space, tab, index) {
    const mine = panes().filter((p) => p.tab === tab.id);
    const program = mine.find((p) => p.program?.agent)?.program ?? mine[0]?.program;
    return h_flex().id(`dx-tab-${tab.id}`).h(26).px(9).gap(7).rounded(3).items_center().flex_none().text_size(12.5)
      .bg(tab.active ? t.raised : t.chrome).text_color(tab.active ? t.foreground : t.muted)
      .hover((s) => s.bg(t.hover))
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        this.pressed = index;
        if (e.click_count === 2) run("tab.rename", { id: tab.id });
      })
      .on_mouse_up("left", () => {
        const from = this.pressed;
        this.pressed = null;
        if (from !== null && from !== index) run("tab.move", { id: space.tabs[from].id, index: index + 1 });
        else run("tab.select", { id: tab.id });
      })
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: tab.id, space: space.id } } });
      })
      .when(!!program?.icon, (el) => el.child(program.tint
        ? svg(program.icon).size(14).flex_none().text_color(t.muted)
        : image(program.icon).size(14).flex_none()))
      .child(div().max_w(170).truncate().child(tab.zoomed ? `${tab.name} Z` : tab.name))
      .when(!!tabStatus(tab) && tabStatus(tab) !== "idle", (el) => el.child(mark(t, tabStatus(tab))))
      .when(tab.active, (el) => el.child(div().id(`dx-tab-close-${tab.id}`).text_color(t.dim)
        .hover((s) => s.text_color(t.foreground))
        .on_mouse_down("left", stop)
        .on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: tab.id }); })
        .child(svg("mods/pane/close.svg").size(12))));
  }

  // This bar stays when both side panels are put away, so it holds their switches. A hidden
  // panel's switch carries the mark when that panel would be showing something waiting.
  panelToggle(t, node, icon, waiting) {
    const hidden = findNode(layout(), node)?.hidden ?? false;
    return h_flex().id(`dx-toggle-${node}`).h(24).px(5).gap(4).flex_none().items_center().rounded(3)
      .text_color(hidden ? t.dim : t.foreground).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop)
      .on_click(() => run("layout.toggle", { id: node }))
      .child(svg(`mods/dev10x/${icon}.svg`).size(15))
      .when(hidden && waiting, (el) => el.child(mark(t, "blocked")));
  }

  render() {
    const t = theme();
    const space = spaces().find((s) => s.active);
    const shown = space?.tabs ?? [];
    return h_flex().size_full().min_w(0).px(8).gap(3).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .on_mouse_up("left", () => { this.pressed = null; })
      .child(this.panelToggle(t, "sidebar", "panel-left", waitingHere().length > 0))
      .child(h_flex().id("dx-tab-scroll").flex_1().min_w(0).h_full().items_center().gap(3).overflow_x_scrollbar()
        .children(shown.map((tab, index) => this.item(t, space, tab, index))))
      .child(div().id("dx-tab-new").size(24).flex_none().flex().items_center().justify_center().rounded(3)
        .text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_mouse_down("left", stop)
        .on_click(() => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 }))
        .child("+"))
      .child(this.panelToggle(t, "dx-side", "panel-right", currentStatus() === "blocked"));
  }
}
