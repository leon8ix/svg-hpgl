import type { FixedArray } from './ts-utils';
declare const cmdLengths: {
    readonly M: 2;
    readonly L: 2;
    readonly H: 1;
    readonly V: 1;
    readonly C: 6;
    readonly S: 4;
    readonly Q: 4;
    readonly T: 2;
    readonly A: 7;
    readonly Z: 0;
};
export type PathCommand = keyof typeof cmdLengths;
export type CommandVals = {
    [K in PathCommand]: FixedArray<number, (typeof cmdLengths)[K]>;
};
export type PathInstructionRaw = {
    cmd: PathCommand;
    rel: boolean;
    vals: number[];
};
export type PathInstruction = 
/** Move to (first command, lift pointer, don't draw) */
{
    cmd: 'M';
    rel: boolean;
    x: number;
    y: number;
}
/** Line to */
 | {
    cmd: 'L';
    rel: boolean;
    x: number;
    y: number;
}
/** Horizontal */
 | {
    cmd: 'H';
    rel: boolean;
    x: number;
}
/** Vertical */
 | {
    cmd: 'V';
    rel: boolean;
    y: number;
}
/** Cubic bézier curve (most design software) */
 | {
    cmd: 'C';
    rel: boolean;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x: number;
    y: number;
}
/** Smooth cubic bézier curve (control point 1 is implied by previous path) */
 | {
    cmd: 'S';
    rel: boolean;
    x2: number;
    y2: number;
    x: number;
    y: number;
}
/** Quadratic bézier curve */
 | {
    cmd: 'Q';
    rel: boolean;
    x1: number;
    y1: number;
    x: number;
    y: number;
}
/** Smooth quadratic bézier curve (control point is implied by previous path) */
 | {
    cmd: 'T';
    rel: boolean;
    x: number;
    y: number;
}
/** Arc (partial ellipse) */
 | {
    cmd: 'A';
    rel: boolean;
    rx: number;
    ry: number;
    xAxisRotation: number;
    largeArcFlag: 0 | 1;
    sweepFlag: 0 | 1;
    x: number;
    y: number;
}
/** Close path (at the end) */
 | {
    cmd: 'Z';
    rel: false;
};
/** All-in-one SVG path parsing function, returns `readable`, `absolute` path commands */
export declare function parsePath(d: string): PathInstruction[];
/** Basic decoding of path syntax to raw instructions */
export declare function parsePathSyntax(d: string): PathInstructionRaw[];
export declare function keyPathInstruction({ cmd, rel, vals }: PathInstructionRaw): PathInstruction;
export {};
//# sourceMappingURL=svg-path.d.ts.map