# Overwatch

A three-column desk for watching many coding agents at once. On the left, a
tree of every space, its tabs and their panes, each with its agent's status;
in the middle, the live terminals of the shown tab; on the right, what is
waiting for you and the details of the agent you are looking at. It follows
the person's theme, light or dark.

<!-- preview.png is not taken yet; see Watch out. -->

## What you see

Left to right, filling the window under the system title bar:

1. **The tree**, 288px wide (drag between 200 and 520px), on the theme's
   `chrome` color.
   - A header: "OVERWATCH" (11px, `dim`) with a `+` on the right; a 15px
     line "N need(s) you" in `blocked`, or "Nothing waits for you" in
     `foreground`; then "N working · N agents · N spaces" (11.5px, `muted`)
     and a "Needs you only" toggle.
   - Below it, a scrolling list of 28px rows, indented 16px per level:
     - **Space** rows: a fold caret (▾/▸), its status mark, its name
       (`foreground` when shown, else `muted`), its branch when it differs
       from the name (11.5px, `dim`), and its tab count. A space that is a
       linked git worktree sits one level in, under its repo's space, with
       a branch icon.
     - **Tab** rows, under their space: caret, status mark, tab name, pane
       count. The shown tab is highlighted in `selected`.
     - **Pane** rows, under their tab, one per terminal pane: status mark,
       the program's icon, and its name (the agent or shell's name, else the
       terminal title).
2. **The work column**, taking the rest of the width.
   - **The rail**, 40px, `chrome`: the shown tab's status mark, "space /
     tab" (the tab name semibold), the space's branch, then "working 12m ·
     N panes · N agents" and a status chip.
   - **The terminals** of the shown tab, as Herdr arranges them, with 8px
     padding and gaps, 8px corners, 1px `border` (`accent` while focused).
     Every pane, even a lone one, has a 30px header: status mark, program
     icon, name, folder (`~`-shortened) and branch.
3. **The right column**, 380px (drag between 300 and 720px), `chrome`, in
   two parts split 2:3 with a 1px `border` divider:
   - **Question**: "QUESTION" with "N waiting elsewhere" (in `blocked`) on
     the right. What follows depends on the agent the column talks about
     (see How it behaves).
   - **Details / Transcript**: a 34px switch with two pills, then one of:
     - **Details**: "SESSION", then the agent's program icon, name and
       status chip; Title, Terminal, Folder, Branch and Working facts; its
       live sub-agents. Then five "Pending" cards: Callsign and summary,
       Tasks, Waiting to run, Recent calls, Pull request and issue.
     - **Transcript**: "TRANSCRIPT" and a "Pending" card for the agent's
       conversation.

A "Pending" card is a 1px `border` box on `surface` with its title, a grey
"Pending" chip and one line on what will show there.

Colors come only from `theme()` and the layout's theme names (`canvas`,
`chrome`, `background`, `border`, `accent`); there is no palette of its
own, and no fonts are set.

## How it behaves

| Status | Mark | Elsewhere |
| --- | --- | --- |
| blocked | ◆ in `blocked`, opacity pulses over 1.2s | "Needs you" chip on the pane header, rail and details |
| working | a ring spinner in `working`, one turn per 0.9s | "working 12m" on the rail |
| done | a 7px dot in `done` | — |
| idle | a 7px ring in `idle` | — |

- Spaces and tabs show the most urgent status of their agents (blocked >
  done > working > idle); Herdr computes it. Rows keep Herdr's own order.
- Click a space: `space.select`. Click a tab: its space, then
  `tab.select`. Click a pane: its space and tab, then `pane.focus`.
  Click a caret: fold or unfold that space or tab (remembered).
  Right-click a space: Herdr's own space menu. `+`: `space.new`.
- "Needs you only" keeps only blocked spaces, tabs and panes; click again
  ("Show all") to undo. Remembered.
- The right column talks about one agent: the focused pane's agent when it
  is in the shown tab, else the shown tab's most urgent agent.
