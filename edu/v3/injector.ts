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

type Ctor<T> = new () => T;
type Abstract<T> = abstract new () => T;
type InjectKey<T = unknown> = ProvideKey<T> | Ctor<T> | Abstract<T>;

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

type Entry<T = unknown> = Provide<T> & {
    owner: Injector;
    value?: T;
};
type Built<T = unknown> = Entry<T> & {
    value: T;
};
function isBuilt<T>(provide: Entry<T>): provide is Built<T> {
    return "value" in provide;
}

class Injector {
    private entries = new Map<InjectKey, Entry>();

    constructor(provides: Provide[] = [], private parent?: Injector) {
        provides.forEach((p) => {
            this.entries.set(p.key, {
                ...p,
                owner: this,
            });
        });
    }

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
        const built = this.getBuilt(key);
        return built.value;
    }

    private getBuilt<T>(key: InjectKey<T>): Built<T> {
        const entry = this.getEntry(key);
        if (isBuilt(entry)) {
            return entry;
        }
        entry.value = entry.factory();
        entry.owner.entries.set(entry.key, entry); // since an entry may be fabricated, it needs to be stored in the correct place
        return entry as Built<T>;
    }

    // v3 - search for provides, starting from the current injector; child injectors overshadow parent injectors
    private getEntry<T>(key: InjectKey<T>): Entry<T> {
        return this.entries.get(key) as Entry<T> ??
            this.parent?.getEntry(key) ?? {
            key,
            factory: () => new (key as Ctor<T>)(),
            owner: this, // falling to the root injector implies universal context, and ownership at the lowest level
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
