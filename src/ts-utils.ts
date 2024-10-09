export type FixedArray<T, L extends number, R extends unknown[] = []> = R['length'] extends L
	? R
	: FixedArray<T, L, [T, ...R]>;

export type KeysOfUnion<T> = T extends T ? keyof T : never;
