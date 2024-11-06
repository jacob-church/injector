import { inject, newInjector } from "./injector.ts";

function assert(expression: boolean) {
    if (!expression) {
        throw Error();
    }
}

Deno.test("v1", () => {
    let count = 0;
    class A {
        constructor() {
            count += 1;
        }
    }
    class B1 {
        private a = inject(A);
    }
    class B2 {
        private a = inject(A);
    }

    const injector = newInjector();
    injector.get(B1);
    injector.get(B2);

    assert(count == 1);
});
