// One mod, one part per layout block: props().role picks it.
//   sidebar: projects > sessions (tabs with agents)   pane: each pane's header
//   work / question: the stack in the right column     switch: its pills
//   tabs: the bar above the terminals                  status: the bar below them

import { View, div } from "gpui-kit";
import { props } from "herdr";
import { PaneHeader } from "./pane.js";
import { Question } from "./question.js";
import { Sidebar } from "./sidebar.js";
import { Status } from "./status.js";
import { Switch } from "./switch.js";
import { Tabs } from "./tabs.js";
import { Work } from "./work.js";

const PARTS = {
  sidebar: Sidebar,
  pane: PaneHeader,
  work: Work,
  question: Question,
  switch: Switch,
  tabs: Tabs,
  status: Status,
};

export default class Dev10x extends View {
  init(_props, cx) {
    const Part = PARTS[props()?.role];
    this.part = Part ? new Part() : null;
    this.part?.init?.(cx);
  }

  render(cx) {
    return this.part ? this.part.render(cx) : div();
  }
}
