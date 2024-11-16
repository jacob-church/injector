import type { Ctor, InjectKey } from "./injectkey.ts";
import type { Provide } from "./provide.ts";
import {
    InjectError,
    InjectionStack,
    InjectorError,
    MissingProvideError,
    TooManyArgsError,
} from "./injecterror.ts";
import { ProvideKey } from "./providekey.ts";

/**
 * When used within an active injection context (under a `.get` on a real injector) returns a singleton of type T from the active injection context
 *
 * @param key an injectable type (class type or `ProvideKey`)
 * @returns a singleton of type `T`
 */
export function inject<T>(key: InjectKey<T>): T {
    return Injector.inject(key);
}

/**
 * As `inject`, but if the injected key is not provided, returns `undefined` instead. Only for `ProvideKey`s
 *
 * @param key `ProvideKey<T>`
 * @returns a singleton type `T` or `undefined`
 */
export function injectOptional<T>(key: ProvideKey<T>): T | undefined {
    try {
        return inject(key);
    } catch (error) {
        if (error instanceof MissingProvideError) {
            return undefined;
        }
        // any other kind of error should be dealt with by the developer
    }
}

/**
 * Setup an injector
 *
 * @param provides (optional) a list of `Provide`
 * @param parent (optional) another injector to defer to when this injector is not specifically configured to handle a requested type
 *
 * @returns a configured Injector
 */
export function newInjector(provides?: Provide[], parent?: Injector): Injector {
    return new Injector(provides, parent);
}

interface InjectionContext {
    run: <T>(fn: () => T) => T;
}
/**
 * Saves the active injection context into an object for creating injectable objects after a classes constructor has completed.
 *
 * @returns a valid InjectionContext that can be used at any time
 */
export function getInjectionContext(): InjectionContext {
    return Injector.getInjectionContext();
}

/**
 * As constrasted with "Provide", a Provided is what you get when you pass
 * a Provide into an Injector
 */
