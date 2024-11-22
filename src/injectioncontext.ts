import {
    type ContextInjectable,
    type InjectionContext,
    Injector,
} from "./injector.ts";
import type { ConcreteUnion } from "./types/concreteunion.ts";

/**
 * Saves the active injection context into an object for creating injectable objects after a classes constructor has completed.
 * This method requires foreknowledge of the types that will be created outside of the constructor so it can correctly evaluate
 * the transitive dependencies of those types, and correctly assign the calling object to an injector for storage.
 *
 * @param types one or more InjectKeys that this injection context will be used to create
 * @returns a valid InjectionContext that can be used at any time
 *
 * Usage:
 * ```typescript
 * class B {
 *  public static [DummyFactory]() {
 *      value: new B();
 *      cleanup: () => {};
 *  }
 * }
 * class A {
 *  private context = getInjectionContext(B);
 *  public foo() {
 *   this.context.run(() => new B());
 *  }
 * }
 * ```
 */
export function getInjectionContext<
    Args extends [ContextInjectable, ...ContextInjectable[]],
>(...types: Args): InjectionContext<ConcreteUnion<Args>> {
    return Injector.getInjectionContext(...types);
}

/**
 * Saves the active injection context into an object for creating injectable objects after a classes constructor has completed.
 *
 * @returns a valid InjectionContext that can be used at any time
 *
 * Usage:
 * ```typescript
 * class B {}
 * class A {
 *  private context = getInjectionContext();
 *  public foo() {
 *   this.context.run(() => new B()); // transitive dependencies of B will not be considered, and may be stored in a different injector than A
 *  }
 * }
 * ```
 *
 * **WARNING:** this method can lead to storage errors if used incorrectly. Use with caution.
 */
export function getUnsafeInjectionContext(): InjectionContext {
    return Injector.getUnsafeInjectionContext();
}
