import type { InjectKey, NoArgsCtor } from "./types/injectkey.ts";
import { inject } from "./inject.ts";
import type { Provide } from "./types/provide.ts";

/**
 * Quality of life function for generating `Provide` objects to configure an
 * injector.
 *
 * @param key an injectable type `T` or `ProvideKey<T>`
 * @returns `Provider<T>`
 *
 * Usage:
 * ```typescript
 * // default
 * provide(A).use(() => new A());
 * // factory (same as default)
 * provide(A).useFactory(() => new A());
 * // value
 * const a = new A();
 * provide(A).useValue(a);
 * // re-key (type substitutions)
 * provide(A).useExisting(MockA)
 * ```
 */
export function provide<T>(key: InjectKey<T>): Provider<T> {
    return new Provider(key);
}

/**
 * Quality of life function for "pinning" a concrete type to an injector,
 * preventing a parent injector from assuming ownership of the built object.
 *
 * @param key a constructor with no arguments
 *
 * Usage:
 * ```typescript
 * class A {}
 * const parent = newInjector();
 * const child = parent.child([explicitly(A)]);
 * child.get(A); // stored in child, not parent
 * ```
 */
export function explicitly<T>(key: NoArgsCtor<T>): Provide<T> {
    return {
        key,
        factory: () => new key(),
    };
}

export class Provider<T> {
    constructor(private readonly key: InjectKey<T>) {}

    /**
     * General purpose function provide function
     */
    public use(factory: () => T): Provide<T> {
        return {
            key: this.key,
            factory,
        };
    }
    /**
     * For providing an already constructed object, primitive value, or optional value
     */
    public useValue(value: T): Provide<T> {
        return {
            key: this.key,
            factory: () => value,
        };
    }
    /**
     * Functionally equivalent to `.use`, semantically clearer
     */
    public useFactory(factory: () => T): Provide<T> {
        return this.use(factory);
    }
    /**
     * Re-keys to a secondary key (e.g. A -> MockA)
     * (Equivalent to making a separate request to the same injector for the second key)
     *
     * @param key a concrete type
     */
    public useExisting(key: InjectKey<T>): Provide<T> {
        return {
            key: this.key,
            factory: () => inject(key),
        };
    }
    /**
     * UNTESTED; though it will probably work, it will almost certainly record dependencies
     * that it shouldn't; could the `existingFactory` be run within some kind of "dead zone"
     * where dependency recording is turned off? Then, only the subsequent `inject` is recorded
     * as usual? Can the "returning null removes this provider" behavior be implemented without
     * significant restructuring? Such as, perhaps returning a `noValue` or similar to the
     * injector internals as a signal to do the expected behavior? What should the class
     * calling `inject` expect in that case?
     */
    public useExistingFactory(existingFactory: () => InjectKey<T>): Provide<T> {
        return {
            key: this.key,
            factory: () => inject(existingFactory()),
        };
    }
}
