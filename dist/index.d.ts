export type HPGLCommand = 'PU' | 'PD' | 'PA';
export type HPGLInstruction = [HPGLCommand, ...number[]];
export type HPGLProgram = HPGLInstruction[];
export declare function buildHPGL(program: HPGLProgram, prefix?: string, suffix?: string): string;
export declare function svgToHPGL(svgStr: string, segmentsPerUnit?: number): HPGLProgram;
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
//# sourceMappingURL=index.d.ts.map