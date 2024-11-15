# Reassigning a built object to an injector in the hierarchy (efficiently)

> **_NOTE:_** This documentation assumes understanding of
> [providers.md](./providers.md), and
> [lazyDependencyRecord.md](./lazyDependencyRecord.md)

## The expectation

Because injectors can exist as part of a hierarchy, the question arises as to
where to store (or "assign") an injected object. The problem stems from the fact
that some requestable type may transitively depend on some other type for which
the requested injector has a provider.

For example:

```
   | T0 | ... | T? | ... | Tn |
i_0|    | ... |    | ... |    |
...| .. | ... | .. | ... | .. |
i_?|    | ... | !! | ... |    |   <-- Some override provider
...| .. | ... | .. | ... | .. |
i_d|    | ... |    | ... |    |
```

Given an injector hierarchy with an arbitrary number (`d`) of injectors, and
some requestable type `T0` that has some arbitrary number (`n`) of transitive
dependencies, it is not unreasonable to imagine an arbitrary injector (`i_?`)
within the hierarchy that explicitly provides some arbitrary transitive
dependency (`T?`).

In such a case, a request to `i_d` for type `T0` should rightly be expected to
generate a new value for `T0`, independant from any value that might already
exist in `i_0`. In addition, we should expect the created object to ultimately
be stored by injector `i_?` where the incriminating provide resides.

## The problem

If no injector in the hierarchy has ever built the requested type, there is no
problem, we can simply build that type and rely on the algorithm described in
[lazyDependencyRecord.md](./lazyDependencyRecord.md#piggybacking-for-profit-injector-assignment)
to correctly assign the built object to its home injector.

However, if the type _has_ been built previously within the injector hierarchy,
a dependency record exists, and that means a decision must be made: do we return
the previously built object? Or, do we need to rebuild it?

> **_NOTE:_** the question could be asked: why not just build it and find out?.
> Aside from the obvious waste of memory and time that might represent, its also
> worth considering the horrific bugs that could arise if an object built (and
> potentially secretly discarded) in this way were to have constructor
> side-effects. To be clear, constructor side-effects should be regarded with
> suspicion as is, but we certainly wouldn't wish to exacerbate such a problem
> with hidden constructor calls.

Deciding this amounts to asking: does any transitive dependency have a provider
override?

## The algorithm

Greedily DFS through recorded dependencies; if an overriding provider is found,
approve a rebuild.

That's it*. A simple iteration down the "dependency tree" recorded on a built
provide.

## *Keeping injector performance healthy

The above approach is sufficient if we only look at the question being resolved
in isolation. The shortcoming emerges when we consider a build step in the
context of all subsequent build steps.

Consider again the injector configuration shown above:

```
   | T0 | ... | T? | ... | Tn |
i_0|    | ... |    | ... |    |
...| .. | ... | .. | ... | .. |
i_?|    | ... | !! | ... |    |   
...| .. | ... | .. | ... | .. |
i_d|    | ... |    | ... |    |
```

Recognize that a request to build `T0` will inevitable result in a subsequent
request to build `T1`, which results in a request for `T2`, etc. If `T?` is
quite deep in this class hierarchy, then the greedy-DFS will need to perform
some number `x` iterations to resolve the matter. Fine. We determine that `T0`
needs to be built. To do so we attempt to build `T1`. But, as this is a new
type, the question is asked again: should we use the previously built value? Or,
rebuild it? So we greedily DFS through the dependencies of `T1`, until we find
`T?`, `x-1` iterations later... you see where this is going. We've taken our
otherwise linear build pass and made it quadratic!

One solution might be to define a completely parallel build process for things
that are determined to require rebuilding. This seems bound to result in future
bugs, and much wasteful duplication of logic. The better solution is to take
advantage of the recursive nature of our DFS, and in post-order fashion generate
new, "unbuilt" providers in the relevant injector, ensuring that subsequent
requests are faced with a straightforward decision: this provider is not built,
and when I see unbuilt providers, _I build them_.

```
   | T0 | ... | T? | ... | Tn |
i_0|    | ... |    | ... |    |
...| .. | ... | .. | ... | .. |
i_?| !! | !!! | !! | ... |    |   <-- When unrolling the recursion, propogate new provides through the injector.
...| .. | ... | .. | ... | .. |       Subsequent requests will just build the provides in place
i_d|    | ... |    | ... |    |
```

There is an additional optimization that can be achieved at little cost during
this process.

Should any "branch" of the dependency tree prove to not require a rebuild, it is
simple to cache what we've learned. As we unroll the recursion on such a branch,
go ahead and cache any provides evaluated. The requested injector should no
longer need to quibble over those values for any reason.
