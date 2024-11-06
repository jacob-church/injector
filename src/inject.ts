import type { InjectKey } from "./injectkey.ts";
import { ActiveInjector } from "./injector.ts";

/**
 * When invoked in an active injection context, returns
 * a singleton of the requested type T
 *
 * TODO: investigate - can this be written in such a way as
 * to skip invoking `.get` and to go directly to `.getInternal`?
 * at the very least, the call stack would be tidier and we
 * would avoid overwriting ActiveInjector much at all.
 * Perhaps a `public static inject()` function on the Injector itself
 * that's wrapped here. Though I liked having the Injector class itself
 * not be exported
 */
export function inject<T>(key: InjectKey<T>): T {
    if (!ActiveInjector) {
        throw Error("No active injector");
    }
    return ActiveInjector.get(key);
}
