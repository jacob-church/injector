/*
v5

A _performant_ injector.
The previous version achieved correctness, but recomputes a few things more
than we would like. This version keeps better track of work that's already
been done, and agressively pursues optimal performance

*/

class ProvideKey<T> {
    constructor(public readonly name: string) {}
}
export function key<T>(name: string) {
    return new ProvideKey<T>(name);
}

type Ctor<T> = new () => T;
type Abstract<T> = abstract new () => T;
type InjectKey<T = unknown> = ProvideKey<T> | Ctor<T> | Abstract<T>;

interface Provide<T = unknown> {
    key: InjectKey<T>;
    factory: () => T;
}

class Provider<T> {
    constructor(private readonly key: InjectKey<T>) {}

    public use(factory: () => T): Provide<T> {
        return {
            key: this.key,
            factory,
        };
    }
    // value    {key: K, factory: () => <instance of K>}
    // factory  {key: K, factory: () => new K()}
    // existing {key: K, factory: () => inject(K_)}
}
export function provide<T>(key: InjectKey<T>): Provider<T> {
    return new Provider(key);
}

type Entry<T = unknown> = Provide<T> & {
    owner: Injector;
    value?: T;
    deps?: Built[];
};
type Built<T = unknown> = Entry<T> & {
    value: T;
    deps: Built[];
};
function isBuilt<T>(provide: Entry<T>): provide is Built<T> {
    return typeof provide.deps !== "undefined";
}

class Injector {
    // v5 - containing these values and functions in the class secures the global injector context value from fiddling
    private static context: Injector | undefined = undefined;
    public static inject<T>(key: InjectKey<T>): T {
        if (!Injector.context) {
            throw new Error();
        }
        return Injector.context.getInContext(key);
    }
    private static buildingProvide: Built | undefined = undefined;

    private entries = new Map<InjectKey, Entry>();
    private rank: number;
    // v5 - a more immediate cache that answers "has this type ever been requested by THIS injector before"
    private cache = new Map<InjectKey, Built>();
    constructor(provides: Provide[] = [], private parent?: Injector) {
        provides.forEach((p) => this.setLocalEntry(p));
        this.rank = this.parent ? this.parent.rank + 1 : 0;
    }

    public get<T>(key: InjectKey<T>): T {
        const prevInjector = Injector.context;
        Injector.context = this;
        try {
            return this.getInContext(key);
        } finally {
            Injector.context = prevInjector;
        }
    }

    private getInContext<T>(key: InjectKey<T>): T {
        // v5 - object built by this injector are returned lightning fast
        const built = this.cache.get(key) as Built<T> ?? this.getBuilt(key);
        if (Injector.buildingProvide) {
            Injector.buildingProvide.deps.push(built);
            Injector.buildingProvide.owner = built.owner.maxRank(
                Injector.buildingProvide.owner,
            );
        }
        return built.value;
    }

    private getBuilt<T>(key: InjectKey<T>): Built<T> {
        const entry = this.getEntry(key)!;
        if (isBuilt(entry) && !this.needsRebuild(entry)) {
            return entry;
        }
        return this.build(entry);
    }

    private needsRebuild(entry: Built): boolean {
        return this.getFirstOverridingInjector(entry, entry.owner)[1];
    }

    private getFirstOverridingInjector(
        built: Built,
        firstOwningInjector: Injector,
    ): [Injector | undefined, boolean] {
        // v5 - whether by previous build at this injector, or just an overshadowing provide,
        // we see if there is a provide that is higher ranked than the build record
        const entry = this.cache.get(built.key) ??
            this.getEntry(built.key, firstOwningInjector);
        if (entry && entry.owner.rank > firstOwningInjector.rank) {
            return [entry.owner, false];
        }
        for (const dep of built.deps) {
            const [injector, needsRebuild] = this.getFirstOverridingInjector(
                dep,
                firstOwningInjector,
            );
            if (injector) {
                // v5 - writing fresh provides into the overriding injector ensures that future calls
                // to needsRebuild are avoided for every key between here and the first entry that called this method
                needsRebuild && injector.setLocalEntry(dep);
                return [injector, true];
            }
        }
        // determining that previously built entries are not overshadowed in this injector also means
        // future requests can return lightning fast
        this.cacheBuilt(built);
        return [undefined, false];
    }

    private setLocalEntry(provide: Provide): void {
        this.entries.set(provide.key, {
            key: provide.key,
            factory: provide.factory,
            owner: this,
        });
    }

    private getEntry<T>(
        key: InjectKey<T>,
        backstop?: Injector | undefined, // v5 - allows for slightly truncating these plunges looking for provides
    ): Entry<T> | undefined {
        const entry = this.cache.get(key) ?? this.entries.get(key);
        if (entry) {
            return entry as Entry<T>;
        }
        if (this == backstop) {
            return undefined;
        }
        if (this.parent) {
            return this.parent.getEntry(key, backstop);
        }
        return {
            key,
            factory: () => new (key as Ctor<T>)(),
            owner: this,
        };
    }

    private build<T>(entry: Entry<T>): Built<T> {
        const built = { ...entry, deps: [] } as Built<T>;
        const prevBuildingProvide = Injector.buildingProvide;
        Injector.buildingProvide = built;
        try {
            built.value = built.factory();
        } finally {
            Injector.buildingProvide = prevBuildingProvide;
        }
        built.owner.entries.set(built.key, built);
        // v5 - whenever an object is built, we cache it for lightning fast returns on future requests
        this.cacheBuilt(built);
        return built;
    }

    // v5 - let every injector between this and the owning injector know that this
    // entry has been assigned once and for all
    private cacheBuilt<T>(built: Built<T>): void {
        if (!this.cache.has(built.key)) {
            this.cache.set(built.key, built);
            if (this !== built.owner) {
                this.parent?.cacheBuilt(built);
            }
        }
    }

    private maxRank(other: Injector): Injector {
        return this.rank > other.rank ? this : other;
    }
}

export function inject<T>(key: InjectKey<T>): T {
    return Injector.inject(key);
}

export function newInjector(provides?: Provide[], parent?: Injector) {
    return new Injector(provides, parent);
}
