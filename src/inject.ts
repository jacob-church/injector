import type { InjectKey } from "./types/injectkey.ts";
import { MissingProvideError } from "./injecterror.ts";
import type { ProvideKey } from "./providekey.ts";
import { Injector } from "./injector.ts";
/**
 * When used within an active injection context (under a `.get` on a real injector) returns a singleton of type T from the active injection context
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
export function inject<T>(key: InjectKey<T>): T {
    return Injector.inject(key);
}

/**
 * As `inject`, but if the injected key is not provided, returns `undefined` instead. Only for `ProvideKey`s
 *
 * @param key `ProvideKey<T>`
 * @returns a singleton type `T` or `undefined`
 *
 * Usage:
 * ```typescript
 * const NumKey = key<number>("NumKey");
 * class A {
 *  private num = injectOptional(NumKey);
 * }
 * ```
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
