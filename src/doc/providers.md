# Providers: the language of the injector

Using a solitary injector to build things is acceptable. But the power of the
injector is demonstrated through the usage of `Providers`.

## Providing a substition

Fundamentally, you turn to a dependency injector for `Dependency Injection`. And
that means defining substitutions.

### useExisting

Theoretically, the most straightforward is the **"existing provider"**

```typescript
provide(T).useExisting(OtherT);
```

This provider says that if an object of type `T` is requested, an object of
derived type `OtherT` should be supplied instead.

> **_NOTE:_** This construction has certain implications that may not be
> obvious. See [`useExisting in a hierarchy`](#useexisting-in-a-hierarchy)
> below.

### useFactory

Another simple provider is the **"factory provider"**

```typescript
provide(T).useFactory(() => new T(...args));
```

The most basic usage of this provider is to generate objects that require
arguments.

> **_NOTE:_** Remember, as we typically rely on the `inject` function for
> dependencies, its actually unusual to require arguments in this way!

### useValue

The last basic provider is the **"value provider"**

```typescript
provide(T).useValue(instanceOfT);
provide(TKey).useValue(instanceOfT);
```

Use this provider to supply a value that was previously constructed by hand, or,
more commonly, in conjunction with a `ProvideKey` to supply primitive,
"non-constructable" values, such as configurable numbers or strings.

## useExisting in a hierarchy

Factory and Value providers have straightforward behavior. They prompt the
configured injector to supply a value from that injector.

`useExisting` is more interesting.

You should think of `useExisting` as a "re-key". In other words, when this
provider is used, the request for the first type is substituted for a new
request for the second type. This is especially interesting in the context of an
injector hierarchy. Consider:

```typescript
parent = injector([
    provide(NullNetworkClient).useFactory(() =>
        new ConsoleLoggingNullNetworkClient()
    ),
]);
child = injector([
    provide(NetworkClient).useExisting(NullNetworkClient),
], parent);
```

In this example, what will a request to the `child` injector for a
`NetworkClient` produce? Leveraging what we've discussed, first the request for
a `NetworkClient` will be substituted with a re-request for a
`NullNetworkClient`. As the `child` injector has no particular opinions on that
type, the request for `NullNetworkClient` will be handled by the parent, which
explicitly suggests that the response should be to generate a
`new ConsoleLoggingNetworkClient()`. In practice, such interactions may usually
be fairly limited, but in theory, one can conceive of quite sophisticated
interactions in this vein.
