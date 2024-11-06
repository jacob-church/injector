/*
v1

The simplest "cool" feature an injector offers: managed singletons.
This injector makes sure that no singleton is ever created more than once.
*/

type Structor<T> = new () => T;
type InjectKey<T = unknown> = Structor<T>;

class Injector {
    private provides = new Map<InjectKey, unknown>();

    public get<T>(key: InjectKey<T>): T {
        const prevInjector = activeInjector;
        activeInjector = this;
        try {
            return this.getInContext(key);
        } finally {
            activeInjector = prevInjector;
        }
    }

    private getInContext<T>(key: InjectKey<T>): T {
        if (!this.provides.has(key)) {
            this.provides.set(key, new key());
        }
        return this.provides.get(key) as T;
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
