import { v_flex } from "gpui-base";
import { theme } from "herdr";
import { currentAgent, heading, pending, quiet } from "./look.js";

export class Transcript {
  render() {
    const t = theme();
    const agent = currentAgent();
    return v_flex().size_full().min_h(0).p(14).gap(12).overflow_y_scrollbar()
      .child(heading(t, "Transcript"))
      .child(agent
        ? pending(t, `${agent.program.name} conversation`,
          "The conversation of the Claude session behind this agent, newest at the bottom. Its live screen is the terminal in the middle.")
        : quiet(t, "No agent runs in this tab."));
  }
}
