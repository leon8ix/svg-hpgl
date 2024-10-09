import { parsePath, PathInstruction } from './svg-path';
import getBezierPoints from 'adaptive-bezier-curve';

export type HPGLCommand = 'PU' | 'PD' | 'PA';
export type HPGLInstruction = [HPGLCommand, ...number[]];
export type HPGLProgram = HPGLInstruction[];

export function buildHPGL(program: HPGLProgram, prefix = '', suffix = ''): string {
	return prefix + program.map(([cmd, ...vals]) => cmd + vals.join(',') + ';').join('') + suffix;
}

export function svgToHPGL(svgStr: string, segmentsPerUnit = 0.08): HPGLProgram {
	const svg = getSvgDoc(svgStr);
	if (!svg) throw Error('Invalid SVG supplied');
	const hpgl: HPGLProgram = [['PA']];

	svg.querySelectorAll('line').forEach(line => {
		const tf = getTransformer(line);
		hpgl.push(PU(tf, svgVal(line.x1), svgVal(line.y1)));
		hpgl.push(PD(tf, svgVal(line.x2), svgVal(line.y2)));
	});

	svg.querySelectorAll('polyline').forEach(polyline => {
		const tf = getTransformer(polyline);
		const points = polyline.points;
		if (points[0]) hpgl.push(PU(tf, points[0]?.x, points[0]?.y));
		for (const pt of points) hpgl.push(PD(tf, pt.x, pt.y));
	});

	svg.querySelectorAll('circle').forEach(circle => {
		const tf = getTransformer(circle);
		const { cx, cy, r } = svgVals(circle, ['cx', 'cy', 'r']);
		const circum = 2 * Math.PI * r;
		const segments = circum * segmentsPerUnit;
		hpgl.push(PU(tf, cx + r, cy));
		hpgl.push(...getArcPoints(cx, cy, r, r, 0, 2 * Math.PI, segments).map(pt => PD(tf, ...pt)));
	});

	svg.querySelectorAll('ellipse').forEach(ellipse => {
		const tf = getTransformer(ellipse);
		const { cx, cy, rx, ry } = svgVals(ellipse, ['cx', 'cy', 'rx', 'ry']);
		const circum = Math.PI * (rx + ry); // approx.
		const segments = circum * segmentsPerUnit;
		hpgl.push(PU(tf, cx + rx, cy));
		hpgl.push(...getArcPoints(cx, cy, rx, ry, 0, 2 * Math.PI, segments).map(pt => PD(tf, ...pt)));
	});

	svg.querySelectorAll('rect').forEach(rect => {
		const tf = getTransformer(rect);
		const { width: w, height: h, x, y } = svgVals(rect, ['width', 'height', 'x', 'y']);
		const rx = Math.min(w / 2, svgVal(rect.rx) || svgVal(rect.ry) || 0);
		const ry = Math.min(h / 2, svgVal(rect.ry) || svgVal(rect.rx) || 0);
		if (!rx || !ry) {
			hpgl.push(PU(tf, x, y));
			hpgl.push(PD(tf, x + w, y));
			hpgl.push(PD(tf, x + w, y + h));
			hpgl.push(PD(tf, x, y + h));
			hpgl.push(PD(tf, x, y));
		} else {
			const circum = 0.25 * Math.PI * (rx + ry); // approx.
			const segments = circum * segmentsPerUnit;
			hpgl.push(PU(tf, x, y + ry));
			hpgl.push(
				...[
					...getArcPoints(x + rx, y + ry, rx, ry, Math.PI, 1.5 * Math.PI, segments),
					...getArcPoints(x + w - rx, y + ry, rx, ry, 1.5 * Math.PI, 2 * Math.PI, segments),
					...getArcPoints(x + w - rx, y + h - ry, rx, ry, 0, 0.5 * Math.PI, segments),
					...getArcPoints(x + rx, y + h - ry, rx, ry, 0.5 * Math.PI, Math.PI, segments),
				].map(pt => PD(tf, ...pt))
			);
			hpgl.push(PD(tf, x, y + ry));
		}
	});

	svg.querySelectorAll('path').forEach(path => {
		const tf = getTransformer(path);
		const d = path.getAttribute('d');
		if (!d) return;
		let currX = 0;
		let currY = 0;
		function updateCurr(ins: PathInstruction) {
			if ('x' in ins) currX = ins.x;
			if ('y' in ins) currY = ins.y;
		}
		const instructions = parsePath(d);
		console.log('Path', instructions);
		instructions.forEach((ins, insI) => {
			const { cmd } = ins;
			if (cmd === 'M') {
				hpgl.push(PU(tf, ins.x, ins.y));
			} else if (cmd === 'L') {
				hpgl.push(PD(tf, ins.x, ins.y));
			} else if (cmd === 'H') {
				hpgl.push(PD(tf, ins.x, currY));
			} else if (cmd === 'V') {
				hpgl.push(PD(tf, currX, ins.y));
			} else if (cmd === 'C') {
				const points = getBezierPoints([currX, currY], [ins.x1, ins.y1], [ins.x2, ins.y2], [ins.x, ins.y], 10);
				hpgl.push(...PUD(tf, points));
			} else if (cmd === 'S') {
				// If the previous command was cubic Bézier (C or S): Reflect the second control point.
				// If the previous command was anything else: Treat the first control point as the current point.
				const preCmd = instructions[insI - 1];
				const preHasC2 = preCmd && 'x2' in preCmd && 'y2' in preCmd;
				const x1 = preHasC2 ? 2 * currX - preCmd.x2 : currX;
				const y1 = preHasC2 ? 2 * currY - preCmd.y2 : currY;
				const points = getBezierPoints([currX, currY], [x1, y1], [ins.x2, ins.y2], [ins.x, ins.y], 10);
				hpgl.push(...PUD(tf, points));
				updateCurr(ins);
			} else if (cmd === 'Q') {
			} else if (cmd === 'T') {
			} else if (cmd === 'A') {
			} else if (cmd === 'Z') {
				const firstIns = instructions[0];
				const firstX = firstIns?.cmd === 'M' ? firstIns.x : 0;
				const firstY = firstIns?.cmd === 'M' ? firstIns.y : 0;
				hpgl.push(PD(tf, firstX, firstY));
			}
			updateCurr(ins);
		});
	});

	return hpgl;
}

