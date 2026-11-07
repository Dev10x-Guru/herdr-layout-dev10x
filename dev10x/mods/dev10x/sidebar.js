import { div, svg } from "gpui-kit";
import { h_flex, v_flex, Input, InputState } from "gpui-base";
import { agents, exec, openOverlay, panes, run, setAgentOrder, spaces, theme } from "herdr";
import { fleet, refreshFleet, sessionAt } from "./fleet.js";
import { mark, strongest, tabStatus } from "./look.js";
import { prOf, ticketOf } from "./session.js";

const ROW = 28;
const INDENT = 16;
const FLEET_MS = 5000;
const PR_TTL_MS = 300000;
const NO_PR = new Set(["main", "master", "develop", "trunk"]);
const STOPPED = new Set(["idle", "done"]);

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

const repoName = (repo) => JSON.parse(repo)[1].replace(/\/\.git\/?$/, "").replace(/\.git$/, "").split("/").pop();

function loadList(name) {
  try {
    const value = JSON.parse(localStorage.getItem(name) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const toggled = (list, item) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

function moveBy(order, item, step) {
  const from = order.indexOf(item);
  if (from < 0) return order;
  const to = Math.min(order.length - 1, Math.max(0, from + step));
  const rest = order.filter((x) => x !== item);
  return [...rest.slice(0, to), item, ...rest.slice(to)];
}

const blockedFirst = (a, b) => Number(b.status === "blocked") - Number(a.status === "blocked");

const clock = (ms) => new Date(ms).toTimeString().slice(0, 5);

export class Sidebar {
  init(cx) {
    this.git = {};
    this.looking = false;
    this.prs = {};
    this.fetching = false;
    this.reading = false;
    this.hovered = null;
    this.shown = [];
    this.query = "";
    this.needsOnly = false;
    this.folded = new Set(loadList("folded"));
    this.pins = loadList("pins");
    this.projectPins = loadList("projectPins");
    this.order = loadList("order");
    this.hide = localStorage.getItem("hide") === "1";
    this.input = InputState.new({ placeholder: "Filter by name, branch, ticket" });
    this.input.on("change", (_e, cx) => { this.query = this.input.value(); cx.notify(); });
    cx.timer.every(2000, (cx) => this.look(cx));
    cx.timer.every(FLEET_MS, (cx) => this.readFleet(cx));
    cx.timer.every(30000, (cx) => this.fetchPrs(cx));
    cx.timer.after(3000, (cx) => this.fetchPrs(cx));
    this.look(cx);
    this.readFleet(cx);
  }

  save(name, list) {
    this[name] = list;
    localStorage.setItem(name, JSON.stringify(list));
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

  readFleet(cx) {
    if (this.reading) return;
    this.reading = true;
    cx.spawn(async () => {
      try {
        await refreshFleet();
      } catch (e) {
        console.log(`dev10x fleet: ${e}`);
      } finally {
        this.reading = false;
      }
    });
  }

  // PR numbers for the rows: local spaces only, at most one `gh` call per branch every 5 min.
  fetchPrs(cx) {
    if (this.fetching) return;
    const wanted = this.projects().flatMap((p) => p.sessions)
      .filter((s) => !s.space.machine && s.cwd && s.branch && !NO_PR.has(s.branch));
    if (!wanted.length) return;
    this.fetching = true;
    cx.spawn(async (cx) => {
      for (const s of wanted) {
        this.prs[`${s.cwd}\n${s.branch}`] = await prOf(s.cwd, s.branch, PR_TTL_MS).catch(() => null);
      }
      this.fetching = false;
      cx.notify();
    });
  }

  // A session is a tab with an agent or a running Claude session. A space with neither is one
  // quiet row, so a worktree nobody works in right now stays reachable.
  sessionsOf(space, ps, list) {
    const paneOf = (tab) => {
      const terminals = ps.filter((p) => p.tab === tab.id && p.terminal);
      const agent = list.find((a) => a.tab === tab.id);
      return terminals.find((p) => sessionAt(p.terminal)) ?? terminals.find((p) => p.pane === agent?.pane)
        ?? terminals.find((p) => p.focused) ?? terminals[0];
    };
    const row = (tab, label, status, session) => {
      const pane = paneOf(tab);
      const branch = pane?.branch ?? space.branch;
      const cwd = pane?.cwd ?? null;
      return {
        key: tab.id, space, tab, agents: list.filter((a) => a.tab === tab.id), status, branch, cwd, label, session,
        ticket: ticketOf(branch) ?? ticketOf(session?.name), pr: this.prs[`${cwd}\n${branch}`] ?? null,
      };
    };
    const busy = space.tabs.filter((tab) => {
      const session = sessionAt(paneOf(tab)?.terminal);
      return session || list.some((a) => a.tab === tab.id);
    });
    if (!busy.length) {
      const tab = space.tabs.find((t) => t.active) ?? space.tabs[0];
      return tab ? [row(tab, space.name, null, null)] : [];
    }
    return busy.map((tab) => {
      const session = sessionAt(paneOf(tab)?.terminal);
      const label = tab.named ? tab.name : session?.name ?? (busy.length > 1 ? `${space.name} ${tab.index}` : space.name);
      return row(tab, label, tabStatus(tab), session);
    });
  }

  // Projects are repos: a repo's main checkout and its linked worktrees fold into one.
  projects() {
    const ps = panes();
    const list = agents();
    const byKey = new Map();
    for (const space of spaces()) {
      const g = this.git[whereKey(space, ps)] ?? null;
      const key = g ? g.repo : `space:${space.id}`;
      const p = byKey.get(key) ?? { key, main: null, spaces: [], sessions: [], natural: byKey.size };
      if (!p.main && (!g || !g.linked)) p.main = space;
      p.spaces.push(space);
      p.sessions.push(...this.sessionsOf(space, ps, list));
      byKey.set(key, p);
    }
    return [...byKey.values()].map((p) => {
      const name = p.main?.name ?? (p.key.startsWith("space:") ? p.spaces[0].name : repoName(p.key));
      for (const s of p.sessions) s.project = name;
      return { ...p, name, home: p.main ?? p.spaces[0], status: strongest(p.sessions.map((s) => s.status)) };
    });
  }

  arranged(projects) {
    const rank = (p) => {
      const at = this.order.indexOf(p.key);
      return at < 0 ? this.order.length : at;
    };
    return [...projects].sort((a, b) =>
      Number(!this.projectPins.includes(a.key)) - Number(!this.projectPins.includes(b.key))
      || rank(a) - rank(b)
      || blockedFirst(a, b)
      || a.natural - b.natural);
  }

  matches(words) {
    const needle = this.query.trim().toLowerCase();
    return !needle || words.filter(Boolean).join(" ").toLowerCase().includes(needle);
  }

  visible(s) {
    if (this.needsOnly && s.status !== "blocked") return false;
    if (this.hide && (!s.status || STOPPED.has(s.status))) return false;
    return this.matches([s.label, s.tab.name, s.space.name, s.branch, s.ticket, s.project]);
  }

  open(s) {
    run("space.select", { id: s.space.id });
    run("tab.select", { id: s.tab.id });
  }

  hover(id) {
    return (hovered, cx) => {
      if (hovered) this.hovered = id;
      else if (this.hovered === id) this.hovered = null;
      cx.notify();
    };
  }

  row(t, id, depth, selected) {
    return h_flex().id(id).h(ROW).flex_none().pl(6 + depth * INDENT).pr(6).gap(7).items_center()
      .text_size(13).border_l(2)
      .on_hover(this.hover(id))
      .when(selected, (el) => el.bg(t.selected).border_color(t.foreground))
      .when(!selected, (el) => el.border_color(t.chrome).hover((s) => s.bg(t.hover)));
  }

  control(t, id, label, onClick) {
    return div().id(id).flex_none().px(4).h(20).flex().items_center().rounded(3)
      .text_size(11.5).text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); })
      .child(label);
  }

  caret(t, id, open) {
    return div().id(`dx-fold-${id}`).w(14).flex_none().text_size(10).text_color(t.dim)
      .hover((s) => s.text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        this.folded.has(id) ? this.folded.delete(id) : this.folded.add(id);
        localStorage.setItem("folded", JSON.stringify([...this.folded]));
        cx.notify();
      })
      .child(open ? "▾" : "▸");
  }

  refs(t, s) {
    return [
      s.agents.length > 1 ? `${s.agents.length} agents` : null,
      s.label.includes(s.ticket ?? "\0") ? null : s.ticket,
      s.pr ? `#${s.pr.number}` : null,
    ].filter(Boolean).map((text) => div().flex_none().text_size(11).text_color(t.muted).child(text));
  }

  sessionPin(t, s) {
    const pinned = this.pins.includes(s.key);
    return this.control(t, `dx-pin-${s.key}`, pinned ? "★" : "☆", (cx) => {
      this.save("pins", toggled(this.pins, s.key));
      cx.notify();
    });
  }

  projectControls(t, p, withPin) {
    const pinned = this.projectPins.includes(p.key);
    const id = p.home.id;
    const move = (step) => (cx) => {
      this.save("order", moveBy(this.shown, p.key, step));
      cx.notify();
    };
    return [
      withPin ? this.control(t, `dx-ppin-${id}`, pinned ? "★" : "☆", (cx) => {
        this.save("projectPins", toggled(this.projectPins, p.key));
        cx.notify();
      }) : null,
      this.control(t, `dx-up-${id}`, "↑", move(-1)),
      this.control(t, `dx-down-${id}`, "↓", move(1)),
      this.control(t, `dx-new-${id}`, "+", () => {
        run("space.select", { id });
        openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 });
      }),
    ].filter(Boolean);
  }

  sessionRow(t, s, depth, withProject) {
    const id = `dx-s-${s.key}`;
    const selected = s.space.active && s.tab.active;
    return this.row(t, id, depth, selected)
      .on_click(() => this.open(s))
      .child(mark(t, s.status))
      .child(div().flex_1().min_w(0).truncate()
        .text_color(selected ? t.foreground : t.muted)
        .when(selected, (el) => el.font_semibold())
        .child(s.label))
      .when(withProject && s.project !== s.label,
        (el) => el.child(div().flex_none().text_size(10.5).text_color(t.dim).child(s.project)))
      .children(this.refs(t, s))
      .when(this.hovered === id, (el) => el.child(this.sessionPin(t, s)));
  }

  // A project with one shown session is one row: the project, and that session's details.
  singleRow(t, p, s) {
    const id = `dx-p-${p.home.id}`;
    const selected = s.space.active && s.tab.active;
    return this.row(t, id, 0, selected)
      .on_click(() => this.open(s))
      .child(div().w(14).flex_none())
      .child(mark(t, s.status))
      .child(div().flex_shrink(0).max_w(150).truncate()
        .when(selected || !!s.status, (el) => el.font_semibold())
        .text_color(selected || p.home.active ? t.foreground : t.muted).child(p.name))
      .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim)
        .child(s.label !== p.name ? s.label : ""))
      .children(this.refs(t, s))
      .when(this.hovered === id, (el) => el
        .child(this.sessionPin(t, s))
        .children(this.projectControls(t, p, false)));
  }

  projectRow(t, p, count) {
    const id = `dx-p-${p.home.id}`;
    const open = !this.folded.has(p.key);
    return this.row(t, id, 0, false)
      .on_click((_e, cx) => {
        this.folded.has(p.key) ? this.folded.delete(p.key) : this.folded.add(p.key);
        localStorage.setItem("folded", JSON.stringify([...this.folded]));
        cx.notify();
      })
      .child(this.caret(t, p.key, open))
      .child(mark(t, p.status))
      .child(div().flex_1().min_w(0).truncate().font_semibold()
        .text_color(p.spaces.some((s) => s.active) ? t.foreground : t.muted).child(p.name))
      .when(this.projectPins.includes(p.key) && this.hovered !== id,
        (el) => el.child(div().flex_none().text_size(11).text_color(t.blocked).child("★")))
      .child(div().flex_none().text_size(11).text_color(t.dim).child(String(count)))
      .when(this.hovered === id, (el) => el.children(this.projectControls(t, p, true)));
  }

  elsewhereRow(t, s) {
    return h_flex().id(`dx-out-${s.sessionId}`).h(ROW).flex_none().pl(28).pr(6).gap(7).items_center().text_size(13)
      .child(mark(t, "blocked"))
      .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(s.name))
      .child(div().flex_none().text_size(10.5).text_color(t.dim).child(s.waitingFor ?? "waiting"));
  }

  groupHead(t, text) {
    return div().flex_none().px(8).pt(10).pb(3).text_size(10.5).font_semibold().text_color(t.dim).child(text);
  }

  // Rows in sidebar order, the projects' keys as shown (for moving), and the agents in that order.
  build(t, projects) {
    const rows = [];
    const order = [];
    this.shown = [];
    const pinned = projects.flatMap((p) => p.sessions).filter((s) => this.pins.includes(s.key) && this.visible(s));
    if (pinned.length) {
      rows.push(this.groupHead(t, "PINNED"));
      for (const s of pinned) {
        rows.push(this.sessionRow(t, s, 0, true));
        order.push(...s.agents);
      }
      rows.push(this.groupHead(t, "PROJECTS"));
    }
    for (const p of projects) {
      const sessions = p.sessions.filter((s) => !this.pins.includes(s.key) && this.visible(s)).sort(blockedFirst);
      if (!sessions.length) continue;
      this.shown.push(p.key);
      order.push(...sessions.flatMap((s) => s.agents));
      if (sessions.length === 1) {
        rows.push(this.singleRow(t, p, sessions[0]));
        continue;
      }
      rows.push(this.projectRow(t, p, sessions.length));
      if (!this.folded.has(p.key)) rows.push(...sessions.map((s) => this.sessionRow(t, s, 1, false)));
    }
    const out = fleet().elsewhere
      .filter((s) => s.status === "waiting" && this.matches([s.name, s.cwd, ticketOf(s.name)]));
    if (out.length) {
      rows.push(this.groupHead(t, "OUTSIDE THIS WINDOW"));
      rows.push(...out.map((s) => this.elsewhereRow(t, s)));
    }
    return { rows, order };
  }

  headline(t, blocked) {
    if (!blocked) {
      if (this.needsOnly) this.needsOnly = false;
      return div().text_size(17).font_bold().text_color(t.foreground).child("Nothing waits for you");
    }
    return h_flex().id("dx-needs").gap(7).px(6).py(3).ml(-6).items_center().rounded(3).border(1)
      .border_color(this.needsOnly ? t.blocked : t.chrome)
      .when(this.needsOnly, (el) => el.bg(t.blocked + "22"))
      .hover((s) => s.border_color(t.blocked))
      .on_click((_e, cx) => { this.needsOnly = !this.needsOnly; cx.notify(); })
      .child(div().flex_none().text_size(12).text_color(t.blocked).child("◆"))
      .child(div().flex_1().min_w(0).truncate().text_size(17).font_bold().text_color(t.blocked)
        .child(`${blocked} need${blocked === 1 ? "s" : ""} you`))
      .child(div().flex_none().text_size(11).text_color(t.muted).child(this.needsOnly ? "Show all" : "Show only these"));
  }

  meta(t, sessions) {
    const f = fleet();
    const counted = sessions.filter((s) => s.status);
    const working = counted.filter((s) => s.status === "working").length
      + f.elsewhere.filter((s) => s.status === "busy").length;
    return h_flex().gap(7).items_center().text_size(11.5).text_color(f.error ? t.ansi1 : t.muted)
      .child(div().size(7).flex_none().rounded(4).bg(f.error ? t.ansi1 : f.at ? t.working : t.dim))
      .child(div().flex_1().min_w(0).truncate().child(f.error
        ? "Can't read Claude sessions"
        : f.at ? `${clock(f.at)} · ${working} working · ${counted.length + f.elsewhere.length} in all` : "Reading sessions…"));
  }

  toggle(t, stopped) {
    return h_flex().id("dx-hide").flex_none().h(20).gap(8).items_center().text_size(11.5)
      .text_color(t.muted).hover((s) => s.text_color(t.foreground))
      .on_click((_e, cx) => {
        this.hide = !this.hide;
        localStorage.setItem("hide", this.hide ? "1" : "0");
        cx.notify();
      })
      .child(h_flex().w(26).h(14).p(2).flex_none().rounded(7)
        .bg(this.hide ? t.blocked : t.input)
        .when(this.hide, (el) => el.justify_end())
        .child(div().size(10).rounded(5).bg(t.chrome)))
      .child("Hide idle and done")
      .child(div().text_color(t.dim).child(String(stopped)));
  }

  header(t, sessions) {
    const blocked = sessions.filter((s) => s.status === "blocked").length
      + fleet().elsewhere.filter((s) => s.status === "waiting").length;
    const stopped = sessions.filter((s) => !s.status || STOPPED.has(s.status)).length;
    return v_flex().flex_none().px(14).pt(14).pb(8).gap(6)
      .child(h_flex().items_center().justify_between()
        .child(div().text_size(11).font_semibold().text_color(t.dim).child("DEV10X DESK"))
        .child(div().id("dx-space-new").px(6).rounded(3).text_color(t.dim)
          .hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => run("space.new"))
          .child("+")))
      .child(this.headline(t, blocked))
      .child(this.meta(t, sessions))
      .child(h_flex().h(30).mt(4).gap(6).items_center().border_b(1).border_color(t.input)
        .child(svg("mods/workspace-chrome/search.svg").size(13).flex_none().text_color(t.dim))
        .child(Input.new(this.input).flex_1().h_full().text_size(12.5).text_color(t.foreground)))
      .child(this.toggle(t, stopped));
  }

  render() {
    const t = theme();
    const projects = this.arranged(this.projects());
    const header = this.header(t, projects.flatMap((p) => p.sessions));
    const { rows, order } = this.build(t, projects);
    setAgentOrder(order.map((a) => a.address));
    return v_flex().size_full().min_h(0).bg(t.chrome)
      .child(header)
      .child(v_flex().flex_1().min_h(0).pb(12).overflow_y_scrollbar()
        .children(rows.length ? rows : [div().px(14).py(8).text_size(12).text_color(t.muted)
          .child(this.query || this.hide || this.needsOnly ? "No session matches that filter." : "No spaces yet.")]));
  }
}
