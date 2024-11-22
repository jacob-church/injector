import type { DummyFactory } from "../symbols/dummyfactory.ts";
import type { InjectKey } from "./injectkey.ts";

// deno-lint-ignore no-explicit-any
export type InjectionContext<T = any> = <Narrowed extends T>(
    fn: () => Narrowed,
) => Narrowed;

interface Dummy<T> {
    value: T;
    cleanup: () => void;
}

export type ContextInjectable<T = unknown> = InjectKey<T> & {
    [DummyFactory]: () => Dummy<T>;
};
