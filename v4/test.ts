import { inject, key, newInjector, provide } from "../v4/injector.ts";

function assert(expression: boolean) {
    if (!expression) {
        throw Error();
    }
}

Deno.test('v4', () => {
    class C {}
    class C_ extends C {}
    class B {public readonly c = inject(C)}
    class B_ extends B{}
    class A {public readonly b = inject(B)}
    class A_ extends A{}
    const PK1 = key<number>('PK1');
    const PK2 = key<number>('PK2');

    const gp = newInjector([
        provide(PK1).use(() => inject(PK2)),
        provide(A).use(() => inject(A_)),
    ]);
    const p = newInjector([
        provide(B).use(() => inject(B_)),
    ], gp);
    const c = newInjector([
        provide(C).use(() => inject(C_)),
        provide(PK2).use(() => 1),
    ], p);

    // child injector respects its C provider, and its ancestors providers
    const cA = c.get(A);
    assert(cA instanceof A_);
    assert(cA.b instanceof B_);
    assert(cA.b.c instanceof C_);

    // parent injector respects its B provider, and its ancestors providers
    const pA = p.get(A);
    assert(pA !== cA);
    assert(pA.b !== cA.b);
    assert(pA.b.c !== cA.b.c)
    assert(pA instanceof A_);
    assert(pA.b instanceof B_);
    assert(pA.b.c instanceof C);
    
    // grandparent injector respects its A provider
    const gpA = gp.get(A);
    assert(gpA !== pA);
    assert(gpA.b !== pA.b);
    assert(gpA.b.c === pA.b.c);
    assert(gpA instanceof A_);
    assert(gpA.b instanceof B);

    // chained existing providers work
    const cPK1 = c.get(PK1);
    assert(cPK1 === 1);
    assert(cPK1 === c.get(PK2));

    // existing is like a distinct re-query, which means that the "existing" key
    // will sink to the parent-most injector by default
    assert(gp.get(C_) == c.get(C_))
});

Deno.test('v4 - correct dep recording on previously built keys', () => {
    class C {}
    class B {public readonly c = inject(C)}
    class A {public readonly b = inject(B)}
    const p = newInjector([]);
    p.get(C);
    p.get(B);
    const pA = p.get(A);
    const c = newInjector([provide(C).use(() => new C())], p);
    const cA = c.get(A);

    assert(cA != pA);
});