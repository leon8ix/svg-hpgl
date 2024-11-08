export type HPGLCommand = 'PU' | 'PD' | 'PA' | `SP${number}`;
export type HPGLInstruction = [HPGLCommand, ...number[]];
export type HPGLProgram = HPGLInstruction[];
export declare function buildHPGL(program: HPGLProgram, prefix?: string, suffix?: string): string;
/** defaults to any stroked element, uses selector in this prio: selector > stroke > [stroke] */
export type PenSelectors = {
    pen: number;
    /** [stroke], [stroke=magenta] or any other querySelector */
    selector?: string;
    /** should use values retrieved by getSvgStrokeColors */
    stroke?: string;
}[];
export type SVGtoHPGLOptions = {
    /** Number of line segments per og unit any curves will be split into */
    segmentsPerUnit?: number;
    /** 1. Rotation (degrees, clockwise, around center of svg) */
    rotation?: number;
    /** 2. Offset (og unit, before rotation) */
    offsetX?: number;
    /** 2. Offset (og unit, before rotation) */
    offsetY?: number;
    /** 3. Scale (factor used in hpgl values) */
    scale?: number;
};
export declare function svgToHPGL(svg: SVGSVGElement, pens?: PenSelectors, options?: SVGtoHPGLOptions): HPGLProgram;
/** Implements and expects absolute coords (PA)  */
export declare function hpglFindBBox(hpgl: HPGLProgram): {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    width: number;
    height: number;
};
export declare function drawHPGL(canvas: HTMLCanvasElement, hpgl: HPGLProgram, width: number, height: number): void;
export declare function getSVGStrokeColors(svg: SVGSVGElement): Set<string>;
//# sourceMappingURL=index.d.ts.map