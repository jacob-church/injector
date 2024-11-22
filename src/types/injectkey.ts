import type { ProvideKey } from "../providekey.ts";

// deno-lint-ignore no-explicit-any
export type Ctor<T> = new (...args: any[]) => T;
export type NoArgsCtor<T> = new () => T;
// deno-lint-ignore no-explicit-any
export type AbstractCtor<T> = abstract new (...args: any[]) => T;
export type InjectKey<T = unknown> =
    | Ctor<T>
    | AbstractCtor<T>
    | ProvideKey<T>;
export type ConcreteInjectKey<T = unknown> = Ctor<T> | ProvideKey<T>;

export type ProviderRequired<T = unknown> = ProvideKey<T> | AbstractCtor<T>;
