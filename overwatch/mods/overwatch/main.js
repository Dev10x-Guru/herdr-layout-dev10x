// One mod, one part per layout block: props().role picks it.
//   tree: spaces > tabs > panes          rail: the shown tab's line above the terminals
//   pane: each pane's header             answer: what waits for you
//   detail / transcript: the stack in the right column, switch: its tabs

import { View, div } from "gpui-kit";
import { props } from "herdr";
import { Answer } from "./answer.js";
import { Detail } from "./detail.js";
import { PaneHeader } from "./pane.js";
import { Rail } from "./rail.js";
import { Switch } from "./switch.js";
import { Transcript } from "./transcript.js";
import { Tree } from "./tree.js";

const PARTS = {
  tree: Tree,
  rail: Rail,
  pane: PaneHeader,
  answer: Answer,
  detail: Detail,
  transcript: Transcript,
  switch: Switch,
};

export default class Overwatch extends View {
  init(_props, cx) {
    const Part = PARTS[props()?.role];
    this.part = Part ? new Part() : null;
    this.part?.init?.(cx);
  }

  render(cx) {
    return this.part ? this.part.render(cx) : div();
  }
}
