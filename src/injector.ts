import { type BuiltEntry, type Entry, isBuilt } from "./entry.ts";
import type { InjectKey, Structor } from "./injectkey.ts";
import type { Provide } from "./provide.ts";

export let ActiveInjector: Injector | undefined = undefined;

/**
 * A dependency injector supporting hierarchical providers
 */
class Injector {
    // leverage the call stack to trace dependencies between requestable types at runtime
    private static depRecord: BuiltEntry[] | undefined = undefined;
    // cache created injectables between invocations
    private entries = new Map<InjectKey, Entry>();
    // track which types have already had their dependencies analyzed for assignment within the hierarchy
    private settled = new Set<InjectKey>();

    constructor(provides?: Provide[], private readonly parent?: Injector) {
        for (const provide of provides ?? []) {
            this.entries.set(provide.key, { ...provide, explicit: true });
        }
    }

    /**
     * @return a singleton of type T
     *
     * Entry-point to an active injection context
     */
    public get<T>(key: InjectKey<T>): T {
        const prevInjector = ActiveInjector;
        ActiveInjector = this;
        try {
            return this.getInternal(key);
        } finally {
            ActiveInjector = prevInjector;
        }
    }

    private getInternal<T>(key: InjectKey<T>): T {
        let { entry, injector } = this.getOwnedEntry(key);
        if (this.settled.has(key)) {
            return this.recordedEntry(entry as BuiltEntry<T>);
        }

        const needsBuildToRecordDeps = !isBuilt(entry);
        if (needsBuildToRecordDeps) {
            entry = this.build({ ...entry });
        }
        const settled = this.getSettledInjector(
            entry as BuiltEntry<T>,
            injector,
        );
        if (!needsBuildToRecordDeps && settled != injector) {
            // we need a fresh built entry if we're updating the owner
            entry = this.build({ ...entry });
        }
        this.storeSettledEntry(entry, settled);
        return this.recordedEntry(entry as BuiltEntry<T>);
    }

    /**
     * Fetches the top-most provide entry and returns it along with a reference
     * to the injector that holds it.
     *
     * If there is no provide, it bottoms out at the root injector of the hierarchy
     * and supplies a default, implicit provide
     */
    private getOwnedEntry<T>(
        key: InjectKey<T>,
    ): { entry: Entry; injector: Injector } {
        const entry = this.entries.get(key);
        if (entry) {
            return { entry, injector: this };
        }
        if (!this.parent) {
            return {
                entry: { key, factory: () => new (key as Structor<T>)() },
                injector: this,
            };
        }
        return this.parent.getOwnedEntry(key);
    }

    /**
     * Stores the fully constructed provide in the given injector, and
     * notifies every injector between `this` and `owningInjector` that
     * the entry has been analyzed, and assigned
     */
    private storeSettledEntry(entry: Entry, owningInjector: Injector) {
        owningInjector.entries.set(entry.key, entry);
        this.settleEntry(entry, owningInjector);
    }
    private settleEntry(entry: Entry, owningInjector: Injector) {
        this.settled.add(entry.key);
        if (this !== owningInjector) {
            this.parent?.settleEntry(entry, owningInjector);
        }
    }

    /**
     * Finalizes an entry by executing its factory function
     * and storing a record of dependencies found during construction
     */
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

    /**
     * For a given entry, determine which injector between `this` and the
     * `owningInjector` should take ownership of the constructed object
     *
     * TODO: investigate - owing to the choice to build everything in the
     * injector where the `.get` originated, and the fact that `useExisting`
     * provides rely on calling the `inject` function, it may be possible
     * to tinker with the deps recording logic to determine this information
     * _during_ construction, making this algorith redundant; essentially,
     * by keeping the right global/static state, the question could be phrased
     * "which injector's provides were accessed during this construction",
     * and if it can be determined _simply_ which injector is "childmost"
     * during that stage, the settled injector will be evident
     */
    private getSettledInjector(entry: BuiltEntry, originalOwner: Injector) {
        let injector: Injector = this;
        const injectors: Injector[] = [this];
        while (injector.parent) {
            injector = injector.parent;
            injectors.push(injector);
            if (injector == originalOwner) {
                break;
            }
        }

        let lowest = injectors.length - 1;
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

    /**
     * Whether this key was provided during construction
     * of this injector
     */
    private hasExplicitly(key: InjectKey): boolean {
        return !!this.entries.get(key)?.explicit;
    }

    /**
     * A generated iterable of every InjectKey requested during construction of the given entry
     */
    private *transitiveDeps(
        entry: BuiltEntry,
        visited: Set<InjectKey> = new Set(),
    ): Iterable<InjectKey> {
        if (visited.has(entry.key)) {
            return;
        }
        visited.add(entry.key);
        yield entry.key;
        for (const dep of entry.deps) {
            yield* this.transitiveDeps(dep, visited);
        }
    }

    /**
     * Accesses and returns the value from a built entry, while informing
     * any injector requests deeper in the call stack that they depend on
     * this entry
     */
    private recordedEntry<T>(entry: BuiltEntry<T>): T {
        // makes sure that previously built things are correctly tied
        // to the things that request them
        Injector.depRecord?.push(entry);
        return entry.value;
    }
}

/**
 * Construct an Injector
 */
export function newInjector(provides?: Provide[], parent?: Injector) {
    return new Injector(provides, parent);
}
