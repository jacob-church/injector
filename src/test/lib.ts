export function assert(expression: boolean, msg: string = "Assertion failed") {
  if (!expression) {
    throw Error(msg);
  }
}
