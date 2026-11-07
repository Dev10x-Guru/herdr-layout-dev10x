# Dev10x desk

An everyday desk for working with many coding agents, with the navigation of
the Dev10x Session Overwatch page and Herdr's live terminals in the middle. On
the left, projects and the sessions running in them, with whatever waits for
you on top; in the middle, the shown tab's terminals; on the right, a dock with
the session's work, its question, files and changes. Either side panel can be
put away. It brings its own dark theme, the Overwatch page's palette.

<!-- preview.png is not taken yet: a screenshot shows private terminal text. -->

## What you see

Left to right, filling the window under the system title bar:

1. **The sidebar**, 300px wide (drag between 220 and 520px), on `chrome`.
   - Header: "DEV10X DESK" (11px, `dim`) with a `+` for a new space; a 17px bold
     line "Nothing waits for you", or `◆ N need(s) you` in `blocked` with a
     "Show only these" toggle; a meta line with a dot and
     "14:18 · 2 working · 51 in all" (11.5px, `muted`).
   - A filter with only a bottom border, "Filter by name, branch, ticket".
   - A switch "Hide idle and done" with the count it would hide.
   - Rows of 28px, square, with a 2px left bar. The shown session has `selected`
     behind it, a `foreground` bar and a semibold name.
     - **Project** (a repo, its linked worktrees folded in): caret, status mark,
       semibold name, session count. A project with one shown session is one row:
       the project, the session's name in 11.5px `dim`, then its refs.
     - **Session**, 16px in: status mark, name, refs (ticket when the name doesn't
       already carry it, `#PR`, "N agents" above one).
     - A space with no running session is one quiet row without a mark.
     - "PINNED" above the projects when anything is pinned.
     - "OUTSIDE THIS WINDOW" lists sessions that wait for you but run in no
       terminal here: mark, name, what they wait for.
2. **The middle**, the rest of the window.
   - A 36px tab bar on `chrome`: a left panel switch, tabs as 26px pills, `+`, a
     right panel switch. A hidden panel's switch is `dim`.
   - The shown tab's panes on `background` with 6px around them, 3px corners, and
     a 28px header: status mark, program icon, name, folder and branch.
   - A 26px status bar: branch, ticket, and the bound command palette key.
3. **The dock**, 380px (280 to 900px), on `canvas`: a 36px row of pills over one
   panel at a time.
   - **Work:** tab status and name; branch, ticket, folder, session; the pull
     request with its checks; agents; tasks; what waits to run or runs; recent calls.
   - **Question:** the waiting session's question with an option per answer, a
     permission prompt's command, "Go to its terminal" and "Next waiting".
   - **Files** and **Changes:** Herdr's shipped panels.

## How it behaves

- **Status marks:** blocked is a pulsing `◆` in `blocked`, working a turning ring
  in `working`, done a check in `done`, idle a hollow ring in `idle`. A plain
  shell has no mark. A project takes its most urgent session's status, and a
  project with a waiting session sorts first after pins.
- **Clicks:** a session row selects its space and tab. A question option sends
  its keys to that terminal. Hovering a row shows pin, and on a project also
  `↑` `↓` to reorder and `+` for a new agent tab or worktree.
- **Hide and show:** the tab bar's two switches run `layout.toggle` on `sidebar`
  and `dx-side`, and Herdr remembers it. A hidden panel's switch shows `◆` while
  that panel has something waiting.
- **Rearranging the dock:** drag a pill onto another to move it there; the target
  gets an `accent` border, and a plain click still selects. The order is remembered.
- **A question comes forward once:** when the shown session starts waiting, the
  dock shows Question. Switching away stays switched until the next wait.
- **Remembered:** pins, project order, folds and "Hide idle and done". The filter
  and "Show only these" last until reload.

## Built from

- `layouts/dev10x.json`: a row of `sidebar` (block), `work` (column of `tabs`,
  `main` with `{"tab":"active"}`, `status`) and `dx-side` (column of `dx-switch`
  and the stack `dx-side-stack` with `dx-work`, `dx-question`, `files`, `changes`).
- `themes/dev10x.json`: the page's dark palette in hex. Being named like the
  layout, Settings offers it only there.
- `mods/dev10x/`, one part per `props.role`: `sidebar`, `tabs`, `pane`, `status`,
  `switch`, `work`, `question`. Shared: `fleet.js` (sessions), `session.js`
  (transcripts, PRs), `look.js` (marks, cards), three SVGs.
- Shipped mods: `files`, `changes`, `new-menu`, `menu`; icons from
  `workspace-chrome` and `pane`.
- Commands: `space.select`, `tab.select`, `tab.move`, `tab.rename`, `tab.close`,
  `pane.focus`, `pane.split`, `pane.zoom`, `pane.close`, `layout.select`,
  `layout.toggle`, `space.new`, `app.palette`.
- Programs: `claude agents --json` every 5s from the sidebar, shared with the other
  parts through `setShared`; `hc get` for each pane running Claude Code; `hc keys`
  to answer; `git rev-parse`; `gh pr view` (its only network call); `ls`, `head`,
  `wc`, `tail`, `grep` and `sh` on transcripts under `~/.claude/projects/`.

## Watch out

- Claude Code started in a shell reports nothing to Herdr: `agents()` is empty and
  `tab.status` null. Status comes from `claude agents --json`, joined on
  `foreground.pid` from `hc get`. Don't join on the folder: several sessions share
  one, and most sessions on a machine run in no terminal of this window.
- `pane.program.key` follows the foreground program, which keeps `hc get` to panes
  running Claude Code.
- A row is a tab with an agent or a Claude session. Other tabs show only in the tab
  bar, and a space with none is a quiet row, or its worktree would be unreachable.
- Don't use the shipped `tabs` mod. It closes a column named `panel` on every switch
  to a space without a saved panel, and it adds its own Files and Changes buttons.
- Sessions outside this window can't be opened or answered from here, and remote
  machines have no Claude status: the list is read locally.
- A permission prompt shows its command; answering it needs the terminal.
- Only a dark theme ships, so a light appearance still gets it. The theme picker wins
  over the layout's `theme`.
- There is no keyboard shortcut for the dock: editing `keys.json` would stop Herdr
  updating its default keys for that person. `ctrl-shift-b` toggles the sidebar.
- Transcripts reach several MB: only the tail is scanned, so a task created before
  that window shows as "Task #N".

## Done when

- `herdr-app check mods/dev10x` passes and `herdr-app status` lists no errors.
- A Claude Code session started in a shell shows a working ring while it runs, with
  its name on the row and its tasks in Work.
- A session waiting on a question moves the headline to `◆ 1 needs you`, brings
  Question forward, and an option's click answers it in its terminal.
- A session waiting in another program shows under "OUTSIDE THIS WINDOW".
- A linked worktree folds into its repo's project and stays reachable with no session.
- Both tab bar switches hide and bring back their panel, and the choice survives a restart.
- Dragging a dock pill onto another moves it, a click selects, and the order survives a reload.
