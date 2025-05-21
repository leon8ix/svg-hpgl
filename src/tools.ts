/**
 * This file contains tools intended for any consuming packages,
 * which might be helpful when working with SVG to HPGL conversion,
 * especially for working with the types produced by this package.
 *
 * These tools are *not* required or used internally.
 *
 * Any export will be reexported in `index.ts`.
 */

import type { HPGLCommand, HPGLProgram, PenSelector } from '.';

/** Implements and expects absolute coords (PA)  */
export function hpglFindBBox(hpgl: HPGLProgram) {
	const cmds: HPGLCommand[] = ['PU', 'PD', 'PA'];
	let xMin: number, xMax: number, yMin: number, yMax: number;
	xMin = yMin = +Infinity;
	xMax = yMax = -Infinity;
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

export function drawHPGLtoCanvas(canvas: HTMLCanvasElement, hpgl: HPGLProgram, width: number, height: number): void {
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
		if (x === undefined || y === undefined || vals.length) return;
		if (cmd === 'PU') {
			ctx.moveTo(x, y);
		} else if (cmd === 'PD') {
			ctx.lineTo(x, y);
		}
	});

	ctx.stroke();
}

export function getHPGLasSVGPaths(hpgl: HPGLProgram): { pen: number; d: string }[] {
	const ds: { pen: number; d: string }[] = [];
	let pen = 1;
	let d = '';

	function finishPen() {
		d && ds.push({ pen, d });
		d = '';
	}
	hpgl.forEach(([cmd, x, y, ...vals]) => {
		if (cmd.startsWith('SP')) {
			const num = parseInt(cmd.slice(2));
			if (isNaN(num)) return;
			finishPen();
			pen = num;
		} else if (x === undefined || y === undefined || vals.length) {
			return;
		} else if (cmd === 'PU') {
			d += `M${x},${y}`;
		} else if (cmd === 'PD') {
			d += `L${x},${y}`;
		}
	});
	finishPen();
	return ds;
}

export type HPGLtoSVGParams = {
	viewBox?: { x: number; y: number; w: number; h: number };
	pens?: PenSelector[];
	stroke?: number;
};

export function getHPGLasSVG(hpgl: HPGLProgram, params: HPGLtoSVGParams) {
	const { pens } = params;
	const viewBox = params.viewBox || findViewBox(hpgl, 0.05);
	const stroke = params.stroke || (viewBox.w + viewBox.h) / 1000;
	const ds = getHPGLasSVGPaths(hpgl);
	const paths: string[] = [];
	ds.forEach(({ d, pen }) => {
		let color = 'black';
		if (pens) {
			const s = pens.find(p => p.pen === pen)?.stroke;
			if (typeof s === 'string') color = s;
			if (Array.isArray(s) && s[0]) color = s[0];
		}
		paths.push(`<path data-pen="${pen}" stroke="${color}" d="${d}" />`);
	});
	const vb = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;
	let svg = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="${vb}">\n`;
	svg += `<g stroke-width="${stroke}" fill="none">\n`;
	svg += paths.join('\n');
	svg += '\n</g>';
	svg += '\n</svg>';
	return svg;
}

function findViewBox(hpgl: HPGLProgram, paddingFact = 0) {
	const { xMin, yMin, width, height } = hpglFindBBox(hpgl);
	const xPad = paddingFact * width;
	const yPad = paddingFact * height;
	return {
		x: xMin - xPad,
		y: yMin - yPad,
		w: width + 2 * xPad,
		h: height + 2 * yPad,
	};
}
