import { inject, key, newInjector, provide } from "./injector.ts";

function assert(expression: boolean) {
    if (!expression) {
        throw Error();
    }
}

Deno.test('v2', () => {
    class A {
        constructor(public readonly id: string) {}
    }
    class B {}

    // VALUE
    const value = new A('value');
    const b = new B();
    const valueInjector = newInjector([
        provide(A).use(() => value),
        // provide(A).use(() => b) <<<< produces expected type error
    ]);
    assert(valueInjector.get(A).id == 'value');

    // FACTORY
    const factoryInjector = newInjector([
        provide(A).use(() => new A('factory')),
        // provide(A).use(() => new B()) <<<< prodces expected type error
    ]);
    assert(factoryInjector.get(A).id == 'factory');

    // EXISTING
    class A_ extends A{
        constructor() {
            super('existing');
        }
    }
    const existingInjector = newInjector([
        provide(A).use(() => inject(A_)),
        // provide(A).use(() => inject(B)) <<<< produces expected type error
    ])
    assert(existingInjector.get(A).id == 'existing');

    // PROVIDE-KEY
    const AKey = key<A>('A');
    const injector = newInjector([
        provide(AKey).use(() => new A('key')),
        // provide(AKey).use(() => 1),   <<<< produces expected type error
    ]);
    assert(injector.get(AKey).id == 'key');
});