/**
 * v0 - the interface
 *
 * An injector begins with its interface.
 *
 * `inject` <= the magic function that gives you everything you wish for
 * `injector.get` <= `inject`s less-attractive true self
 */

// v0 - simple injection withing a construction context; only works when
// active injector is primed
export function inject<T>(key: InjectKey<T>): T {
    if (!activeInjector) {
        throw new Error();
    }
    return activeInjector.get(key);
}
let activeInjector: Injector | undefined = undefined;

type InjectKey<T = unknown> = Ctor<T>;
type Ctor<T> = new () => T; // simple constructables

class Injector {
    // v0 - .get is a thin wrapper that primes activeInjector to work within subsequent calls
    // to `inject`
    public get<T>(key: InjectKey<T>): T {
        const prev = activeInjector;
        activeInjector = this;
        try {
            return this.getInContext(key);
        } finally {
            activeInjector = prev;
        }
    }

    private getInContext<T>(key: InjectKey<T>): T {
        // TODO
        return undefined as T;
    }
}
