export function makeCacheMapKit<C extends MapConstructor | WeakMapConstructor = WeakMapConstructor, K extends Parameters<InstanceType<C>["set"]>[0] = Parameters<InstanceType<C>["set"]>[0], V extends unknown = unknown>(capacity: number, options?: {
    makeMap?: C | (() => SingleEntryMap<K, V>) | undefined;
}): CacheMapKit<C, K, V>;
/**
 * Intentionally limited to local needs; refer to
 * https://github.com/sindresorhus/type-fest if insufficient.
 */
export type WritableDeep<T> = T extends object ? { -readonly [K in keyof T]: T[K]; } : never;
/**
 * A cache of bounded size, implementing the WeakMap interface but holding keys
 * strongly if created with a non-weak `makeMap` option of
 * {@link makeCacheMapKit}.
 */
export type WeakMapAPI<K, V> = Pick<Map<K, V>, Exclude<keyof WeakMap<WeakKey, any>, "set">> & {
    set: (key: K, value: V) => WeakMapAPI<K, V>;
};
export type SingleEntryMap<K, V> = WeakMapAPI<K, V> & ({
    clear?: undefined;
} | Pick<Map<K, V>, "clear">);
/**
 * A cell of a doubly-linked ring (circular list) for a cache map.
 * Instances are not frozen, and so should be closely encapsulated.
 */
export type CacheMapCell<K, V> = {
    /**
     * for debugging
     */
    id: number;
    next: CacheMapCell<K, V>;
    prev: CacheMapCell<K, V>;
    data: SingleEntryMap<K, V>;
};
export type CacheMapMetrics = typeof zeroMetrics;
export type CacheMapKit<C extends MapConstructor | WeakMapConstructor = WeakMapConstructor, K extends Parameters<InstanceType<C>["set"]>[0] = Parameters<InstanceType<C>["set"]>[0], V extends unknown = unknown> = {
    cache: WeakMapAPI<K, V>;
    getMetrics: () => CacheMapMetrics;
};
declare const zeroMetrics: Readonly<{
    totalQueryCount: 0;
    totalHitCount: 0;
}>;
export {};
//# sourceMappingURL=cachemap.d.ts.map