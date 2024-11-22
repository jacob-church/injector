/**
 * A symbol for marking a class to prevent injection without an explicit provider.
 *
 * Required by the type checker for abstract base classes.
 *
 * Usage:
 * ```typescript
 * class A {
 *  public static readonly [NoImplicitInject] = true;
 * }
 * injector.get(A); // now throws a `MissingProvideError`
 * ```
 */
export const NoImplicitInject = Symbol("NoImplicitInject");