- **Question**, when that agent is blocked: "<program> needs you" in
  `blocked`, the terminal title, a Pending card for the question and
  options, a "Go to its terminal" button (`pane.focus` on it) and, when
  another tab has a blocked agent, "Next waiting" (`agent.focus` on it).
  Otherwise: "Nothing in this tab is waiting for you." (or "No agent runs
  in this tab.") and up to six blocked agents elsewhere, each clickable
  (`agent.focus`).
- Clicking a sub-agent in Details peeks at it (`terminal.peek`).
- The switch pills run `layout.select` on the stack; the shown pill is
  `selected`.
- Pane header: hovering swaps the blocked chip for split right, split
  down, zoom/unzoom and close buttons; clicking it focuses the pane.
- `agent.next` / `agent.prev` follow the tree's order.

## Built from

- **The layout** (`layouts/overwatch.json`): root `row` `ow-root`
  (`background: canvas`, `terminal_padding: [12, 10]`, 1px `border`
  dividers) with:
  - `ow-sidebar`: block, `px 288`, min 200, max 520, `background: chrome`,
    mod `overwatch` `{role: "tree"}`.
  - `ow-work`: non-resizable `column`: `ow-rail` (block, `px 40`, `chrome`,
    mod `{role: "rail"}`) and `ow-terminals` (block, padding 8,
    `content: {tab: "active", pane: {gap 8, radius 8, background,
    lone: true, border, focus accent, header: {mod overwatch {role: "pane"},
    height 30, top, always}}}`).
  - `ow-side`: `column`, `px 380`, min 300, max 720, `chrome`: `ow-answer`
    (block, weight 2, min 140, `{role: "answer"}`) and `ow-side-lower`
    (non-resizable column, weight 3, min 220): `ow-side-switch` (block,
    `px 34`, `{role: "switch", stack: "ow-side-stack"}`) above
    `ow-side-stack` (stack, active `ow-detail`): `ow-detail`
    (`{role: "detail"}`) and `ow-transcript` (`{role: "transcript"}`).
- **One mod** (`mods/overwatch/`, `place: "none"`): `main.js` picks a part
  by `props().role`; each part is its own module: `tree.js`, `rail.js`,
  `pane.js`, `answer.js`, `detail.js`, `transcript.js`, `switch.js`, with
  shared marks, chips and the current-agent rule in `look.js`.
- **Data:** `spaces()`, `panes()`, `agents()`, `terminals()` (sub-agents:
  `parent`, `state`), `layout()` (the stack's `active`), `theme()`.
- **Commands:** `space.select`, `space.new`, `tab.select`, `pane.focus`,
  `pane.split`, `pane.zoom`, `pane.close`, `agent.focus`, `terminal.peek`,
  `layout.select`; `openOverlay` with the shipped `menu` mod; and
  `setAgentOrder()`.
- **Programs:** `git rev-parse --path-format=absolute --git-common-dir
  --show-toplevel` via `exec`, once per space folder (on the space's
  machine), to nest worktree spaces. Nothing else runs; no network.
- **Timers:** the tree looks for new folders every 2s (git only for unseen
  ones); rail and details redraw every 30s for the "working" times.
- **Shipped art it borrows:** `mods/workspace-chrome/spinner.svg` and
  `branch.svg`, `mods/pane/{split-right,split-down,zoom,unzoom,close}.svg`.

## Watch out

- **Pending, not built yet.** Herdr can't tell which Claude session an agent
  is, so these are placeholder cards: the question and its answer buttons,
  callsign and summary, tasks, the tool call waiting to run, recent calls,
  PR and issue, and the transcript. They need the Overwatch link tracked in
  this repo's issue (see README). Until then, answer in the terminal.
- No `preview.png` yet: `herdr-app shot` needs the layout installed and
  shown, which this build didn't do. The layout has no `preview` field.
- `herdr-app check` renders with no spaces or agents, so it only proves the
  empty states. The tree, pane header and blocked Question only run inside
  the app.
- Rows keep Herdr's order; Overwatch's web page sorted blocked first. The
  tree doesn't scroll to the selection and has no compact rail when narrow
  (min width 200px).
- Worktree nesting needs git where the space's first terminal is; a space
  outside a repo, or on a machine that can't be reached, stays top level.
- It borrows icons from shipped mods (`workspace-chrome`, `pane`) and the
  shipped `menu`; if Herdr renames them, those icons go blank.
- If `overwatch` is taken, rename the layout file, the `mod` names in it and
  the mod folder; the mod has no `mods/overwatch/` paths of its own.

## Done when

- `herdr-app check mods/overwatch` passes.
- The tree lists every space, tab and terminal pane, with worktree spaces
  under their repo, and its marks match `herdr-app ls`.
- Clicking a tab shows its terminals in the middle and updates the rail.
- A blocked agent in the shown tab fills Question with "needs you" and "Go
  to its terminal" focuses it; one in another tab shows under "waiting
  elsewhere" and "Next waiting" goes there.
- The Details/Transcript pills switch the stack.
- Switching the theme between light and dark recolors every part.
