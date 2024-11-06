/*
v5

A _performant_ injector.
The previous version achieved correctness, but recomputes a few things more
than we would like. This version keeps better track of work that's already
been done, and agressively pursues optimal performance

*/

import { dfs, type Frame } from "../../dfs/dfs/dfs.ts";

class ProvideKey<T> {
    constructor(public readonly name: string) {}
}
export function key<T>(name: string) {
    return new ProvideKey<T>(name);
}

type Structor<T> = new () => T;
type InjectKey<T = unknown> = ProvideKey<T> | Structor<T>;

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

type Provided<T = unknown> = Provide<T> & {
    holder: Injector;
    explicitly?: true;
    value?: T;
    deps?: Built[];
};
type Built<T = unknown> = Provided<T> & {
    value: T;
    deps: Built[];
};
function isBuilt<T>(provide: Provided<T>): provide is Built<T> {
    return typeof provide.deps !== "undefined";
}

class Injector {
    private static context: Injector | undefined = undefined;
    public static inject<T>(key: InjectKey<T>): T {
        if (!Injector.context) {
            throw new Error();
        }
        return Injector.context.getInContext(key);
    }
    private static buildingProvide: Built | undefined = undefined;

    private provides = new Map<InjectKey, Provided>();
    private cache = new Map<InjectKey, Built>();
    private rank: number;
    constructor(provides: Provide[] = [], private parent?: Injector) {
        for (const provide of provides) {
            this.provides.set(provide.key, {
                ...provide,
                holder: this,
                explicitly: true,
            });
        }
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
        const built = this.cache.get(key) ?? this.getOrBuild(key);
        if (Injector.buildingProvide) {
            Injector.buildingProvide.deps.push(built);
            Injector.buildingProvide.holder = built.holder.maxRank(
                Injector.buildingProvide.holder,
            );
        }
        return built.value as T;
    }

    private getOrBuild<T>(key: InjectKey<T>): Built<T> {
        const provide = this.getProvide(key)!;
        if (
            isBuilt(provide) &&
            provide.holder == this.findHolder(provide)
        ) {
            this.cacheProvide(provide);
            return provide;
        }
        return this.buildAndStore(provide);
    }

    private getProvide<T>(
        key: InjectKey<T>,
        backstop?: Injector | undefined,
    ): Provided<T> | undefined {
        const provide = this.cache.get(key) ?? this.provides.get(key);
        if (provide) {
            return provide as Provided<T>;
        }
        if (this == backstop) {
            return undefined;
        }
        if (this.parent) {
            return this.parent.getProvide(key, backstop);
        }
        return {
            key,
            factory: () => new (key as Structor<T>)(),
            holder: this,
        };
    }

    private findHolder(provide: Built) {
        let holder = provide.holder;
        const visited = new Set<Provided>();
        dfs(provide.deps, (_, frame: Frame<Built>) => {
            const [dep, prev] = frame;
            if (visited.has(dep)) {
                return [];
            }
            visited.add(dep);

            const cached = this.cache.get(dep.key);
            if (cached) {
                holder = holder.maxRank(cached.holder);
                return [];
            }

            const highestProvide = this.getProvide(dep.key, holder);
            if (highestProvide) {
                if (highestProvide?.explicitly && !isBuilt(highestProvide)) {
                    this._buildStack([highestProvide, prev]);
                }
                holder = holder.maxRank(highestProvide.holder);
            }
            if (holder == this) {
                this._buildStack([dep, prev]);
                return "stop";
            }
            return dep.deps;
        });
        return holder;
    }

    private _buildStack(frame: Frame<Provided> | undefined) {
        if (!frame) {
            return;
        }
        const [provide, prev] = frame;
        if (this.cache.has(provide.key)) {
            return;
        }
        this.buildAndStore(provide);
        this._buildStack(prev);
    }

    private buildAndStore<T>(provide: Provided<T>): Built<T> {
        const built = { ...provide, deps: [] } as Built<T>;
        const prevBuildingProvide = Injector.buildingProvide;
        Injector.buildingProvide = built;
        try {
            built.value = built.factory();
        } finally {
            Injector.buildingProvide = prevBuildingProvide;
        }
        built.holder.provides.set(built.key, built);
        this.cacheProvide(built);
        return built;
    }

    private cacheProvide<T>(provide: Built<T>): void {
        if (!this.cache.has(provide.key)) {
            this.cache.set(provide.key, provide);
            if (this !== provide.holder) {
                this.parent?.cacheProvide(provide);
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
