import type { InjectKey } from "./injectkey.ts";

export interface Provide<T = unknown> {
    key: InjectKey<T>;
    factory: () => T;
}
