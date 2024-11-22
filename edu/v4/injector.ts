/*
v4

A _correct_ injector.
This version fills the gaps in the last injector and properly respects
interrelated provides from injectors throughout the hierarchy

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
    explicitly?: true;
    value?: T;
    deps?: Built[];
};
type Built<T = unknown> = Entry<T> & {
    value: T;
    deps: Built[];
};
function isBuilt<T>(entry: Entry<T>): entry is Built<T> {
    return typeof entry.deps !== "undefined"; // more resilient to minification
}

class Injector {
    // v4 - allows for piggy backing on the call stack to track what is being built
    private static buildingProvide: Built | undefined = undefined;

    private entries = new Map<InjectKey, Entry>();
    private rank: number; // allows quick comparison of injectors in a hierarchy at minimal cost

    constructor(provides: Provide[] = [], private parent?: Injector) {
        for (const provide of provides) {
            this.entries.set(provide.key, {
                ...provide,
                owner: this,
            });
        }
        this.rank = this.parent ? this.parent.rank + 1 : 0; // simple to calculate at construction
    }

    public get<T>(key: InjectKey<T>): T {
        const prevInjector = activeInjector;
        activeInjector = this;
        try {
            return this.getInContext(key);
        } finally {
            activeInjector = prevInjector;
        }
    }

    private getInContext<T>(key: InjectKey<T>): T {
        const built = this.getBuilt(key);
        if (Injector.buildingProvide) {
            Injector.buildingProvide.deps.push(built);
            // v4 - piggy backing on the stack some more, update each entries owner based on who owns their child
            Injector.buildingProvide.owner = built.owner.maxRank(
                Injector.buildingProvide.owner,
            );
        }
        return built.value as T;
    }

    private getBuilt<T>(key: InjectKey<T>): Built<T> {
        const entry = this.getEntry(key)!;
        if (isBuilt(entry) && !this.needsRebuild(entry, entry.owner.rank)) {
            return entry;
        }
        return this.build(entry);
    }

    // v4 - in cases where a parent injector build record is being used, we need to check
    // for overshadowing provides in higher ranked injectors to determine if a new copy
    // of the requested object is needed to safely store in the higher injector with
    // correct, provided dependencies
    private needsRebuild(built: Built, firstRank: number): boolean {
        if (this.getEntry(built.key).owner.rank > firstRank) {
            return true;
        }

        return built.deps.some((dep) => this.needsRebuild(dep, firstRank));
    }

    private getEntry<T>(
        key: InjectKey<T>,
    ): Entry<T> {
        return this.entries.get(key) as Entry<T> ??
            this.parent?.getEntry(key) ?? {
            key,
            factory: () => new (key as Ctor<T>)(),
            owner: this,
        };
    }

    // v4 - taking advantage of the call stack, we can trace the edges of a class hierarchy mid build
    private build<T>(entry: Entry<T>): Built<T> {
        const built = { ...entry, deps: [] } as Built<T>;
        const prev = Injector.buildingProvide;
        Injector.buildingProvide = built;
        try {
            built.value = built.factory();
        } finally {
            Injector.buildingProvide = prev;
        }
        built.owner.entries.set(built.key, built);
        return built;
    }

    // v4 - simple comparison of injectors
    private maxRank(other: Injector): Injector {
        return this.rank > other.rank ? this : other;
    }
}

let activeInjector: Injector | undefined = undefined;
export function inject<T>(key: InjectKey<T>): T {
    if (!activeInjector) {
        throw new Error();
    }
    return activeInjector.get(key);
}

export function newInjector(provides?: Provide[], parent?: Injector) {
    return new Injector(provides, parent);
}
