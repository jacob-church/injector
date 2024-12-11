import type { DummyFactory } from "../symbols/dummyfactory.ts";
import type { InjectKey } from "./injectkey.ts";

export type InjectionContext<T = unknown> = <Narrowed extends T>(
    fn: () => Narrowed,
) => Narrowed;

interface Dummy<T> {
    value: T;
    cleanup: () => void;
}

export type ContextInjectable<T = unknown> = InjectKey<T> & {
    [DummyFactory]: () => Dummy<T>;
};
