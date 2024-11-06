/**
 * v0 - the interface
 *
 * An injector begins with its interface.
 *
 * `inject` <= the magic function that gives you everything you wish for
 * `injector.get` <= `inject`s less-attractive true self
 */

let activeInjector: Injector | undefined = undefined;
export function inject<T>(key: InjectKey<T>): T {
    // TODO
    return undefined as T;
}

type InjectKey<T = unknown> = Structor<T>;
type Structor<T> = new () => T;

class Injector {
    public get<T>(key: InjectKey<T>): T {
        // TODO
        return undefined as T;
    }
}
