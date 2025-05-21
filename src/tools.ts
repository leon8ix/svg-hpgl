/**
 * This file contains tools intended for any consuming packages,
 * which might be helpful when working with SVG to HPGL conversion,
 * especially for working with the types produced by this package.
 *
 * These tools are *not* required or used internally.
 *
 * Any export will be reexported in `index.ts`.
 */

import type { HPGLCommand, HPGLProgram } from '.';

/** Implements and expects absolute coords (PA)  */
export function hpglFindBBox(hpgl: HPGLProgram) {
	const cmds: HPGLCommand[] = ['PU', 'PD', 'PA'];
	let xMin: number, xMax: number, yMin: number, yMax: number;
	xMin = xMax = yMin = yMax = 0;
	hpgl.forEach(([cmd, x, y, ...vals]) => {
		if (cmds.includes(cmd) && x && y && vals.length === 0) {
			if (x < xMin) xMin = x;
			if (x > xMax) xMax = x;
			if (y < yMin) yMin = y;
			if (y > yMax) yMax = y;
		}
	});
	return { xMin, xMax, yMin, yMax, width: xMax - xMin, height: yMax - yMin };
}

export function drawHPGL(canvas: HTMLCanvasElement, hpgl: HPGLProgram, width: number, height: number): void {
	// console.log(width, height);
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Context of canvas unavailable');

	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, width, height);

	ctx.lineWidth = Math.round(Math.max(width, height) / 1000);
	ctx.strokeStyle = '#000000';
	ctx.beginPath();

	hpgl.forEach(([cmd, x, y, ...vals]) => {
		// console.log({ cmd, x, y, vals });
		if (x === undefined || y === undefined || vals.length) return;
		if (cmd === 'PU') {
			ctx.moveTo(x, y);
		} else if (cmd === 'PD') {
			ctx.lineTo(x, y);
		}
	});

	ctx.stroke();
}
