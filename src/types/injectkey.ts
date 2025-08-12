import type { ProvideKey } from "../providekey.ts";
import type { InjectFactory } from "../symbols/injectfactory.ts";
import type { NoImplicitInject } from "../symbols/noimplicitinject.ts";

// deno-lint-ignore no-explicit-any
export type Ctor<T> = new (...args: any[]) => T;

export type NoArgsCtor<T> = new () => T;

// deno-lint-ignore no-explicit-any
export type AbstractCtor<T> = (abstract new (...args: any[]) => T) & {
    [NoImplicitInject]: true;
};

export type InjectKey<T = unknown> = AbstractCtor<T> | Ctor<T> | ProvideKey<T>;

export type ImplicitlyAvailable<T = unknown> =
    | NoArgsCtor<T>
    | (Ctor<T> & { [InjectFactory](): T });

export type ProviderRequired<T = unknown> =
    | ProvideKey<T>
    | AbstractCtor<T>
    | (ImplicitlyAvailable<T> & { [NoImplicitInject]: true });
