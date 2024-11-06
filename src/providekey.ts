export class ProvideKey<T> {
    constructor(public readonly name: string) {}
}
export function key<T>(name: string): ProvideKey<T> {
    return new ProvideKey<T>(name);
}
