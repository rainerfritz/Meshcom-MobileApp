// Check of a command typed by hand before it is sent to the node. A node command starts with two
// ASCII hyphens ("--info"). iOS autocorrect turns "--" into a long dash, which the node does not know.

// the frame to the node has a one byte length: command bytes + 2 header bytes <= 255
export const MAX_MANUAL_CMD_BYTES = 250;

export interface ManualCommandCheck {
  ok: boolean,
  cmd: string,      // trimmed command, to send if ok
  error: string     // text for the user, "" if ok
}

// dash like characters a keyboard may put in place of a hyphen: figure/en/em dash, horizontal bar, minus sign ...
const LOOKALIKE_DASH = /^[‐-―−﹘﹣－]/;

export const checkManualCommand = (input: string): ManualCommandCheck => {
  const cmd = input.trim();

  if (cmd === "") {
    return { ok: false, cmd, error: "Please enter a command." };
  }
  if (!cmd.startsWith("--")) {
    const hint = LOOKALIKE_DASH.test(cmd)
      ? "It starts with a long dash instead of two hyphens. The keyboard autocorrect probably replaced them, please check the start of the command."
      : "A command has to start with two hyphens, e.g. --info.";
    return { ok: false, cmd, error: hint };
  }
  if (cmd.length === 2 || cmd[2] === "-" || cmd[2] === " ") {
    return { ok: false, cmd, error: "Please enter the command name right after the two hyphens, e.g. --info." };
  }
  if (new TextEncoder().encode(cmd).length > MAX_MANUAL_CMD_BYTES) {
    return { ok: false, cmd, error: "The command is too long." };
  }
  return { ok: true, cmd, error: "" };
};
