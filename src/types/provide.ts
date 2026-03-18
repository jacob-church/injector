import type { ProvideKey } from "../providekey.ts";
import type { InjectKey } from "./injectkey.ts";

export interface BaseProvide<T = unknown> {
    key: InjectKey<T>;
    factory: () => T;
    multi?: never;
}

export interface MultiProvide<T = unknown> {
    key: ProvideKey<T[]>;
    factory: () => T; // the injector will aggregate
    multi: true;
}

export type Provide<T = unknown> = BaseProvide<T> | MultiProvide<T>;