function getTransformer(element: SVGGraphicsElement): (x: number, y: number) => [number, number] {
	const svg = element.ownerSVGElement;
	if (!svg) {
		console.warn('Could not retrieve ownerSVGElement');
		return (x: number, y: number) => [Math.round(x), Math.round(y)];
	}

	let ctm = svg.createSVGMatrix();
	let currEl: SVGElement | null = element;

	while (currEl) {
		const currCtm = currEl instanceof SVGGraphicsElement && currEl.transform.baseVal.consolidate()?.matrix;
		if (currCtm) ctm = currCtm.multiply(ctm);
		currEl = currEl.parentNode instanceof SVGElement ? currEl.parentNode : null;
	}

	const point = svg.createSVGPoint();

	return (x: number, y: number) => {
		(point.x = x), (point.y = y);
		const pointT = point.matrixTransform(ctm);
		return [Math.round(pointT.x), Math.round(pointT.y)];
	};
}
// function getTransformer(element: SVGGraphicsElement): (x: number, y: number) => [number, number] {
// 	const ctm_ = element.transform.baseVal.consolidate()?.matrix;
// 	const svg_ = element.ownerSVGElement;
// 	if (ctm_ && svg_) {
// 		const ctm = ctm_;
// 		const svg = svg_;
// 		return (x: number, y: number) => {
// 			const point = svg.createSVGPoint();
// 			(point.x = x), (point.y = y);
// 			const pointT = point.matrixTransform(ctm);
// 			return [Math.round(pointT.x), Math.round(pointT.y)];
// 		};
// 	} else {
// 		console.warn('Could not retrieve svg transformation matrix');
// 		return (x: number, y: number) => [Math.round(x), Math.round(y)];
// 	}
// }

function getSvgDoc(svgStr: string): SVGSVGElement | null {
	if (typeof window === 'undefined') {
		const { JSDOM } = require('jsdom');
		const dom = new JSDOM(svgStr, { contentType: 'image/svg+xml' });
		const doc = dom.window.document;
		return doc.querySelector('svg');
	} else {
		const parser = new DOMParser();
		const doc = parser.parseFromString(svgStr, 'image/svg+xml');
		return doc.querySelector('svg');
	}
}

function svgVal(prop: SVGAnimatedLength) {
	return prop.baseVal.value || 0;
}

function svgVals<T extends SVGGraphicsElement & Record<U, { baseVal: { value: number } }>, U extends keyof T>(
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

function getArcPoints(
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	startAngle: number,
	endAngle: number,
	/** Will be rounded and changed to min of `2` */
	segments: number
) {
	segments = Math.max(2, Math.round(segments));
	const arcPoints: [number, number][] = [];
	for (let i = 0; i <= segments; i++) {
		const angle = startAngle + (i * (endAngle - startAngle)) / segments;
		arcPoints.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
	}
	return arcPoints;
}

function PU(tf: ReturnType<typeof getTransformer>, x: number, y: number): HPGLInstruction {
	return ['PU', ...tf(x, y)];
}
function PD(tf: ReturnType<typeof getTransformer>, x: number, y: number): HPGLInstruction {
	return ['PD', ...tf(x, y)];
}
function PUD(tf: ReturnType<typeof getTransformer>, points: [number, number][]): HPGLInstruction[] {
	return points.map((pt, i) => (i === 0 ? PU(tf, ...pt) : PD(tf, ...pt)));
}

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
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Context of canvas unavailable');

	// ctx.lineWidth = 1;
	// ctx.strokeStyle = '#000000';
	ctx.clearRect(0, 0, width, height);
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
