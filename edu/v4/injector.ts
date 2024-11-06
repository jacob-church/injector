/*
v4

A _correct_ injector.
This version fills the gaps in the last injector and properly respects
interrelated provides from injectors throughout the hierarchy

*/

import { dfs } from "../../src/dfs/dfs.ts";

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
    private static buildingProvide: Built | undefined = undefined;

    private provides = new Map<InjectKey, Provided>();
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
        const prevInjector = activeInjector;
        activeInjector = this;
        try {
            return this.getInContext(key);
        } finally {
            activeInjector = prevInjector;
        }
    }

    private getInContext<T>(key: InjectKey<T>): T {
        const built = this.getOrBuild(key);
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
            return provide;
        }
        return this.buildAndStore(provide);
    }

    private getProvide<T>(
        key: InjectKey<T>,
    ): Provided<T> | undefined {
        const provide = this.provides.get(key);
        if (provide) {
            return provide as Provided<T>;
        }
        if (this.parent) {
            return this.parent.getProvide(key);
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
        dfs(provide.deps, (dep: Built) => {
            if (visited.has(dep)) {
                return [];
            }
            visited.add(dep);

            const highestProvide = this.getProvide(dep.key);
            if (highestProvide) {
                holder = holder.maxRank(highestProvide.holder);
            }
            if (holder == this) {
                return "stop";
            }
            return dep.deps;
        });

        return holder;
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
        return built;
    }

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
