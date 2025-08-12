import type {
    ImplicitlyAvailable,
    InjectKey,
    ProviderRequired,
} from "./types/injectkey.ts";
import { Injector } from "./injector.ts";
/**
 * When used within an active injection context (under a `.get` on a real injector) returns a singleton of the requested type from the active injection context
 *
 * @param key an injectable type (class type or `ProvideKey`)
 * @returns a singleton of type `T`
 *
 * Usage:
 * ```typescript
 * class A {
 *  private b = inject(B);
 * }
 * class B {}
 * ```
 */
export function inject<T>(key: ImplicitlyAvailable<T>): T {
    return Injector.inject(key);
}

/**
 * As {@link inject}, but if the injected key is not provided, returns `undefined` instead.
 * Only for `ProvideKey`'s, abstract classes, and classes that require arguments for construction.
 *
 * @param key an injectable type (`ProvideKey`, abstract class, or class with constructor args)
 * @returns a singleton type `T` or `undefined
 *
 * Usage:
 * ```typescript
 * const NumKey = key<number>("NumKey");
 * class A {
 *  private num?: number = injectOptional(NumKey);
 * }
 * ```
 */
export function injectOptional<T>(key: ProviderRequired<T>): T | undefined {
    if (Injector.has(key)) {
        return Injector.inject(key);
    }
    return undefined;
}

/**
 * As {@link inject}, but if the injected key is not provided, an error will be propogated.
 * A stronger version of {@link injectOptional} from uncertain dependencies that are required
 * for full functionality.
 *
 * @param key an injectable type (`ProvideKey`, abstract class, or class with constructor args)
 * @returns a singleton type `T`
 *
 * Usage:
 * ```typescript
 * const NumKey = key<number>("NumKey");
 * class A {
 *  private num: number = injectOrThrow(NumKey);
 * }
 * ```
 */
export function injectOrThrow<T>(key: ProviderRequired<T>): T {
    return Injector.inject(key);
}

/**
 * @deprecated
 * @package for internal use only
 * An {@link inject} method that can be used indiscriminately with all injectable types
 */
export function internalInject<T>(key: InjectKey<T>): T {
    return Injector.inject(key);
}
