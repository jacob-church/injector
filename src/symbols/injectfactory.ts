/**
 * A symbol for marking that depends on constructor arguments with a default factory function.
 *
 * Usage:
 * ```typescript
 * class A {
 *  public static readonly [InjectFactory]() {
 *    return new A("default");
 *  }
 *
 *  constructor(private value: string) {}
 * }
 *
 * ```
 */
export const InjectFactory = Symbol("InjectFactory");
