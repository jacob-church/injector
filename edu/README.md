# WIP

This is a TypeScript dependency injector built up in stages.

Every version has an exported `inject` function.

- `v1` is just cached singletons
- `v2` adds providers and overrides
- `v3` adds parentage (with limitations)
- `v4` resolves the limitations of `v3`
- `v5` significantly improves the performance of `v4`

TODO: useExistingFactory, namespacing?
