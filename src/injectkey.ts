import type { ProvideKey } from "./providekey.ts";

export type Structor<T> = new () => T;
// deno-lint-ignore ban-types
export type InjectKey<T = unknown> =
    | ProvideKey<T>
    | Structor<T>
    | Function & { prototype: T };
