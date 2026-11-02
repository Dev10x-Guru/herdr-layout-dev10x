import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, exec, openOverlay, panes, run, setAgentOrder, spaces, theme } from "herdr";
import { mark, paneName, programIcon } from "./look.js";

const ROW = 28;
const INDENT = 16;

function place(space, ps) {
  const tabs = new Set(space.tabs.map((t) => t.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || space.folder;
}

const whereKey = (space, ps) => JSON.stringify([space.machine ?? null, place(space, ps)]);

// The repo a folder belongs to, and whether the folder is a linked worktree of it.
async function repoOf(key) {
  const [on, cwd] = JSON.parse(key);
  const r = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir", "--show-toplevel"], { cwd, on });
  if (r.code !== 0) return null;
  const [common, top] = r.stdout.trim().split("\n");
  return { repo: JSON.stringify([on, common]), linked: common !== `${top}/.git` };
}

function loadSet(name) {
  try { return new Set(JSON.parse(localStorage.getItem(name) ?? "[]")); } catch { return new Set(); }
}

export class Tree {
  init(cx) {
    this.git = {};
    this.looking = false;
    this.folded = loadSet("folded");
    this.needsOnly = localStorage.getItem("needsOnly") === "1";
    cx.timer.every(2000, (cx) => this.look(cx));
    this.look(cx);
  }

  look(cx) {
    if (this.looking) return;
    const ps = panes();
    const todo = [...new Set(spaces().map((s) => whereKey(s, ps)))]
      .filter((k) => !(k in this.git) && JSON.parse(k)[1]);
    if (!todo.length) return;
    this.looking = true;
    cx.spawn(async (cx) => {
      for (const k of todo) {
        try { this.git[k] = await repoOf(k); } catch { delete this.git[k]; }
      }
      this.looking = false;
      cx.notify();
    });
  }

  fold(id, cx) {
    this.folded.has(id) ? this.folded.delete(id) : this.folded.add(id);
    localStorage.setItem("folded", JSON.stringify([...this.folded]));
    cx.notify();
  }

  // Spaces in Herdr's order, each worktree space moved under its repo's main checkout.
  ordered() {
    const ps = panes();
    const rows = spaces().map((s) => ({ s, g: this.git[whereKey(s, ps)] ?? null }));
    const mains = new Set(rows.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
    const nested = (r) => r.g?.linked && mains.has(r.g.repo);
    const placed = new Set();
    const out = [];
    for (const r of rows) {
      if (nested(r)) continue;
      out.push({ ...r, worktree: false });
      if (!r.g || r.g.linked || placed.has(r.g.repo)) continue;
      placed.add(r.g.repo);
      for (const k of rows.filter((k) => nested(k) && k.g.repo === r.g.repo)) out.push({ ...k, worktree: true });
    }
    return out;
  }

  caret(t, id, open) {
    return div().id(`fold-${id}`).w(14).flex_none().text_size(10).text_color(t.dim)
      .hover((s) => s.text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); this.fold(id, cx); })
      .child(open ? "▾" : "▸");
  }

  row(t, id, depth, selected) {
    return h_flex().id(id).h(ROW).flex_none().pl(8 + depth * INDENT).pr(8).gap(7).items_center()
      .rounded(6).text_size(13)
      .when(selected, (el) => el.bg(t.selected))
      .when(!selected, (el) => el.hover((s) => s.bg(t.hover)));
  }

  spaceRow(t, { s, worktree }) {
    const open = !this.folded.has(s.id);
    return this.row(t, `space-${s.id}`, worktree ? 1 : 0, false)
      .on_click(() => run("space.select", { id: s.id }))
      .on_mouse_down("right", () => openOverlay({
        mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: s.id } },
      }))
      .child(this.caret(t, s.id, open))
      .when(worktree, (el) => el.child(svg("mods/workspace-chrome/branch.svg").size(12).flex_none().text_color(t.dim)))
      .child(mark(t, s.status))
      .child(div().flex_shrink(0).max_w(150).truncate().font_medium()
        .text_color(s.active ? t.foreground : t.muted).child(s.name))
      .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim)
        .child(s.branch && s.branch !== s.name ? s.branch : ""))
      .child(div().flex_none().text_size(11).text_color(t.dim).child(String(s.tabs.length)));
  }

  tabRow(t, space, tab, depth) {
    const open = !this.folded.has(tab.id);
    return this.row(t, `tab-${tab.id}`, depth, space.active && tab.active)
      .on_click(() => {
        run("space.select", { id: space.id });
        run("tab.select", { id: tab.id });
      })
      .child(this.caret(t, tab.id, open))
      .child(mark(t, tab.status))
      .child(div().flex_1().min_w(0).truncate()
        .text_color(tab.active ? t.foreground : t.muted).child(tab.name))
      .child(div().flex_none().text_size(11).text_color(t.dim).child(String(tab.panes)));
  }

  paneRow(t, space, p, depth) {
    return this.row(t, `pane-${p.pane}`, depth, false)
      .on_click(() => {
        run("space.select", { id: space.id });
        run("tab.select", { id: p.tab });
        run("pane.focus", { pane: p.pane });
      })
      .child(div().w(14).flex_none())
      .child(mark(t, p.status))
      .child(programIcon(p.program, 13, t.dim) ?? div().w(13).flex_none())
      .child(div().flex_1().min_w(0).truncate().text_size(12.5)
        .text_color(p.focused ? t.foreground : t.muted).child(paneName(p)));
  }

  rows(t) {
    const ps = panes();
    const wanted = (status) => !this.needsOnly || status === "blocked";
    const out = [];
    for (const r of this.ordered()) {
      if (!wanted(r.s.status)) continue;
      out.push(this.spaceRow(t, r));
      if (this.folded.has(r.s.id)) continue;
      const depth = r.worktree ? 2 : 1;
      for (const tab of r.s.tabs) {
        if (!wanted(tab.status)) continue;
        out.push(this.tabRow(t, r.s, tab, depth));
        if (this.folded.has(tab.id)) continue;
        for (const p of ps.filter((p) => p.tab === tab.id && p.terminal)) {
          if (!wanted(p.status)) continue;
          out.push(this.paneRow(t, r.s, p, depth + 1));
        }
      }
    }
    return out;
  }

  header(t, list) {
    const blocked = list.filter((a) => a.status === "blocked").length;
    const working = list.filter((a) => a.status === "working").length;
    return v_flex().flex_none().px(14).pt(12).pb(8).gap(6)
      .child(h_flex().items_center().justify_between()
        .child(div().text_size(11).font_semibold().text_color(t.dim).child("OVERWATCH"))
        .child(div().id("ow-space-new").px(6).rounded(4).text_color(t.dim)
          .hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => run("space.new"))
          .child("+")))
      .child(div().text_size(15).font_semibold()
        .text_color(blocked ? t.blocked : t.foreground)
        .child(blocked ? `${blocked} need${blocked === 1 ? "s" : ""} you` : "Nothing waits for you"))
      .child(h_flex().gap(10).items_center().text_size(11.5).text_color(t.muted)
        .child(`${working} working · ${list.length} agents · ${spaces().length} spaces`)
        .child(div().flex_1())
        .child(div().id("ow-needs-only").px(6).h(20).flex().items_center().rounded(5)
          .when(this.needsOnly, (el) => el.bg(t.blocked + "26").text_color(t.blocked))
          .when(!this.needsOnly, (el) => el.hover((s) => s.bg(t.hover)))
          .on_click((_e, cx) => {
            this.needsOnly = !this.needsOnly;
            localStorage.setItem("needsOnly", this.needsOnly ? "1" : "0");
            cx.notify();
          })
          .child(this.needsOnly ? "Show all" : "Needs you only")));
  }

  render() {
    const t = theme();
    const list = agents();
    const rows = this.rows(t);
    const ps = panes();
    setAgentOrder(this.ordered().flatMap((r) => r.s.tabs.flatMap((tab) =>
      ps.filter((p) => p.tab === tab.id && p.status && p.terminal).map((p) => p.terminal))));
    return v_flex().size_full().min_h(0).bg(t.chrome)
      .child(this.header(t, list))
      .child(v_flex().flex_1().min_h(0).px(6).pb(12).overflow_y_scrollbar()
        .children(rows.length ? rows : [div().px(10).py(8).text_size(12).text_color(t.muted)
          .child(this.needsOnly ? "No agent needs you." : "No spaces yet.")]));
  }
}
