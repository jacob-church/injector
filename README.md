# (WIP)

A TypeScript dependency injector, written with Deno.

## Usage

A new injector can be generated with the `newInjector` function.

```
const injector = newInjector();
```

Once you have an injector object, you can request new objects with `.get`

```
const a = injector.get(A);
```

To make a class "injectable", it only needs to follow two requirements:

1. It should not have any constructor arguments
2. Any dependencies should be injected with the `inject` function:

```
class A {
  public readonly b = inject(B);
}
```

(under construction)
