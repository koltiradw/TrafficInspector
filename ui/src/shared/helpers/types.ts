export type AnyObject = Record<string | number | symbol, unknown>;

export type Defined<T> = Exclude<T, undefined | null>;
