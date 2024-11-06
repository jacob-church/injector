export class ProvideKey<T> {
    declare private compileType: T;
    constructor(public readonly id?: string) {}
}

/**
 * An injectable token for providing optional injectables (not yet implemented)
 * or non-constructable types (e.g. primitives)
 *
 * @param id (optional) an identifier for this key (mostly for debugging purposes)
 * @returns a `ProvideKey<T>` suitable for passing to `inject`
 *
 * Usage:
 * ```
 * const AKey = key<A>('A');
 * ```
 * Note that `'A'` is not strictly necessary, but explicitly stating the type <A>
 * is necessary for the type checker to correctly evaluate `inject(AKey)`
 */
export function key<T>(id?: string): ProvideKey<T> {
    return new ProvideKey<T>(id);
}
