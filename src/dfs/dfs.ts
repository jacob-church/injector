export type Frame<T> = [T, Frame<T> | undefined];

/**
 * Given starting roots, DFS through available values
 * by repeatedly calling the provided `next` function on a given value
 *
 * @param next should return an empty array if further iteration
 *  down a potential branch is undesirable; should return `false`
 *  if desired to short circuit the whole DFS
 */
export function dfs<T>(
    roots: T[],
    next: (node: T, frame: Frame<T>) => T[] | "stop",
) {
    const stack: Frame<T>[] = roots.map((r) => [r, undefined]);
    while (stack.length) {
        const frame = stack.pop()!;
        const children = next(frame[0], frame);
        if (children === "stop") {
            break;
        }
        stack.push(...children.map((c) => [c, frame]) as Frame<T>[]);
    }
}
