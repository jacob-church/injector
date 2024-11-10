import type { ConcreteInjectKey, InjectKey } from "./injectkey.ts";
import { inject } from "./injector.ts";
import type { Provide } from "./provide.ts";

export class Provider<T> {
    constructor(private readonly key: InjectKey<T>) {}

    /**
     * General purpose function
     */
    public use(factory: () => T): Provide<T> {
        return {
            key: this.key,
            factory,
        };
    }
    /**
     * For providing an already constructed object, primitive value, or optional value (not yet implemented)
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
     * (NOTE: as TypeScript/JavaScript do not currently provide a way to validate that a given type/constructor is abstract at runtime, this function does not allow re-keying to another abstract type, as this can easily lead to constructing an abstract class unintentionally)
     */
    public useExisting(key: ConcreteInjectKey<T>): Provide<T> {
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

/**
 * Quality of life function for generating `Provide` objects to configure an
 * injector.
 *
 * @param key an injectable type `T` or `ProvideKey<T>`
 * @returns `Provider<T>`
 *
 * Usage:
 * ```
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
