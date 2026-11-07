import { h_flex } from "gpui-base";
import { layout, props, run, theme } from "herdr";
import { currentStatus, currentTarget, findNode, mark } from "./look.js";

const SIDE = { "dx-work": "Work", "dx-question": "Question", files: "Files", changes: "Changes" };
const ORDER_KEY = "order";

// A panel this version doesn't know is dropped, and a new one joins at the end.
function loadOrder() {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]");
  } catch {
    saved = [];
  }
  const known = Array.isArray(saved) ? saved.filter((child) => child in SIDE) : [];
  return [...new Set([...known, ...Object.keys(SIDE)])];
}

function movedBefore(order, dragged, target) {
  const rest = order.filter((child) => child !== dragged);
  const from = order.indexOf(dragged);
  const to = order.indexOf(target);
  const at = rest.indexOf(target) + (from < to ? 1 : 0);
  return [...rest.slice(0, at), dragged, ...rest.slice(at)];
}

export class Switch {
  init() {
    this.order = loadOrder();
    this.pressed = null;
    this.over = null;
  }

  // A question comes forward once, when it starts waiting; after that the person decides.
  showQuestion(stack, asking) {
    const key = asking ? currentTarget()?.address : null;
    if (key === this.asked) return;
    this.asked = key;
    if (key) run("layout.select", { stack, child: "dx-question" });
  }

  release(stack, child) {
    const dragged = this.pressed;
    this.pressed = null;
    if (!dragged || dragged === child) {
      run("layout.select", { stack, child });
      return;
    }
    this.order = movedBefore(this.order, dragged, child);
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(this.order));
    } catch (e) {
      console.log(`dev10x switch: ${e}`);
    }
  }

  pill(t, stack, child, on) {
    const target = !!this.pressed && this.pressed !== child && this.over === child;
    return h_flex().id(`dx-switch-${child}`).px(10).h(24).gap(6).items_center().rounded(3).border(1)
      .text_size(12).font_medium()
      .text_color(on ? t.foreground : t.muted)
      .border_color(target ? t.accent : on ? t.raised : t.chrome)
      .when(on, (el) => el.bg(t.raised))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .on_hover((hovered, cx) => {
        if (hovered) this.over = child;
        else if (this.over === child) this.over = null;
        cx.notify();
      })
      .on_mouse_down("left", (_e, cx) => { this.pressed = child; cx.notify(); })
      .on_mouse_up("left", (_e, cx) => {
        cx.stop_propagation();
        this.release(stack, child);
        cx.notify();
      })
      .child(SIDE[child]);
  }

  render() {
    const t = theme();
    const stack = props()?.stack ?? "dx-side-stack";
    const active = findNode(layout(), stack)?.active ?? this.order[0];
    const asking = currentStatus() === "blocked";
    this.showQuestion(stack, asking);
    return h_flex().id("dx-switch").size_full().bg(t.chrome).px(10).gap(4).items_center().border_b(1).border_color(t.border)
      .on_mouse_up("left", (_e, cx) => { this.pressed = null; cx.notify(); })
      .children(this.order.map((child) => this.pill(t, stack, child, child === active)
        .when(child === "dx-question" && asking, (el) => el.child(mark(t, "blocked")))));
  }
}
