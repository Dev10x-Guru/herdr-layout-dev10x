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
   - **Question**: "QUESTION" with "N more waiting" (in `blocked`) on
     the right. What follows depends on the agent the column talks about
     (see How it behaves).
   - **Details / Transcript**: a 34px switch with two pills, then one of:
     - **Details**: "SESSION", then the agent's program icon, name and
       status chip; Title, Terminal, Folder, Branch and Working facts; its
       live sub-agents. Then, read from the Claude session behind the
       agent, up to five cards:
       - **Session**: its title (custom title, else Claude's own) with the
         first 8 characters of the session id.
       - **Tasks**, "N/M done": open tasks with a status mark each, then a
         "▸ N completed" line that unfolds the finished ones (in `muted`).
       - **Waiting to run** (blocked) or **Running**: the tool's name and
         its target (command, file, pattern, URL…) in the terminal font.
       - **Recent calls**: the last 8 tool calls, newest first, each with
         ✓ (`done`), ✕ (`blocked`) or … and its target.
       - **Pull request and issue**: the ticket ID found in the branch, and
         the branch's PR as "#N state" with its title.
     - **Transcript**: "TRANSCRIPT", then the last 40 messages as bubbles,
       newest at the bottom: yours ("YOU", on `selected`, indented left)
       and Claude's ("CLAUDE", on `surface` with a `border`, indented
       right), each cut at 600 characters.

A card is a 1px `border` box on `surface` with 6px corners: its title, an
optional `dim` note on the right, then its lines.

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

- A pane shows Herdr's status, or its Claude session's when Herdr has
  none. Spaces and tabs show the most urgent of Herdr's own status and
  their panes' (blocked > done > working > idle), so a waiting session
  started in a shell still marks its tab and space. Rows keep Herdr's own
  order.
- Click a space: `space.select`. Click a tab: its space, then
  `tab.select`. Click a pane: its space and tab, then `pane.focus`.
  Click a caret: fold or unfold that space or tab (remembered).
  Right-click a space: Herdr's own space menu. `+`: `space.new`.
- "Needs you only" keeps only blocked spaces, tabs and panes; click again
  ("Show all") to undo. Remembered.
- The right column talks about one terminal: the shown tab's focused pane
  when an agent or a Claude session runs there, else the tab's most urgent
  pane, else the focused or first one. Its
  Claude session is the one `claude agents --json` reports for that
  terminal's process, so a Claude session started in a plain shell counts
  even when Herdr shows no agent there.
