import type { FixedArray, KeysOfUnion } from './utils';

const cmdLengths = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 } as const satisfies Record<
	string,
	number
>;

export type PathCommand = keyof typeof cmdLengths;

export type CommandVals = { [K in PathCommand]: FixedArray<number, (typeof cmdLengths)[K]> };

// TODO: implement vals with FixedArray
export type PathInstructionRaw = { cmd: PathCommand; rel: boolean; vals: number[] };

export type PathInstruction =
	/** Move to (first command, lift pointer, don't draw) */
	| { cmd: 'M'; rel: boolean; x: number; y: number }
	/** Line to */
	| { cmd: 'L'; rel: boolean; x: number; y: number }
	/** Horizontal */
	| { cmd: 'H'; rel: boolean; x: number }
	/** Vertical */
	| { cmd: 'V'; rel: boolean; y: number }
	/** Cubic bézier curve (most design software) */
	| { cmd: 'C'; rel: boolean; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
	/** Smooth cubic bézier curve (control point 1 is implied by previous path) */
	| { cmd: 'S'; rel: boolean; x2: number; y2: number; x: number; y: number }
	/** Quadratic bézier curve */
	| { cmd: 'Q'; rel: boolean; x1: number; y1: number; x: number; y: number }
	/** Smooth quadratic bézier curve (control point is implied by previous path) */
	| { cmd: 'T'; rel: boolean; x: number; y: number }
	/** Arc (partial ellipse) */
	| {
			cmd: 'A';
			rel: boolean;
			rx: number;
			ry: number;
			/** xAxisRotation */
			rot: number;
			/** largeArcFlag */
			fa: 0 | 1;
			/** sweepFlag */
			fs: 0 | 1;
			x: number;
			y: number;
	  }
	/** Close path (at the end) */
	| { cmd: 'Z'; rel: false };

/** All-in-one SVG path parsing function, returns `readable`, `absolute` path commands */
export function parseSvgPath(d: string) {
	return toAbsolute(parseSvgPathSyntax(d).map(ins => keyPathInstruction(ins)));
}

/** Basic decoding of path syntax to raw instructions */
export function parseSvgPathSyntax(d: string): PathInstructionRaw[] {
	const pathSeq: PathInstructionRaw[] = [];
	let cmd: PathCommand = 'M';
	let rel = false;
	let token = '';
	let isFloat = false;
	const vals: number[] = [];

	function finishToken() {
		if (!token.length) return;
		const num = parseFloat(token);
		if (!isNaN(num)) vals.push(num);
		token = '';
		isFloat = false;
	}

	function finishCommand() {
		finishToken();
		const cmdLength = cmdLengths[cmd];
		if (cmdLength) {
			if (!vals.length) return;
			const cmdCount = Math.floor(vals.length / cmdLength);
			for (let i = 0; i < cmdCount; i++) {
				if (cmd === 'M' && i === 1) cmd = 'L'; // Implicit L after M pos
				const firstValI = i * cmdLength;
				const lastValI = firstValI + cmdLength;
				pathSeq.push({ cmd, rel, vals: vals.slice(firstValI, lastValI) });
			}
		} else if (cmdLength === 0) {
			pathSeq.push({ cmd, rel, vals: [] });
		}
		vals.length = 0;
	}

	for (const c of d) {
		if (isLetter(c)) {
			finishCommand();
			const upperCmd = c.toUpperCase();
			if (!(upperCmd in cmdLengths)) continue;
			cmd = upperCmd as PathCommand;
			rel = isLowercase(c);
		} else if (c === ',' || c === ' ') {
			finishToken();
		} else if (c === '.') {
			if (isFloat) finishToken();
			token += c;
			isFloat = true;
		} else if (c === '-') {
			finishToken();
			token += c;
		} else if (isDigit(c)) {
			token += c;
		}
	}
	finishCommand();

	return pathSeq;
}

function isLetter(c: string): boolean {
	return c.toLowerCase() !== c.toUpperCase();
}
function isLowercase(c: string): boolean {
	return c !== c.toUpperCase();
}
function isDigit(c: string): boolean {
	return c === String(parseInt(c));
}

function keyPathInstruction({ cmd, rel, vals }: PathInstructionRaw): PathInstruction {
	switch (cmd) {
		case 'M':
			return mapArrayIndex(vals, ['x', 'y'], 0, { cmd, rel });
		case 'L':
			return mapArrayIndex(vals, ['x', 'y'], 0, { cmd, rel });
		case 'H':
			return mapArrayIndex(vals, ['x'], 0, { cmd, rel });
		case 'V':
			return mapArrayIndex(vals, ['y'], 0, { cmd, rel });
		case 'C':
			return mapArrayIndex(vals, ['x1', 'y1', 'x2', 'y2', 'x', 'y'], 0, { cmd, rel });
		case 'S':
			return mapArrayIndex(vals, ['x2', 'y2', 'x', 'y'], 0, { cmd, rel });
		case 'Q':
			return mapArrayIndex(vals, ['x1', 'y1', 'x', 'y'], 0, { cmd, rel });
		case 'T':
			return mapArrayIndex(vals, ['x', 'y'], 0, { cmd, rel });
		case 'A':
			return {
				cmd,
				rel,
				rx: vals[0] ?? 0,
				ry: vals[1] ?? 0,
				rot: vals[2] ?? 0,
				fa: vals[3] ? 1 : 0,
				fs: vals[4] ? 1 : 0,
				x: vals[5] ?? 0,
				y: vals[6] ?? 0,
			};
		case 'Z':
			return { cmd, rel: false };
	}
}

function mapArrayIndex<T, K extends string, O extends Record<string, any>>(
	arr: T[],
	keys: K[],
	fallback: T,
	baseObj?: O
) {
	const obj = (baseObj as O & Record<K, T>) || ({} as Record<K, T>);
	// @ts-expect-error
	keys.forEach((key, i) => (obj[key] = arr[i] ?? fallback));
	return obj;
}

/** Transforms all commands to absolute, modifies original objects and returns same ref */
function toAbsolute(instructions: PathInstruction[]): PathInstruction[] {
	let currX = 0;
	let currY = 0;
	function updateCurr(ins: PathInstruction) {
		if ('x' in ins) currX = ins.x;
		if ('y' in ins) currY = ins.y;
	}
	instructions.forEach(ins => {
		if (!ins.rel) return updateCurr(ins);
		ins.rel = false;
		const keys = Object.keys(ins) as KeysOfUnion<typeof ins>[];
		// @ts-expect-error
		keys.filter(key => key.startsWith('x')).forEach(key => (ins[key] += currX));
		// @ts-expect-error
		keys.filter(key => key.startsWith('y')).forEach(key => (ins[key] += currY));
		updateCurr(ins);
	});
	return instructions;
}
