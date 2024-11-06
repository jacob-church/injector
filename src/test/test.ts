import { inject, newInjector } from "../injector.ts";
import { key } from "../providekey.ts";
import { provide } from "../provider.ts";
import { assert } from "./lib.ts";

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

Deno.test("v2", () => {
    class A {
        constructor(public readonly id: string) {}
    }
    // class B {}

    // VALUE
    const value = new A("value");
    // const b = new B();
    const valueInjector = newInjector([
        provide(A).use(() => value),
        // provide(A).use(() => b) <<<< produces expected type error
    ]);
    assert(valueInjector.get(A).id == "value");

    // FACTORY
    const factoryInjector = newInjector([
        provide(A).use(() => new A("factory")),
        // provide(A).use(() => new B()) <<<< prodces expected type error
    ]);
    assert(factoryInjector.get(A).id == "factory");

    // EXISTING
    class A_ extends A {
        constructor() {
            super("existing");
        }
    }
    const existingInjector = newInjector([
        provide(A).use(() => inject(A_)),
        // provide(A).use(() => inject(B)) <<<< produces expected type error
    ]);
    assert(existingInjector.get(A).id == "existing");

    // PROVIDE-KEY
    const AKey = key<A>("A");
    const injector = newInjector([
        provide(AKey).use(() => new A("key")),
        // provide(AKey).use(() => 1),   <<<< produces expected type error
    ]);
    assert(injector.get(AKey).id == "key");
});

Deno.test("v3", () => {
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
    assert(cA !== pA);
    assert(cB === pB);
});

Deno.test("v4", () => {
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
    const PK1 = key<number>("PK1");
    const PK2 = key<number>("PK2");

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
    assert(pA.b.c !== cA.b.c);
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
    assert(gp.get(C_) == c.get(C_));
});

Deno.test("v4 - correct dep recording on previously built keys", () => {
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

    assert(cA != pA);
});

Deno.test("v? - correctly account for newly discovered dependencies", () => {
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
    assert(gpA.b instanceof B);

    const cA = c.get(A);
    assert(cA.b instanceof B_);
    assert((cA.b as B_).d instanceof D_);
    assert(cA !== p.get(A));
});
