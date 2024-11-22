/*
v1

The simplest "cool" feature an injector offers: managed singletons.
This injector makes sure that no singleton is ever created more than once.
*/

type Ctor<T> = new () => T;
type InjectKey<T = unknown> = Ctor<T>;

class Injector {
    // v1 - simple lazy caching
    private entries = new Map<InjectKey, unknown>();

    public get<T>(key: InjectKey<T>): T {
        const prev = activeInjector;
        activeInjector = this;
        try {
            return this.getInContext(key);
        } finally {
            activeInjector = prev;
        }
    }

    // v1 - simple lazy caching
    private getInContext<T>(key: InjectKey<T>): T {
        if (!this.entries.has(key)) {
            this.entries.set(key, new key());
        }
        return this.entries.get(key) as T;
    }
}

let activeInjector: Injector | undefined = undefined;
export function inject<T>(key: InjectKey<T>): T {
    if (!activeInjector) {
        throw new Error();
    }
    return activeInjector.get(key);
}

export function newInjector() {
    return new Injector();
}