type Provided<T = unknown> = Provide<T> & {
    holder: Injector; // the Injector that holds this object
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
    // STATIC ////////////////////////////////////////////////////////////////
    // when defined, an active injection context
    private static context: Injector | undefined = undefined;
    /**
     * By defining this inside the injector, we can keep `context` safe from
     * meddling, and we can access `getInContext` to skip redefining context, gobbling up stack space
     */
    public static inject<T>(key: InjectKey<T>): T {
        if (!Injector.context) {
            throw new Error(
                "No active injection context. Create an injector with `newInjector`.",
            );
        }
        return Injector.context.getInContext(key);
    }
    /**
     * see `inject`
     */
    public static getInjectionContext(): InjectionContext {
        if (!Injector.context) {
            throw new Error(
                "No active injection context. Create an injector with `newInjector`.",
            );
        }
        const context = Injector.context;
        return {
            run: (fn) => {
                const prevContext = Injector.context;
                Injector.context = context;
                try {
                    return fn();
                } finally {
                    Injector.context = prevContext;
                }
            },
        };
    }
    // a provide that is currently being built, on the next stack frame up
    private static buildingProvide: Built | undefined = undefined;
    // MEMBERS ///////////////////////////////////////////////////////////////
    // the provides stored in this injector
    private provides = new Map<InjectKey, Provided>();
    // super fast get of objects already built by this injector
    private cache = new Map<InjectKey, Built>();
    // a quick reference for comparing where two injectors sit within the same hierarchy
    private rank: number;
    // PUBLIC ////////////////////////////////////////////////////////////////
    constructor(provides: Provide[] = [], private parent?: Injector) {
        provides.map((p) => this.setLocalProvide(p));
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
    // PRIVATE ///////////////////////////////////////////////////////////////
    /**
     * Copies the minimum necessary information from a Provide into this injector,
     * marks that provide as held by this injector
     */
    private setLocalProvide(provide: Provide): void {
        this.provides.set(provide.key, {
            key: provide.key,
            factory: provide.factory,
            holder: this,
        });
    }

    /**
     * The actual `get` implementation; assumes an active injection context
     */
    private getInContext<T>(key: InjectKey<T>): T {
        InjectionStack.push(key);
        try {
            const built = this.cache.get(key) ?? this.getOrBuild(key);
            if (Injector.buildingProvide) {
                // whenever a key is requested, its essential to tie the dependency
                // to a higher stack frame if there is one, for correct storage of entries
                Injector.buildingProvide.deps.push(built);
                Injector.buildingProvide.holder = built.holder.maxRank(
                    Injector.buildingProvide.holder,
                );
            }
            return built.value as T;
        } finally {
            InjectionStack.pop();
        }
    }

    /**
     * Fetches the most relevant provide and ensures it is ready to serve
     * (Assumes this key is not cached)
     */
    private getOrBuild<T>(key: InjectKey<T>): Built<T> {
        const provide = this.getProvide(key);
        if (isBuilt(provide) && !this.needsRebuild(provide)) {
            return provide;
        }
        return this.buildAndStore(provide);
    }

    /**
     * Find the childmost provide for the given key; if none is found
     * an implicit provide is generated for the parent-most injector
     *
     * @param backstop optionally specify a boundary injector;
     * if a Provided has not been found before reaching this backstop,
     * return `undefined` instead (optimized for needsRebuild check)
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
        const provide = this.provides.get(key);
        if (provide) {
            return provide as Provided<T>;
        }
        if (this == backstop) {
            return undefined;
        }
        if (this.parent) {
            return this.parent.getProvide(key, backstop);
        }
        if (key instanceof ProvideKey) {
            throw new MissingProvideError(key);
        }
        if (key.length > 0) {
            throw new TooManyArgsError(key);
        }
        return {
            key,
            factory: () => new (key as Ctor<T>)(),
            holder: this,
        };
    }

    /**
     * Given a provide, determine if it needs to be rebuilt in the current context
     */
    private needsRebuild(provide: Built): boolean {
        return !!this.getFirstOverridingInjector(provide, provide.holder)[0];
    }

    /**
     * Finds the first injector, if any, that overrides any provide in the
     * given dependency tree (recursive over transitive dependencies)
     *
     * For optimization purposes, this method will also mutate .cache and
     * .provides to speedup future lookups
     */
    private getFirstOverridingInjector(
        provide: Built,
        currHolder: Injector,
        visited: Set<InjectKey> = new Set(),
    ): [Injector | undefined, boolean] {
        if (visited.has(provide.key)) {
            return [undefined, false];
        }
        visited.add(provide.key);

        // Step 1. check for overriding provide
        const depProvide = this.cache.get(provide.key) ??
            this.getProvide(provide.key, currHolder);
        if (depProvide && depProvide.holder.rank > currHolder.rank) {
            // any provider that is higher in the hierarchy than the provider
            // we kicked this off with is an indication rebuilding is necessary
            return [depProvide.holder, false];
        } else if (this.cache.has(provide.key)) {
            // cached keys are already assigned fully by this injector, so continuing is not needed
            return [undefined, false];
        }

        // Step 2. recurse
        for (const dep of provide.deps) {
            const [overrideInjector, overwriteProvide] = this
                .getFirstOverridingInjector(dep, currHolder, visited);
            if (overrideInjector) {
                // "copying" the dep into the relevant injector, unbuilt, guarantees we can skip
                // wasteful calls to this needsRebuild in the future
                overwriteProvide && overrideInjector.setLocalProvide(dep);
                return [overrideInjector, true];
            }
        }

        // Step 3. reaching this point indicates no overriding provide was found, so we've
        // effectively determined "needRebuild" for this provide as well
        this.cacheBuilt(provide);
        return [undefined, false];
    }

    /**
     * Given a Provided, takes the necessary steps to finalize that provide and cache it appropriately
     */
    private buildAndStore<T>(provide: Provided<T>): Built<T> {
        const built = { ...provide, deps: [] } as Built<T>;
        const prevBuildingProvide = Injector.buildingProvide;
        Injector.buildingProvide = built;
        try {
            built.value = built.factory();
        } catch (e) {
            if (e instanceof InjectorError) {
                throw e; // let these bubble up; we only wrap the error in a stack trace once
            } else {
                throw new InjectError(e as Error);
            }
        } finally {
            Injector.buildingProvide = prevBuildingProvide;
        }
        built.holder.provides.set(built.key, built); // overwrite in holder injector with the Built provide
        this.cacheBuilt(built);
        return built;
    }

    /**
     * Let every injector between this and provide.holder (inclusive)
     * know that the given provide has been built and assigned
     */
    private cacheBuilt<T>(provide: Built<T>): void {
        if (!this.cache.has(provide.key)) {
            this.cache.set(provide.key, provide);
            if (this !== provide.holder) {
                this.parent?.cacheBuilt(provide);
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
