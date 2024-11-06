import { inject, newInjector } from "../injector.ts";
import { key } from "../providekey.ts";
import { provide } from "../provider.ts";
import { assert } from "./lib.ts";

Deno.test("cached singletons", () => {
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

    assert(count == 1, "should only create 1 instance of A");
});

Deno.test("providers", async (test) => {
    class A {
        constructor(public readonly id: string) {}
    }
    // class B {}

    await test.step("value provider", () => {
        const value = new A("value");
        // const b = new B();
        const valueInjector = newInjector([
            provide(A).use(() => value),
            // provide(A).use(() => b) <<<< produces expected type error
        ]);
        assert(
            valueInjector.get(A).id == "value",
            "should correctly inject a value provider",
        );
    });

    await test.step("factory provider", () => {
        const factoryInjector = newInjector([
            provide(A).use(() => new A("factory")),
            // provide(A).use(() => new B()) <<<< prodces expected type error
        ]);
        assert(
            factoryInjector.get(A).id == "factory",
            "should correctly inject a factory provider",
        );
    });

    // EXISTING
    await test.step("existing provider", () => {
        class A_ extends A {
            constructor() {
                super("existing");
            }
        }
        const existingInjector = newInjector([
            provide(A).use(() => inject(A_)),
            // provide(A).use(() => inject(B)) <<<< produces expected type error
        ]);
        assert(
            existingInjector.get(A).id == "existing",
            "should correctly inject an existing provider",
        );
    });

    // PROVIDE-KEY
    await test.step("provide key provider", () => {
        const AKey = key<A>("A");
        const injector = newInjector([
            provide(AKey).use(() => new A("key")),
            // provide(AKey).use(() => 1),   <<<< produces expected type error
        ]);
        assert(
            injector.get(AKey).id == "key",
            "should correctly use a provide key",
        );
    });
});

Deno.test("provider priority", () => {
    class B {}
    class A {
        public readonly b = inject(B);
    }

    const p = newInjector([]);
    const c = newInjector([provide(A).use(() => new A())], p);

    const cA = c.get(A);
    const cB = cA.b;
    const pA = p.get(A);
    const pB = pA.b;

    // instances of A are different, but B is shared and stored in the parent
    assert(cA !== pA, "child provider should take precedence over the parent");
    assert(cB === pB, "implicit provides should always come from the parent");
});

Deno.test("dependency consideration", async (test) => {
    class C {}
    class C_ extends C {}
    class B {
        public readonly c = inject(C);
    }
    class B_ extends B {}
    class A {
        public readonly b = inject(B);
    }
    class A_ extends A {}

    const gp = newInjector([
        provide(A).use(() => inject(A_)),
    ]);
    const p = newInjector([
        provide(B).use(() => inject(B_)),
    ], gp);
    const c = newInjector([
        provide(C).use(() => inject(C_)),
    ], p);

    // child injector respects its C provider, and its ancestors providers
    const cA = c.get(A);
    await test.step("child injector", () => {
        assert(cA instanceof A_, "should make an A_");
        assert(cA.b instanceof B_, "should make a B_");
        assert(cA.b.c instanceof C_, "should make a C_");
    });

    // parent injector respects its B provider, and its ancestors providers
    const pA = p.get(A);
    await test.step("parent injector", () => {
        assert(pA !== cA, "should make a different A from the child");
        assert(pA.b !== cA.b, "should make a different B from the child");
        assert(pA.b.c !== cA.b.c, "should make a different C from the child");
        assert(pA instanceof A_, "should make an A_");
        assert(pA.b instanceof B_, "should make a B_");
        assert(pA.b.c instanceof C, "should make a C");
    });

    // grandparent injector respects its A provider
    const gpA = gp.get(A);
    await test.step("grandparent injector", () => {
        assert(gpA !== pA, "should make a different A from the parent");
        assert(gpA.b !== pA.b, "should make a different B from the parent");
        assert(gpA.b.c === pA.b.c, "should make the same C as the parent");
        assert(gpA instanceof A_, "should make an A_");
        assert(gpA.b instanceof B, "should make a B");
    });
});

Deno.test("existing provider chaining", () => {
    const PK1 = key<number>();
    const PK2 = key<number>();
    const PK3 = key<number>();
    const PK4 = key<number>();

    const p = newInjector([
        provide(PK2).useValue(0),
        provide(PK3).useExisting(PK4),
    ]);
    const c = newInjector([
        provide(PK1).useExisting(PK2),
        provide(PK4).useValue(1),
    ], p);

    const zero = c.get(PK1);
    assert(
        zero === 0,
        "should correctly chain existing provides from child to parent",
    );
    const one = c.get(PK3);
    assert(
        one === 1,
        "should correctly chain existing provides from parent to child",
    );
});

Deno.test("correct dependency recording on previously built keys", () => {
    class C {}
    class B {
        public readonly c = inject(C);
    }
    class A {
        public readonly b = inject(B);
    }
    const p = newInjector([]);
    p.get(C);
    p.get(B);
    const pA = p.get(A);
    const c = newInjector([provide(C).use(() => new C())], p);
    const cA = c.get(A);

    assert(
        cA != pA,
        "should detect a provider for a transitive dependency and make a new instance",
    );
});

Deno.test("correct accounting for newly discovered dependencies", () => {
    class D {}
    class D_ extends D {}
    class C {}
    class B {
        public c = inject(C);
    }
    class B_ extends B {
        // adds a new dependency to the dependency tree
        public d = inject(D);
    }
    class A {
        public b = inject(B);
    }

    const gp = newInjector([]);
    const p = newInjector([
        provide(B).use(() => inject(B_)),
    ], gp);
    const c = newInjector([
        provide(D).use(() => new D_()),
    ], p);

    const gpA = gp.get(A);
    assert(
        gpA.b instanceof B,
        "grandparent shouldn't know about any other type B",
    );

    const cA = c.get(A);
    assert(cA.b instanceof B_, "child should make a B_");
    assert(
        (cA.b as B_).d instanceof D_,
        "child should incorporate previously unknown provides",
    );
    assert(cA !== p.get(A), "child and parent should make different A");
});
