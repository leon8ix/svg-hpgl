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
type SVGtoHPGLOptions = {
    segmentsPerUnit?: number;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
};
export declare function svgToHPGL(svg: SVGSVGElement, pens: PenSelectors | undefined, { segmentsPerUnit, scale, offsetX, offsetY }: SVGtoHPGLOptions): HPGLProgram;
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
export declare function getSvgStrokeColors(svg: SVGSVGElement): Set<string>;
export {};
//# sourceMappingURL=index.d.ts.map