# Simple, clean, lazy

A TypeScript dependency injector, written with Deno.

[![JSR Version](https://jsr.io/badges/@cjc/injector)](https://jsr.io/@cjc/injector)
[![JSR Score](https://jsr.io/badges/@cjc/injector/score)](https://jsr.io/@cjc/injector/score)
[![ci](https://github.com/jacob-church/injector/actions/workflows/publish.yml/badge.svg)](https://github.com/jacob-church/injector/actions/workflows/publish.yml)

## Usage

A new injector can be generated with the `newInjector` function:

```typescript
const injector = newInjector();
```

Once you have an injector object, you can request new objects with `.get`:

```typescript
const a = injector.get(A);
```

To make a class "injectable", it only needs to follow two requirements:

1. It should not have any constructor arguments.
2. Any dependencies should be injected with the `inject` function:

```typescript
class A {
    public readonly b = inject(B);
}
```

> **_NOTE:_** A class that has `inject` dependencies _cannot_ be constructed
> outside of an active injector context.

### Configuring an injector

To prepare an injector to serve sub-classes, use `provide`:

```typescript
const injector = newInjector([
    provide(A).useExisting(MockA),
]);
```

The `provide` function produces an object that can be used for several different
kinds of provides:

```typescript
const injector = newInjector([
    provide(A).useValue(a), // concrete values
    provide(A).useFactory(() => new AWithArgs(arg1, arg2)), // classes that take constructor arguments
    provide(A).useExisting(SubA), // simple subsitutions from type to a subtype
]);
```

> **_NOTE:_** The `useFactory` pattern above lets you break the first rule of
> "injectability". That's ok! Just be aware of the unique needs that a class
> with constructor arguments imposes

For providing primitive or optional values, use `key`:

```typescript
// type annotation is necessary for enforcing type checking on subsequent provides
// a string identifier is used to produce useful injection stack traces when injection errors occur
const NumberKey = key<number>("NumberKey");

const injector = newInjector([
    provide(NumberKey).useValue(10),
]);
```

> **_NOTE:_** to inject a value that may or may not be configured with a
> provider, but shouldn't cause an error, use `injectOptional`.

### Injector hierarchy

You can create sub-injectors by passing an existing injector to the
`newInjector` function:

```typescript
const parent = newInjector([]);
const child = newInjector([], parent);
```

Calling `.get` on a sub-injector will build and store new objects in the
parent-most injector by default; however, when building with a sub-injector, the
child-most provides will always take precedence:

```typescript
const parent = newInjector();
const child = newInjector([
    provide(A).useExisting(MockA),
], parent);
child.get(A); // returns a `MockA`; built and stored by the child injector
```

This even works with transitive dependencies:

```typescript
class A {
    private b = inject(B);
}
class B {
    private c = inject(C);
}
class C {}
const parent = newInjector();
const child = newInjector([
    provide(C).useExisting(MockC),
], parent);
const a = child.get(A); // returns an `A` distinct from any `A` in the parent, such that `a.b.c instanceof MockC`
```

### Injecting outside of the constructor context

It is possible to save off the injection context which created a specific object
for use at other arbitrary times with `getInjectionContext`:

```typescript
class Z { public x = inject(X)}
class X {}

class A {
  private context = getInjectionContext();

  public foo(): {
    const z = context.run(() => inject(Z));
    // ...
  }
}
newInjector().get(A).foo(); // won't produce an error!
```

This can be particularly useful when a class needs to create `new` objects that
rely on some otherwise injectable state:

```typescript
class Ship {
    private shipSerializer = inject(ShipSerializer);
    constructor(private shipConfig: ShipConfig) {}
}
class Fleet {
    public context = getInjectionContext();
    private ships: Ship[] = [];
    public addShip(config: ShipConfig) {
        this.ships.push(this.context.run(() => new Ship(config)));
    }
}
```

> **_NOTE:_** Effectively this method means the same injector that received the
> `.get` request which created this object will receive its `.run` requests;
> currently, this is irrespective of what injector may ultimately "store" the
> object that is calling `getInjectionContext`
