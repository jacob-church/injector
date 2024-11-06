import { inject } from "./inject.ts";
import type { InjectKey } from "./injectkey.ts";
import type { Provide } from "./provide.ts";

class Provider<T> {
    constructor(private readonly key: InjectKey<T>) {}

    public use(factory: () => T): Provide<T> {
        return {
            key: this.key,
            factory,
        };
    }
    public useValue(value: T): Provide<T> {
        return {
            key: this.key,
            factory: () => value,
        };
    }
    public useFactory(factory: () => T): Provide<T> {
        return this.use(factory);
    }
    public useExisting(key: InjectKey<T>): Provide<T> {
        return {
            key: this.key,
            factory: () => inject(key),
        };
    }
    /**
     * UNTESTED; though it will probably work, it will almost certainly record dependencies
     * that it shouldn't; could the `existingFactory` be run within some kind of "dead zone"
     * where dependency recording is turned off? Then, only the subsequent `inject` is recorded
     * as usual? Can the "returning null removes this provider" behavior be implemented without
     * significant restructuring? Such as, perhaps returning a `noValue` or similar to the
     * injector internals as a signal to do the expected behavior? What should the class
     * calling `inject` expect in that case?
     */
    public useExistingFactory(existingFactory: () => InjectKey<T>): Provide<T> {
        return {
            key: this.key,
            factory: () => inject(existingFactory()),
        };
    }
}
export function provide<T>(key: InjectKey<T>): Provider<T> {
    return new Provider(key);
}
