/*
v3

A _robust_ injector.
This version allows us to create context specific injectors with provides that
take precedence over their "parent" injector

*/

class ProvideKey<T> {
    constructor(public readonly name: string) {}
}
export function key<T>(name: string) {
    return new ProvideKey<T>(name);
}

type Structor<T> = new () => T;
type InjectKey<T = unknown> = ProvideKey<T> | Structor<T>;

interface Provide<T = unknown> {
    key: InjectKey<T>;
    factory: () => T;
}

class Provider<T> {
    constructor(private readonly key: InjectKey<T>) {}

    public use(factory: () => T): Provide<T> {
        return {
            key: this.key,
            factory,
        };
    }
    // value    {key: K, factory: () => <instance of K>}
    // factory  {key: K, factory: () => new K()}
    // existing {key: K, factory: () => inject(K_)}
}
export function provide<T>(key: InjectKey<T>): Provider<T> {
    return new Provider(key);
}

type Provided<T = unknown> = Provide<T> & {
    explicitly?: true;
    value?: T;
    built?: true;
};
type Built<T = unknown> = Provided<T> & {
    value: T;
    built: true;
};
function isBuilt<T>(provide: Provided<T>): provide is Built<T> {
    return typeof provide.built !== "undefined";
}

class Injector {
    private provides = new Map<InjectKey, Provided>();

    constructor(provides: Provide[] = [], private parent?: Injector) {
        for (const provide of provides) {
            this.provides.set(provide.key, {
                ...provide,
                explicitly: true,
            });
        }
    }

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
        const provide = this.getOrBuild(key);
        return provide.value as T;
    }

    private getOrBuild<T>(key: InjectKey<T>): Built<T> {
        const provide = this.getProvide(key);
        if (isBuilt(provide)) {
            return provide;
        }
        provide.value = provide.factory();
        this.provides.set(provide.key, provide);
        return provide as Built<T>;
    }

    private getProvide<T>(
        key: InjectKey<T>,
    ): Provided<T> {
        const provide = this.provides.get(key);
        if (provide) {
            return provide as Provided<T>;
        }
        if (this.parent) {
            return this.parent.getProvide(key);
        }
        return {
            key,
            factory: () => new (key as Structor<T>)(),
        };
    }
}

let activeInjector: Injector | undefined = undefined;
export function inject<T>(key: InjectKey<T>): T {
    if (!activeInjector) {
        throw new Error();
    }
    return activeInjector.get(key);
}

export function newInjector(provides?: Provide[], parent?: Injector) {
    return new Injector(provides, parent);
}
