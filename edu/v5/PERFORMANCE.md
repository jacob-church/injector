# Performance

The injector has finally achieved correctness, but it's time to shore up some inefficiencies.

## Remembering what we've done

The first optimization is to add a simple [cache](./injector.ts#L71) exclusively for Built entries. Because entries are stored in the injector where their relevant provides are found, we don't want to simply store an extra copy of the provide in the current injector,
but it's trivial to store a reference. After all, the entry itself tracks it's owner, so this information is still ready at hand whenever we need it.

## Remembering what we've learned

Perhaps the most critical performance issue in the previous injector is found in [`needsRebuild`](../v4/injector.ts#L108). This function performs a depth first search through a Built entry's recorded transitive dependencies, stopping when it finds evidence that a rebuild is needed. That's all well and good, until you realize that even once it's determined a rebuild is necessary, the natural flow of our build logic suggests that the next dependency is going to run the same checks minus one in yet another call to `needsRebuild`!

<img src="" width=600>

The [updated version](./injector.ts#L107) of this function instead writes fresh, unbuilt provides into the overriding injector as it unwinds the recursion, ensuring that intervening calls to [`getBuilt`]() will immediately detect the need for a rebuild.

<img src="" width=600>

In addition, if we find _no_ overshadowing provides, we've also determined that the Built entries in question are suitable for our cache!

All of this effectively means that `needsRebuild` will only be called once on any given vertical of a class hierarchy.

<img src="" width=600>

#### Extrapolating what we can learn, from what we've done

The previous two optimizations serve each other well. With our cache in hand to tell us "this injector has settled all questions for this Entry", we can even short circuit occasionally in `needsRebuild`, because if our cache holds a Built for any given key, then we can trust with certainty that the `owner` of that Built entry has already accounted for it's transitive dependencies in the current injector.

## Ignoring the irrelevant

A small optimization, but a meaningful one: when we call [`getEntry`]() during [`getFirstOverridingInjector`](), we know that entries found at an injector deeper than the entry we began our search from are simply not important; it's enough to know that there are no overshadowing entries and just move on.

A similar insight is at work in `cacheBuilt`. When a Built entry is settled, we iterate from `this` injector to the `owner` of that entry, setting caches all along the way. Of course, we can't safely speak for any injectors below the `owner`. But we also don't need to meddle where any caches are already set.