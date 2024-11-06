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
    key: InjectKey<T>,
    factory: () => T,
}

class Provider<T> {
    constructor(private readonly key: InjectKey<T>) {};
    
    public use(factory: () => T): Provide<T> {
        return {
            key: this.key,
            factory,
        }
    }
    // value    {key: K, factory: () => <instance of K>}
    // factory  {key: K, factory: () => new K()}
    // existing {key: K, factory: () => inject(K_)}
}
export function provide<T>(key: InjectKey<T>): Provider<T> {
    return new Provider(key);
}

type Entry<T = unknown> = Provide<T> & {
    explicit?: true;
    built?: true; // I won't need this later, but its quick and dirty now
    value?: T;
}

class Injector {
    private entries = new Map<InjectKey, Entry>();

    constructor(provides?: Provide[], private readonly parent?: Injector) {
        for (const provide of provides ?? []) {
            this.entries.set(provide.key, {...provide, explicit: true});
        } 
    }

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
        const {entry, injector} = this.getOwnedEntry(key);
        if (!entry.built) {
            entry.value = entry.factory();
            entry.built = true;
            this.storeSettledEntry(entry, injector);
        }
        return entry.value as T;
    }

    private getOwnedEntry<T>(key: InjectKey<T>): {entry: Entry, injector: Injector} {
        const entry = this.entries.get(key);
        if (entry) {
            return {entry, injector: this};
        }
        if (!this.parent) {
            return {
                entry: {key, factory: () => new (key as Structor<T>)()},
                injector: this,
            }
        }
        return this.parent.getOwnedEntry(key);
    }

    private storeSettledEntry(entry: Entry, owningInjector: Injector) {
        owningInjector.entries.set(entry.key, entry);
    }
}

let currentInjector: Injector | undefined = new Injector();
export function inject<T>(key: InjectKey<T>): T {
    if (!currentInjector) {
        throw Error('No active injector');
    }
    return currentInjector.get(key);
}

export function newInjector(provides?: Provide[], parent?: Injector) {
    return new Injector(provides, parent);
}

