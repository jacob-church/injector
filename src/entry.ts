import type { Provide } from "./provide.ts";

export type Entry<T = unknown> = Provide<T> & {
    explicit?: true;
    value?: T;
    deps?: BuiltEntry[];
};

export type BuiltEntry<T = unknown> = Provide<T> & {
    value: T;
    deps: BuiltEntry[];
};
export function isBuilt<T>(entry: Entry<T>): entry is BuiltEntry<T> {
    return typeof entry.deps !== "undefined";
}
