/*
v2

A "real" injector.
This version allows us to substitute things for other things
e.g. mock classes

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

// v2 - simple metadata wrapper: what are we injecting, and how do we make it?
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
// v2 - syntactic sugar
export function provide<T>(key: InjectKey<T>): Provider<T> {
    return new Provider(key);
}

// v2 - augmented metadata wrapper for internal injector housekeeping
type Entry<T = unknown> = Provide<T> & {
    value?: T;
};
type Built<T = unknown> = Entry<T> & {
    value: T;
};
function isBuilt<T>(entry: Entry<T>): entry is Built<T> {
    return "value" in entry;
}

class Injector {
    private entries = new Map<InjectKey, Entry>();

    constructor(provides: Provide[] = []) {
        provides.forEach((p) => {
            this.entries.set(p.key, {
                ...p,
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
        // v2 - get provider if we have it; else fabricate one for future use
        const entry = this.entries.get(key) as Entry<T> | undefined ?? {
            key,
            factory: () => new (key as Ctor<T>)(),
        };
        if (isBuilt(entry)) {
            return entry;
        }
        // v2 - building is trivial!
        entry.value = entry.factory();
        this.entries.set(entry.key, entry); // important in the default case where we fabricate a new provider
        return entry as Built<T>;
    }
}

let activeInjector: Injector | undefined = undefined;
export function inject<T>(key: InjectKey<T>): T {
    if (!activeInjector) {
        throw new Error();
    }
    return activeInjector.get(key);
}

export function newInjector(provides?: Provide[]) {
    return new Injector(provides);
}
