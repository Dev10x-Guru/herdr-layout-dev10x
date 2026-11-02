import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { layout, props, run, theme } from "herdr";

const CHOICES = [
  ["ow-detail", "Details"],
  ["ow-transcript", "Transcript"],
];

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export class Switch {
  render() {
    const t = theme();
    const stack = props()?.stack ?? "ow-side-stack";
    const active = find(layout(), stack)?.active ?? CHOICES[0][0];
    return h_flex().size_full().px(10).gap(4).items_center().border_b(1).border_color(t.border)
      .children(CHOICES.map(([child, label]) => {
        const on = child === active;
        return div().id(`ow-switch-${child}`).px(10).h(24).flex().items_center().rounded(6)
          .text_size(12).font_medium()
          .text_color(on ? t.foreground : t.muted)
          .when(on, (el) => el.bg(t.selected))
          .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
          .on_click(() => run("layout.select", { stack, child }))
          .child(label);
      }));
  }
}
