import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, theme } from "herdr";
import { activeSpace, activeTab, chip, mark, since } from "./look.js";

export class Rail {
  init(cx) {
    cx.timer.every(30000, (cx) => cx.notify());
  }

  render() {
    const t = theme();
    const space = activeSpace();
    const tab = activeTab();
    if (!space || !tab) {
      return h_flex().size_full().px(14).items_center().text_size(12.5).text_color(t.muted).child("No tab is shown.");
    }
    const mine = agents().filter((a) => a.tab === tab.id);
    const working = tab.working_since ? `working ${since(tab.working_since)}` : "";
    return h_flex().size_full().px(14).gap(8).items_center().text_size(13)
      .child(mark(t, tab.status))
      .child(div().flex_none().max_w(220).truncate().text_color(t.muted).child(space.name))
      .child(div().flex_none().text_color(t.dim).child("/"))
      .child(div().flex_shrink(1).min_w(0).truncate().font_semibold().text_color(t.foreground).child(tab.name))
      .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(space.branch ?? ""))
      .child(div().flex_none().text_size(11.5).text_color(t.dim)
        .child([working, `${tab.panes} panes`, `${mine.length} agents`].filter(Boolean).join(" · ")))
      .child(chip(t, tab.status) ?? div());
  }
}