- **Question**, when that terminal is blocked or its session has a pending
  question: "<program> needs you" in `blocked`, the session's name and what
  it waits for (`·`-joined), then what it waits on:
  - An `AskUserQuestion` with one single-pick question: the question and
    one button per option (label, and its description in `muted`).
    Clicking option N sends `hc keys <agent> down×N enter` to the agent's
    terminal and shows "Sent: <label>" (or "Couldn't answer: …" in
    `blocked`); the buttons hide until the next question.
  - Several questions, or a multi-pick one: a card per question listing
    its options, and "answer in its terminal".
  - Any other tool waiting for approval: a "<tool> wants to run" card with
    its target.
  - No readable session: "Its Claude session isn't readable here".
  Then a "Go to its terminal" button (`pane.focus` on it) and, when
  another terminal waits, "Next waiting" (its space, tab, then
  `pane.focus`).
  Otherwise: "Nothing in this tab is waiting for you." ("This terminal
  isn't waiting; another one in this tab is." when a sibling waits, "No
  terminal in this tab." when there is none) and up to six other waiting
  terminals, this tab's included, each clickable the same way.
- Question, Details and Transcript each read the session of the agent they
  show every 3s, and at once when that agent changes. A transcript is only
  re-read when its size changed.
- Details without a session says why: the agent isn't Claude Code, no
  transcript was found for its folder, or it is still looking.
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
  shared marks, chips, cards, buttons and the current-agent rule in
  `look.js`, and the Claude session reading in `session.js`:
  - `fleet.js` runs `claude agents --json` and maps each running session
    to a Herdr terminal by pid (`hc get`), shared under `overwatch.fleet`;
    `sessionAt(address)` returns a terminal's session, with its name,
    status and what it waits for. `currentTarget()` / `currentStatus()` in
    `look.js` use it, so panels follow terminals, not only Herdr agents.
  - `sessionOf(agent)` finds the transcript: a `claude.transcript` or
    `claude.session` terminal label when one is set, else the session
    `sessionAt` maps to the terminal, else the newest `.jsonl` files in
    `~/.claude/projects/<folder slug>/` (skipping team members'
    transcripts, which name an `agentName`), paired with that folder's
    Claude Code agents newest to newest by `seq`.
  - `load(file)` reads the tail of the transcript and `parse()` turns it
    into the session id, branch, the tool call waiting for a result, its
    question, tasks (from `TaskCreate`/`TaskUpdate`, else the last
    `TodoWrite`), recent calls and messages; cached by file size.
  - `prOf(cwd, branch)` asks `gh` for the branch's PR, cached for 60s.
  - `SessionWatch` keeps one part's agent loaded without blocking render.
- **Data:** `spaces()`, `panes()` (`cwd`, `branch`), `agents()` (`app`,
  `seq`), `terminals()` (sub-agents: `parent`, `state`; `labels`),
  `layout()` (the stack's `active`), `theme()`, `settings()` (the terminal
  font for tool targets), `home()`.
- **Commands:** `space.select`, `space.new`, `tab.select`, `pane.focus`,
  `pane.split`, `pane.zoom`, `pane.close`, `agent.focus`, `terminal.peek`,
  `layout.select`; `openOverlay` with the shipped `menu` mod;
  `setAgentOrder()`; and `hc keys <agent> down… enter` to pick an option.
- **Programs** (via `exec`, on the local machine):
  - `git rev-parse --path-format=absolute --git-common-dir --show-toplevel`,
    once per space folder (on the space's machine), to nest worktree
    spaces.
  - `ls -t`, `head -c 4096`, `wc -c` to find and size transcripts;
    `sh -c 'tail -c 6000000 | grep -E "type":"(user|assistant)" | tail -c
    1000000'` to read one; `grep -ohE` for its title.
  - `gh pr view --json number,title,state,url,statusCheckRollup` in the
    agent's folder (the only network call, done by `gh`).
  - `claude agents --json` and `hc get <terminal>` to map sessions to
    terminals by pid.
- **Timers:** the tree looks for new folders every 2s (git only for unseen
  ones) and refreshes the Claude session list every 5s; Question, Details
  and Transcript poll their agent's session every 3s; rail and details
  redraw every 30s for the "working" times. Pane marks keep Herdr's status
  and fall back to the session's; tab and space marks take the most urgent
  of Herdr's and their panes'.
- **Shipped art it borrows:** `mods/workspace-chrome/spinner.svg` and
  `branch.svg`, `mods/pane/{split-right,split-down,zoom,unzoom,close}.svg`.

## Watch out

- **The session link comes from `claude agents --json`.** Herdr doesn't
  say which Claude session a terminal runs, so the session list is matched
  to terminals by pid. When `claude` can't list sessions, or a terminal's
  session isn't in that list, it falls back to a guess: the folder's
  Claude Code agents paired with its newest transcripts by recency, where
  two agents in one folder can swap.
- **The session list refreshes from the tree**, as the Dev10x desk's does
  from its sidebar. If a hidden sidebar (`layout.toggle`) stops the tree's
  timers, Question, Details and Transcript keep the last list until it
  shows again; not checked in the app yet.
- **Only the tail is read** (last 6MB, then at most 1MB of conversation
  lines). On long sessions, tasks created earlier are missing or show as
  "Task #N", the recent calls and messages are the latest only, and the
  transcript says "The last N messages".
- **Answering presses keys.** An option button sends Down N times, then
  Enter, assuming Claude Code's picker opens on the first option and
  nobody has moved it. If you arrowed in the terminal first, the wrong
  option is picked. Several questions or multi-pick ones aren't answered
  from here.
- **The PR card needs `gh`** installed and logged in, in the agent's
  folder; without it the PR line stays empty. Transcripts are read on this
  machine only, so agents in remote spaces show no session.
- No `preview.png` yet: the layout loads with no errors in the app, but
  `herdr-app shot` returned the window's last frame from before the
  switch, and a shot of a real desk shows private terminals. Take it from
  a demo space. The layout has no `preview` field.
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
  under their repo, and its marks match `herdr-app ls` for Herdr agents
  (a Claude session started in a shell adds its own status).
- Clicking a tab shows its terminals in the middle and updates the rail.
- A blocked agent in the shown tab fills Question with "needs you" and "Go
  to its terminal" focuses it, unless another agent or session there has
  focus; then it, like one in another tab, shows under "N more waiting"
  and "Next waiting" goes there.
- A Claude Code agent asking one single-pick question shows its options;
  clicking one answers it in the terminal. One waiting on a tool shows
  "<tool> wants to run".
- Details shows the session's title, tasks, waiting call, recent calls and
  the branch's PR; Transcript shows its latest messages.
- The Details/Transcript pills switch the stack.
- Switching the theme between light and dark recolors every part.
