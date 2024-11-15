# Lazy injection and its consequences

Using an `inject` function has its trade-offs. One of those is that we cannot
know what a type depends on before we build it.

However, _after_ building something, there should be no reason why we can't
produce that information for various uses. The purpose of this document is to
explain how that works.

### The record

Every object built in the injector is wrapped in some relevant metadata. Mostly
this consists of a reference to the particular key that was used to build that
object, as well as a bit of instruction as to _how_ the object was built. This
wrapper is a useful place to hide _any_ data that we hope to associate with that
key/object.

So, the basic method for recording an objects dependencies is to somehow
activate "recording mode" before we build a key, then to stash that information
in the metadata wrapper. Then, subsequent operations can simply check the
wrapper for those dependencies wherever it is needful to do so.

### "Recording mode"

This is simple: conceptually, we can maintain a global stack, much like the
function call stack, that keeps "the thing we're building" at any given moment
on top. It's so much like the function call stack, in fact, that its simple and
hygienic to keep a single global value, and to save off previous values into a
temporary variable on the call stack itself.

### Efficient record keeping

Naively, the dependency record could simply be an array-like list of keys in the
metadata wrapper. Its conceptually simple, and interpretation is easy. However,
there are significant draw backs to this approach. Consider this arbitrarily
deep class hierarchy:

```
T0 -> T1 -> T2 -> T3 -> ... -> Tn
```

Using the method described above, imagine that we populate an array in the
wrapper for each object built. As building a class effectively requires building
its dependency first, we quickly recurse deeply to the final class in the
hierarchy. Its built, and as it has no dependencies, its record is set to `[]`.

```
Tn []
```

Next, we look at its immediate dependent. In addition to whatever direct
dependencies it has, we of course want the transitive dependencies as well, so
we copy over those dependencies.

```
Tn-1 [Tn ...]
```

Continuing on we will end up with something like this:

```
T0 [T1 T2 T3 ... Tn ...]
T1 [T2 T3 ... Tn ...]
T2 [T3 ... Tn ...]
T3 [... Tn ...]
...
Tn []
```

The problem reveals itself: there is quite a lot of duplication here! The
representation even takes a nice, obvious triangle shape. A _right_ triangle.
Half of a square. This is quadratic time and space!

#### The better way

Instead of duplicating this work, we can do something just as simple, but wildly
more efficient: just stash each dependencies wrapper in the parent wrapper

```
T0 [T1 ...]
T1 [T2 ...]
T2 [T3 ...]
T3 [... ...]
...
Tn []
```

Using this method, the dependency record is effectively a linked tree structure
that mimics the actual class composition structure. And, not only is this more
efficient in terms of space, but there are no significant losses for usage
either: most of our uses for such a record entail either looking at direct
dependencies, or evaluating transitive dependencies as a whole. We never need to
choose a transitive dependency at _random_.

The structure also lends itself simply to various search paradigms: we could
easily choose to DFS or BFS this tree, whereas the array-like list record
calcifies whatever ordering we chose at the moment of "recording".

## Piggybacking for profit: injector assignment

The "recording mode" method described above is powerful for a variety of
purposes. One is for determing what injector to assign an object too after we
build it.

> **_NOTE:_** assumed understanding of
> [injector storage expectations](./reassignment.md#the-expectation)ahead

A useful piece of metadata for our wrapper is "which injector holds this
object". As a default, that injector will be wherever a provider was first
configured (directly in a specific injector for explicit usage of `provide`, and
in the parentmost injector for a vanilla, implicit injectable).

By storing this information, and piggybacking on the stack based recording
mechanism for dependencies, it becomes trivial to decide where an object should
be stored: in a post-order recursive fashion, an object should simply be stored
in the highest injector that stored any of its direct dependencies.
