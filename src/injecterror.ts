import type { InjectKey, ProviderRequired } from "./types/injectkey.ts";

export class InjectorError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(withInjectionStack(message), options);
    }
}

export class InjectError extends InjectorError {
    constructor(cause: Error) {
        super(cause.message, { cause });
    }
}

export class MissingProvideError extends InjectorError {
    constructor(key: ProviderRequired) {
        super(
            `Missing explicit provider for type (${injectKeyName(key)}).`,
        );
    }
}

export class TooManyArgsError extends InjectorError {
    constructor(key: InjectKey) {
        super(
            `Type (${key}) is not implicitly injectable: constructor has too many arguments.`,
        );
    }
}

export class CyclicDependencyError extends InjectorError {
    constructor(key: InjectKey) {
        super(
            `Cycle detected on type ${injectKeyName(key)}`,
        );
    }
}

class UniqueStack {
    private set: Set<InjectKey> = new Set();
    private stack: InjectKey[] = [];
    public push(key: InjectKey): void {
        if (this.set.has(key)) {
            throw new CyclicDependencyError(key);
        }
        this.set.add(key);
        this.stack.push(key);
    }

    public pop(): void {
        this.set.delete(this.stack.pop()!);
    }

    public trace(): string {
        return this.stack.map((key: InjectKey) => injectKeyName(key)).join(
            " -> ",
        );
    }
}
export const InjectionStack: UniqueStack = new UniqueStack();
function injectKeyName(key: InjectKey): string {
    return key.name; // constructors/types
}
function withInjectionStack(msg: string): string {
    const trace = InjectionStack.trace();
    return `Failed to inject (${trace}): ${msg}`;
}
