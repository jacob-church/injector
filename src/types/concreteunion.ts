export type ConcreteUnion<T extends unknown[]> = T extends
    [infer First, ...infer Rest]
    ? First extends { ["prototype"]: unknown }
        ? First["prototype"] | ConcreteUnion<Rest>
    : never
    : never;
