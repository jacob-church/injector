import type { ProvideKey } from "./providekey.ts";

// deno-lint-ignore no-explicit-any
export type Ctor<T> = new (...args: any[]) => T;
export type NoArgsCtor<T> = new () => T;
export type AbstractCtor<T> = abstract new () => T;
export type InjectKey<T = unknown> =
    | ProvideKey<T>
    | Ctor<T>
    | AbstractCtor<T>;
export type ConcreteInjectKey<T = unknown> = ProvideKey<T> | Ctor<T>;

export type ProviderRequired = ProvideKey<unknown> | AbstractCtor<unknown>;
