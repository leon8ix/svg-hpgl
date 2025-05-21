import type { HPGLInstruction } from '.';
import type { getTransformer } from './svg-transform';

// > HPGL

export function PU(tf: ReturnType<typeof getTransformer>, x: number, y: number): HPGLInstruction {
	return ['PU', ...tf(x, y)];
}

export function PD(tf: ReturnType<typeof getTransformer>, x: number, y: number): HPGLInstruction {
	return ['PD', ...tf(x, y)];
}

export function PUD(tf: ReturnType<typeof getTransformer>, points: [number, number][]): HPGLInstruction[] {
	return points.map((pt, i) => (i === 0 ? PU(tf, ...pt) : PD(tf, ...pt)));
}

// > SVG

export function svgVal(prop: SVGAnimatedLength) {
	return prop.baseVal.value || 0;
}

export function svgVals<T extends SVGGraphicsElement & Record<U, { baseVal: { value: number } }>, U extends keyof T>(
	el: T,
	props: U[]
) {
	const vals = {} as Record<U, number>;
	for (const prop of props) {
		if (!el[prop]?.baseVal) {
			console.warn(`Prop ${String(prop)} not in Element`, el);
			continue;
		}
		vals[prop] = el[prop].baseVal.value || 0;
	}
	return vals;
}

// > TS

export type FixedArray<T, L extends number, R extends unknown[] = []> = R['length'] extends L
	? R
	: FixedArray<T, L, [T, ...R]>;

export type KeysOfUnion<T> = T extends T ? keyof T : never;
