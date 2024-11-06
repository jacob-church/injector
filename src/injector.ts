import type { InjectKey, Structor } from "./injectkey.ts";
import type { Frame } from "./lib/dfs/dfs.ts";
import { dfs } from "./lib/dfs/dfs.ts";
import type { Provide } from "./provide.ts";

/**
 * As constrasted with "Provide", a Provided is what you get when you pass
 * a Provide into an Injector
 */
type Provided<T = unknown> = Provide<T> & {
    holder: Injector; // the Injector that holds this object
    explicitly?: true; // whether this object was passed externally to the Injector
    value?: T;
    deps?: Built[]; // a record of other types that injected while assigning `value`
};
type Built<T = unknown> = Provided<T> & {
    value: T;
    deps: Built[];
};
function isBuilt<T>(provide: Provided<T>): provide is Built<T> {
    return typeof provide.deps !== "undefined";
}

class Injector {
    // when defined, an active injection context
    private static context: Injector | undefined = undefined;
    /**
     * by defining this inside the injector, we can access getInContext and skip redefining
     * context, and gobbling up stack space
     */
    public static inject<T>(key: InjectKey<T>): T {
        if (!Injector.context) {
            throw new Error();
        }
        return Injector.context.getInContext(key);
    }
    // a provide that is currently being built, on the next stack frame up
    private static buildingProvide: Built | undefined = undefined;
    //////////////////////////////////////////////////////////////////////////
    // the provides stored in this injector
    private provides = new Map<InjectKey, Provided>();
    // super fast get of objects already built by this injector
    private cache = new Map<InjectKey, Built>();
    // a quick reference for comparing where two injectors sit within the same hierarchy
    private rank: number;
    //////////////////////////////////////////////////////////////////////////
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

    /**
     * Given a key
     * @returns a singleton of type T
     * The provide point into a valid injection context
     */
    public get<T>(key: InjectKey<T>): T {
        const prevInjector = Injector.context;
        Injector.context = this;
        try {
            return this.getInContext(key);
        } finally {
            Injector.context = prevInjector;
        }
    }
    //////////////////////////////////////////////////////////////////////////
    /**
     * The actual `get` implementation; assumes an active injection context
     */
    private getInContext<T>(key: InjectKey<T>): T {
        const built = this.cache.get(key) ?? this.getBuiltProvide(key);
        if (Injector.buildingProvide) {
            // whenever a key is requested, its essential to tie the dependency
            // to a higher stack frame if there is one, for correct homing of entries
            Injector.buildingProvide.deps.push(built);
            Injector.buildingProvide.holder = built.holder.maxRank(
                Injector.buildingProvide.holder,
            );
        }
        return built.value as T;
    }

    /**
     * Fetches the most relevant provide and ensures it is ready to serve
     * (Assumes this key is not cached)
     */
    private getBuiltProvide<T>(key: InjectKey<T>): Built<T> {
        const provide = this.getProvide(key);
        if (
            isBuilt(provide) &&
            provide.holder == this.findHolder(provide)
        ) {
            this.cacheProvide(provide);
            return provide;
        }
        return this.buildAndCache(provide);
    }

    /**
     * Find the childmost provide for the given key; if none is found
     * an implicit provide is generated for the parent-most injector
     *
     * @param backstop optionally specify a boundary injector;
     * if a Provided has not been found before reaching this backstop,
     * return `undefined` instead
     */
    private getProvide<T>(key: InjectKey<T>): Provided<T>;
    private getProvide<T>(
        key: InjectKey<T>,
        backstop: Injector | undefined,
    ): Provided<T> | undefined;
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

    /**
     * Given a BuiltProvide, determines conclusively which injector
     * should hold that provide
     */
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

            const highest = this.getProvide(
                dep.key,
                holder,
            );
            if (highest?.explicitly && !isBuilt(highest)) {
                this._buildStack([highest, prev]);
            }
            if (highest) {
                holder = holder.maxRank(highest.holder);
            }
            if (holder == this) {
                // finalInjector can't get any higher, so get it over with
                this._buildStack([dep, prev]);
                return "stop";
            }
            return dep.deps;
        });
        return holder;
    }

    /**
     * ONLY FOR USE IN `findHomeInjector`
     * Using the `Frame` type provided with `dfs`, eagerly builds up a dependency branch
     * to ensure that we avoid wasteful calls to findHomeInjector in the future
     *
     * In combination with our `cache`, helps us skip calling `getBuiltProvide` altogether
     * after we've already determined that certain builds will be necessary
     */
    private _buildStack(frame: Frame<Provided> | undefined) {
        if (!frame) {
            return;
        }
        const [provide, prev] = frame;
        if (this.cache.has(provide.key)) {
            return;
        }
        this.buildAndCache(provide);
        this._buildStack(prev);
    }

    /**
     * Given a Provided, takes the necessary steps to finalize that provide and cache it appropriately
     */
    private buildAndCache<T>(provide: Provided<T>): Built<T> {
        const built = { ...provide, deps: [] } as Built<T>;
        const prevBuildingProvide = Injector.buildingProvide;
        Injector.buildingProvide = built;
        try {
            built.value = built.factory();
        } finally {
            Injector.buildingProvide = prevBuildingProvide;
        }
        built.holder.provides.set(built.key, built); // overwrite in holder injector with the BuiltProvide
        this.cacheProvide(built);
        return built;
    }

    /**
     * Let every injector between this and provide.home (inclusive)
     * know that the given provide has been built and settled
     */
    private cacheProvide<T>(provide: Built<T>): void {
        if (!this.cache.has(provide.key)) {
            this.cache.set(provide.key, provide);
            if (this !== provide.holder) {
                this.parent?.cacheProvide(provide);
            }
        }
    }

    /**
     * @returns the childmost injector (the injector of highest rank)
     */
    private maxRank(other: Injector): Injector {
        return this.rank > other.rank ? this : other;
    }
}

/**
 * When used within an active injection context (under a `.get` on a real injector)
 * @returns a singleton of type T from the active injection context
 */
export function inject<T>(key: InjectKey<T>): T {
    return Injector.inject(key);
}

/**
 * Setup an injector
 */
export function newInjector(provides?: Provide[], parent?: Injector) {
    return new Injector(provides, parent);
}