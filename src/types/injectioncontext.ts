import type { InjectKey } from "./injectkey.ts";

// deno-lint-ignore no-explicit-any
export type InjectionContext<T = any> = <Narrowed extends T>(
    fn: () => Narrowed,
) => Narrowed;

/**
 * A symbol for marking a class as eligible for serving with `getInjectionContext`
 */
export const DummyFactory = Symbol("DummyFactory");

interface Dummy<T> {
    value: T;
    cleanup: () => void;
}

export type ContextInjectable<T = unknown> = InjectKey<T> & {
    [DummyFactory]: () => Dummy<T>;
};
