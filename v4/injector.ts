/*
v4

A _correct_ injector.
This version fills the gaps in the last injector and properly respects
interrelated provides from injectors throughout the hierarchy

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
    value?: T;
    deps?: BuiltEntry[],
}

type BuiltEntry<T = unknown> = Provide<T> & {
    value: T,
    deps: BuiltEntry[],
}
function isBuilt<T>(entry: Entry<T>): entry is BuiltEntry<T> {
    return typeof entry.deps !== 'undefined';
}

class Injector {
    private static depRecord: BuiltEntry[] | undefined = undefined;
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
        let {entry, injector} = this.getOwnedEntry(key);
        const needsBuildToRecordDeps = !isBuilt(entry);
        if (needsBuildToRecordDeps) {
            entry = this.build({...entry});
        }
        const settled = this.getSettledInjector(entry as BuiltEntry<T>, injector);
        if (!needsBuildToRecordDeps && settled != injector) {
            // we need a fresh built entry if we're updating the owner
            entry = this.build({...entry});
        }
        this.storeSettledEntry(entry, settled);
        return this.recordedEntry(entry as BuiltEntry<T>);
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

    private build<T>(entry: Entry<T>): BuiltEntry<T> {
        const prevDepRecord = Injector.depRecord;
        Injector.depRecord = [];
        try {
            entry.value = entry.factory();
            entry.deps = Injector.depRecord;
        } finally {
            Injector.depRecord = prevDepRecord;
        }
        return entry as BuiltEntry<T>;
    }

    private getSettledInjector(entry: BuiltEntry, originalOwner: Injector) {
        // iterate over all of the deps of this entry, 
        // for each, figure out the lowest injector that can hold
        // it. store in the highest such injector
        let injector: Injector = this;
        const injectors: Injector[] = [this];
        while (injector.parent) {
            injector = injector.parent;
            injectors.push(injector)
            if (injector == originalOwner) {
                break;
            }
        }

        let lowest = injectors.length-1;
        for (const depKey of this.transitiveDeps(entry)) {
            // find explicit injector, track depth
            for (let i = 0; i < lowest; i++) {
                if (injectors[i].hasExplicitly(depKey)) {
                    lowest = Math.min(i, lowest);
                    break;
                }
            }
            if (lowest == 0) {
                break;
            }
        }
        return injectors[lowest];
    }

    private hasExplicitly(key: InjectKey): boolean {
        return !!this.entries.get(key)?.explicit;
    }

    private *transitiveDeps(entry: BuiltEntry, visited: Set<InjectKey> = new Set()): Iterable<InjectKey> {
        if (visited.has(entry.key)) {
            return;
        }
        visited.add(entry.key);
        yield entry.key;
        for (const dep of entry.deps) {
            yield* this.transitiveDeps(dep, visited);
        }
    }

    

    private recordedEntry<T>(entry: BuiltEntry<T>): T {
        // makes sure that previously built things are correctly tied
        // to the things that request them
        Injector.depRecord?.push(entry);
        return entry.value;
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

