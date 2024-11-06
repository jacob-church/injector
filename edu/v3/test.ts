import { inject, newInjector, provide } from "./injector.ts";
function assert(expression: boolean) {
    if (!expression) {
        throw Error();
    }
}

Deno.test('v3', () => {
    class B {}
    class A {public readonly b = inject(B)}

    const p = newInjector([]);
    const c = newInjector([provide(A).use(() => new A())], p);

    const cA = c.get(A);
    const cB = cA.b;
    const pA = p.get(A);
    const pB = pA.b;

    // instances of A are different, but B is shared and stored in the parent
    assert(cA !== pA);
    assert(cB === pB);
});