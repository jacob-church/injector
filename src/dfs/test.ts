import { assert } from "../../src/test/lib.ts";
import { dfs, type Frame } from "./dfs.ts";

Deno.test("correct iteration", () => {
    const preorder = ["A", "B", "C", "D", "E", "F"];
    let out = "";
    dfs([preorder], (node) => {
        if (node.length == 0) {
            return [];
        }
        out += node[0];
        return [node.slice(1)];
    });
    assert(out == "ABCDEF");
});

Deno.test("correct framing", () => {
    dfs([0], (_, frame) => {
        const [val] = frame;
        if (val == 9) {
            let count = 0;
            let curr: Frame<number> | undefined = frame;
            while (curr) {
                count += 1;
                curr = curr[1];
            }
            assert(count == 10);
            return [];
        }
        return [val + 1];
    });
});
