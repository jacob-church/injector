/**
 * An injectable token for providing optional injectables or non-constructable types (e.g. primitives)
 *
 * @param name an identifier for this key (for use in stack traces)
 * @returns a `ProvideKey<T>` suitable for passing to `inject`
 *
 * Usage:
 * ```
 * const AKey = key<A>('A');
 * ```
 * Note that `'A'` is not strictly necessary, but explicitly stating the type <A>
 * is necessary for the type checker to correctly evaluate `inject(AKey)`
 */
export function key<T>(name: string): ProvideKey<T> {
    return new ProvideKey<T>(name);
}

export class ProvideKey<T> {
    declare private compileType: T;
    constructor(public readonly name: string) {}
}
