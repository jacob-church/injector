/*
v1

The simplest "cool" feature an injector offers: managed singletons.
This injector makes sure that no singleton is ever created more than once.
*/

type InjectKey<T = unknown> = (new () => T)

class Injector {
    private entries = new Map<InjectKey, unknown>();

    public get<T>(key: InjectKey<T>): T {
        const prevInjector = currentInjector;
        currentInjector = this;
        try {
            return this.getInternal(key);
        } finally {
            currentInjector = prevInjector;
        }
    }

    public getInternal<T>(key: InjectKey<T>): T {
        if (!this.entries.has(key)) {
            this.entries.set(key, new key());
        }
        return this.entries.get(key) as T;
    }
}

let currentInjector: Injector | undefined = undefined;
export function inject<T>(key: InjectKey<T>): T {
    if (!currentInjector) {
        throw Error('No active injector');
    }
    return currentInjector.get(key);
}

export function newInjector() {
    return new Injector();
}

