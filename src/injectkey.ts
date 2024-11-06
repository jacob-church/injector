import type { ProvideKey } from "./providekey.ts";

export type Structor<T> = new () => T;
export type InjectKey<T = unknown> =
    | ProvideKey<T>
    | Structor<T>
    // deno-lint-ignore ban-types
    | Function & { prototype: T };
