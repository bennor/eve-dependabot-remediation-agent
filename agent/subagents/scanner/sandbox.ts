import { defineSandbox } from "eve/sandbox";

export default defineSandbox(({ parent }) => {
  if (!parent) {
    throw new Error("scanner must run as a subagent of root");
  }
  return parent.sandbox;
});
