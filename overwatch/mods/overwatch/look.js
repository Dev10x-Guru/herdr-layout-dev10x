import { div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, home, panes, spaces } from "herdr";

export const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };

export const WORD = { blocked: "Needs you", done: "Done", working: "Working", idle: "Idle" };

const SPINNER = "mods/workspace-chrome/spinner.svg";

export function strongest(statuses) {
  return statuses.reduce((best, s) => ((RANK[s] ?? 0) > (RANK[best] ?? 0) ? s : best), null);
}

export function mark(t, status) {
  if (status === "working") return svg(SPINNER).size(12).flex_none().text_color(t.working).spin(900);
  if (status === "blocked") {
    return div().w(12).flex_none().text_size(11).text_color(t.blocked).child("◆")
      .loop("opacity", { from: 0.45, to: 1, period: 1200 });
  }
  if (status === "done") return div().size(7).mx(2.5).flex_none().rounded(4).bg(t.done);
  if (status === "idle") return div().size(7).mx(2.5).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
  return div().w(12).flex_none();
}

export function chip(t, status) {
  if (!status) return null;
  const color = t[status] ?? t.dim;
  return div().flex_none().px(6).h(18).flex().items_center().rounded(5)
    .bg(color + "26").text_size(10.5).font_semibold().text_color(color).child(WORD[status]);
}

export function programIcon(program, size, color) {
  if (!program?.icon) return null;
  return program.tint
    ? svg(program.icon).size(size).flex_none().text_color(color)
    : image(program.icon).w(size).h(size).flex_none();
}

export function paneName(p) {
  return ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
}

export function shortPath(path) {
  if (!path) return "";
  const h = home();
  return path === h ? "~" : path.startsWith(h + "/") ? "~" + path.slice(h.length) : path;
}

export function since(ms) {
  if (!ms) return "";
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export function activeSpace() {
  return spaces().find((s) => s.active) ?? null;
}

export function activeTab() {
  return activeSpace()?.tabs.find((t) => t.active) ?? null;
}

// The agent the right column talks about: the focused pane's agent when it's in the
// shown tab, else the shown tab's most urgent agent.
export function currentAgent() {
  const tab = activeTab();
  if (!tab) return null;
  const mine = agents().filter((a) => a.tab === tab.id);
  const focusedPane = panes().find((p) => p.focused && p.tab === tab.id);
  return mine.find((a) => a.pane === focusedPane?.pane)
    ?? [...mine].sort((x, y) => RANK[y.status] - RANK[x.status] || y.seq - x.seq)[0]
    ?? null;
}

export function heading(t, text) {
  return div().flex_none().text_size(11).font_semibold().text_color(t.dim).child(text.toUpperCase());
}

// A block for what Herdr can't tell yet: it names what will show there and what it waits on.
export function pending(t, title, body) {
  return v_flex().flex_none().gap(6).p(10).rounded(6).border(1).border_color(t.border).bg(t.surface)
    .child(h_flex().gap(8).items_center()
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).font_medium().text_color(t.foreground).child(title))
      .child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.hover)
        .text_size(10.5).font_semibold().text_color(t.dim).child("Pending")))
    .child(div().text_size(12).text_color(t.muted).child(body));
}

export function quiet(t, text) {
  return div().text_size(12).text_color(t.muted).child(text);
}
