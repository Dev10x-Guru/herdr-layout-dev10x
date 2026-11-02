# herdr-layout-dev10x

Dev10x layouts for the [Herdr app](https://herdr.dev).

| Layout | |
| --- | --- |
| [Overwatch](overwatch/) | a tree of spaces, tabs and agents, the shown tab's live terminals, and what waits for you |

## Overwatch

The Dev10x Session Overwatch page (`dev10x overwatch serve`), rebuilt as a
native Herdr layout and mod. This is the first pass: a skeleton on Herdr's
own data (spaces, tabs, panes, agents). Everything that needs the Claude
session behind an agent (questions and answers, tasks, recent calls, PR and
issue, transcript) shows as a "Pending" card for now.

Tracking issue: TODO(#?) — link the Overwatch integration issue here.

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
spaces under their repo). It reaches no network and reads no files.
