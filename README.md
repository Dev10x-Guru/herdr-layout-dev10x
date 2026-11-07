# herdr-layout-dev10x

Dev10x layouts for the [Herdr app](https://herdr.dev).

| Layout | |
| --- | --- |
| [Overwatch](overwatch/) | a tree of spaces, tabs and agents, the shown tab's live terminals, and what waits for you |
| [Dev10x desk](dev10x/) | projects and their sessions as on the Overwatch page, live terminals, and a dock with work, question, files and changes |

## Overwatch

The Dev10x Session Overwatch page (`dev10x overwatch serve`), rebuilt as a
native Herdr layout and mod. The tree, terminals and rail run on Herdr's own
data (spaces, tabs, panes, agents). The right column reads the Claude Code
transcript behind each agent: its question with one-click answers, tasks,
the tool call waiting to run, recent calls, the branch's PR and issue, and
the conversation.

Tracking issue: [#2](https://github.com/Dev10x-Guru/herdr-layout-dev10x/issues/2).

See [overwatch/RECIPE.md](overwatch/RECIPE.md) for what it shows and how it
is built.

### Install

The folder is laid out like `~/.config/herdr-app`. Copy the layout and the
mod in, without overwriting anything of the same name:

```sh
cp overwatch/layouts/overwatch.json ~/.config/herdr-app/layouts/
cp -r overwatch/mods/overwatch ~/.config/herdr-app/mods/
herdr-app check ~/.config/herdr-app/mods/overwatch
herdr-app do layout.switch --name overwatch
```

`ctrl-shift-l` cycles back to your other layouts. To remove it, delete
`layouts/overwatch.json` and `mods/overwatch/`.

The mod runs `git rev-parse` in each space's folder (to nest worktree
spaces under their repo), reads Claude Code transcripts under
`~/.claude/projects/` with `ls`, `head`, `wc`, `tail` and `grep`, answers
questions with `hc keys`, and asks `gh pr view` for the branch's PR (its
only network call). Its matching of agents to transcripts is a best guess;
see Watch out in the recipe.

## Dev10x desk

The everyday window: the Overwatch page's navigation and look around Herdr's
own terminals. It shows the real status of Claude Code sessions started in a
shell, which Herdr itself can't see. Both side panels can be hidden, and the
dock's panels can be dragged into another order.

Tracking issue: [#4](https://github.com/Dev10x-Guru/herdr-layout-dev10x/issues/4).

See [dev10x/RECIPE.md](dev10x/RECIPE.md) for what it shows and how it is built.

### Install

```sh
cp dev10x/layouts/dev10x.json ~/.config/herdr-app/layouts/
cp dev10x/themes/dev10x.json ~/.config/herdr-app/themes/
cp -r dev10x/mods/dev10x ~/.config/herdr-app/mods/
herdr-app check ~/.config/herdr-app/mods/dev10x
herdr-app do layout.switch --name dev10x
```

To remove it, delete those three.

Every 5 seconds the mod runs `claude agents --json`, and `hc get` for each pane
running Claude Code. It also runs `git rev-parse` in each space's folder, reads
transcripts under `~/.claude/projects/` with `ls`, `head`, `wc`, `tail`, `grep`
and `sh`, answers questions with `hc keys`, and asks `gh pr view` for each
session's PR (its only network call).
