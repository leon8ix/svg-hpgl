import { getCubicBezierPoints, getQuadraticBezierPoints } from './bezier-points';
import { parseSvgPath, parseSvgPathSyntax, type PathInstruction } from './svg-path';
import { getTransformer } from './svg-transform';
import { PD, PU, PUD, svgVal, svgVals } from './utils';

export * from './tools';
export { parseSvgPath, parseSvgPathSyntax };

export type HPGLCommand = 'PU' | 'PD' | 'PA' | `SP${number}`;
export type HPGLInstruction = [HPGLCommand, ...number[]];
export type HPGLProgram = HPGLInstruction[];

export function buildHPGL(program: HPGLProgram, prefix = '', suffix = ''): string {
	return prefix + program.map(([cmd, ...vals]) => cmd + vals.join(',') + ';').join('') + suffix;
}

export type PenSelector = {
	pen: number;
	/** Should use values retrieved by getSvgStrokeColors(), `true` selects all stroked elements */
	stroke: true | string | string[];
	/** Gets inserted after `SP1` (select pen x) and before any commands with that tool */
	cmd?: string;
};

export type SVGtoHPGLOptions = {
	/** Number of line segments per og unit any curves will be split into */
	segmentsPerUnit?: number;
	/** 1. Rotation (degrees, clockwise, around 0|0 of svg) */
	rotation?: number;
	/** 2. Offset (og unit, before rotation) */
	offsetX?: number;
	/** 2. Offset (og unit, before rotation) */
	offsetY?: number;
	/** 3. Scale (factor used in hpgl values) */
	scale?: number;
	/** 4. Mirror around 0 */
	mirrorX?: boolean;
	/** 4. Mirror around 0 */
	mirrorY?: boolean;
};

/**
 * The output will need to be parsed by `buildHPGL()`. \
 * This is not done automatically to allow for other uses of the `HPGLProgram`.
 */
export function svgToHPGL(
	svg: SVGSVGElement,
	pens: PenSelector[] = [{ pen: 1, stroke: true }],
	options: SVGtoHPGLOptions = {}
): HPGLProgram {
	const hpgl: HPGLProgram = [['PA']];
	const { segmentsPerUnit = 1 } = options;
	const bezRes = segmentsPerUnit * 10;

	const strokeEls = getSVGStrokedElements(svg);

	pens.forEach(({ pen, stroke, cmd: penCmd }) => {
		const elements = grabElementsByStroke(strokeEls, stroke);
		if (!elements.length) return;

		hpgl.push([`SP${pen}`], ['PU']);
		if (penCmd) hpgl.push([penCmd as HPGLCommand]);

		elements.forEach(el => {
			if (!(el instanceof SVGGraphicsElement)) return;
			const tf = getTransformer(el, options);

			if (el instanceof SVGLineElement) {
				// <line>
				hpgl.push(PU(tf, svgVal(el.x1), svgVal(el.y1)));
				hpgl.push(PD(tf, svgVal(el.x2), svgVal(el.y2)));
				return;
			} else if (el instanceof SVGPolylineElement || el instanceof SVGPolygonElement) {
				// <polyline> / <polygon>
				// Same element, except for polygon being closed
				const points: [number, number][] = Array.from(el.points).map(({ x, y }) => [x, y]);
				hpgl.push(...PUD(tf, points));
				if (el instanceof SVGPolygonElement && points[0]) hpgl.push(PD(tf, ...points[0]));
				return;
			} else if (el instanceof SVGCircleElement) {
				// <circle>
				const { cx, cy, r } = svgVals(el, ['cx', 'cy', 'r']);
				const circum = 2 * Math.PI * r;
				const segments = circum * segmentsPerUnit;
				hpgl.push(PU(tf, cx + r, cy));
				hpgl.push(...getArcPoints(cx, cy, r, r, 0, 2 * Math.PI, segments).map(pt => PD(tf, ...pt)));
				return;
			} else if (el instanceof SVGEllipseElement) {
				// <ellipse>
				const { cx, cy, rx, ry } = svgVals(el, ['cx', 'cy', 'rx', 'ry']);
				const circum = Math.PI * (rx + ry); // approx.
				const segments = circum * segmentsPerUnit;
				hpgl.push(PU(tf, cx + rx, cy));
				hpgl.push(...getArcPoints(cx, cy, rx, ry, 0, 2 * Math.PI, segments).map(pt => PD(tf, ...pt)));
				return;
			} else if (el instanceof SVGRectElement) {
				// <rect>
				const { width: w, height: h, x, y } = svgVals(el, ['width', 'height', 'x', 'y']);
				const rx = Math.min(w / 2, svgVal(el.rx) || svgVal(el.ry) || 0);
				const ry = Math.min(h / 2, svgVal(el.ry) || svgVal(el.rx) || 0);
				if (!rx || !ry) {
					hpgl.push(PU(tf, x, y));
					hpgl.push(PD(tf, x + w, y));
					hpgl.push(PD(tf, x + w, y + h));
					hpgl.push(PD(tf, x, y + h));
					hpgl.push(PD(tf, x, y));
				} else {
					const circum = 0.25 * Math.PI * (rx + ry); // approx.
					const segments = circum * segmentsPerUnit;
					hpgl.push(
						...PUD(tf, [
							...getArcPoints(x + rx, y + ry, rx, ry, Math.PI, 1.5 * Math.PI, segments),
							...getArcPoints(x + w - rx, y + ry, rx, ry, 1.5 * Math.PI, 2 * Math.PI, segments),
							...getArcPoints(x + w - rx, y + h - ry, rx, ry, 0, 0.5 * Math.PI, segments),
							...getArcPoints(x + rx, y + h - ry, rx, ry, 0.5 * Math.PI, Math.PI, segments),
							[x, y + ry],
						])
					);
				}
				return;
			} else if (el instanceof SVGPathElement) {
				// <path>
				const d = el.getAttribute('d');
				if (!d) return;
				let currX = 0;
				let currY = 0;
				let quadC1: [number, number] = [0, 0]; // only kept for consecutive T cmds
				function updateCurr(ins: PathInstruction) {
					if ('x' in ins) currX = ins.x;
					if ('y' in ins) currY = ins.y;
				}
				const instructions = parseSvgPath(d);
				// console.log('Path', instructions);
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
						const points = getCubicBezierPoints(
							[currX, currY],
							[ins.x1, ins.y1],
							[ins.x2, ins.y2],
							[ins.x, ins.y],
							bezRes
						);
						hpgl.push(...PUD(tf, points));
					} else if (cmd === 'S') {
						// If the previous command was cubic bézier (C or S): Reflect the second control point.
						// If the previous command was anything else: Treat the first control point as the current point.
						const preIns = instructions[insI - 1];
						const preHasC2 = preIns && 'x2' in preIns && 'y2' in preIns;
						const x1 = preHasC2 ? 2 * currX - preIns.x2 : currX;
						const y1 = preHasC2 ? 2 * currY - preIns.y2 : currY;
						const points = getCubicBezierPoints(
							[currX, currY],
							[x1, y1],
							[ins.x2, ins.y2],
							[ins.x, ins.y],
							bezRes
						);
						hpgl.push(...PUD(tf, points));
					} else if (cmd === 'Q') {
						quadC1 = [ins.x1, ins.y1];
						const points = getQuadraticBezierPoints([currX, currY], quadC1, [ins.x, ins.y], bezRes);
						hpgl.push(...PUD(tf, points));
					} else if (cmd === 'T') {
						// If the previous command was quadratic bézier (Q or T): Reflect the first control point.
						// If the previous command was anything else: Treat the first control point as the current point.
						const preCmd = instructions[insI - 1]?.cmd;
						const preWasQuad = preCmd === 'Q' || preCmd === 'T';
						quadC1 = preWasQuad ? [2 * currX - quadC1[0], 2 * currY - quadC1[1]] : [currX, currY];
						const points = getQuadraticBezierPoints([currX, currY], quadC1, [ins.x, ins.y], bezRes);
						hpgl.push(...PUD(tf, points));
					} else if (cmd === 'A') {
						// endpoint-of-arc (absolute coords)
						const [x1, y1] = [currX, currY];
						const { x: x2, y: y2, fa, fs } = ins;
						const phi = (ins.rot * Math.PI) / 180; // → radians

						// 1) Compute (x1′,y1′)
						const dx2 = (x1 - x2) / 2;
						const dy2 = (y1 - y2) / 2;
						const x1p = Math.cos(phi) * dx2 + Math.sin(phi) * dy2;
						const y1p = -Math.sin(phi) * dx2 + Math.cos(phi) * dy2;

						// 2) Ensure radii are large enough
						const λ = (x1p * x1p) / (ins.rx * ins.rx) + (y1p * y1p) / (ins.ry * ins.ry);
						const scaleRad = λ <= 1 ? 1 : Math.sqrt(λ);
						const rx = ins.rx * scaleRad;
						const ry = ins.ry * scaleRad;

						// 3) Compute center′ (cx′,cy′)
						const sign = fa === fs ? -1 : 1;
						const num = rx * rx * (ry * ry) - rx * rx * (y1p * y1p) - ry * ry * (x1p * x1p);
						const den = rx * rx * (y1p * y1p) + ry * ry * (x1p * x1p);
						const coef = sign * Math.sqrt(Math.max(0, num / den));
						const cxp = coef * ((rx * y1p) / ry);
						const cyp = coef * ((-ry * x1p) / rx);

						// 4) Center in original coords
						const cx = Math.cos(phi) * cxp - Math.sin(phi) * cyp + (x1 + x2) / 2;
						const cy = Math.sin(phi) * cxp + Math.cos(phi) * cyp + (y1 + y2) / 2;

						// 5) Angles
						function vectorAngle(ux: number, uy: number, vx: number, vy: number) {
							const dot = ux * vx + uy * vy;
							const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
							let ang = Math.acos(Math.min(1, Math.max(-1, dot / len)));
							if (ux * vy - uy * vx < 0) ang = -ang;
							return ang;
						}
						const θ1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
						let Δθ = vectorAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
						if (!fs && Δθ > 0) Δθ -= 2 * Math.PI;
						else if (fs && Δθ < 0) Δθ += 2 * Math.PI;

						// 6) Compute arc length (Ramanujan's approximation for full ellipse circum)
						const h = (rx - ry) ** 2 / (rx + ry) ** 2;
						const fullCircLength = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
						const frac = Math.abs(Δθ) / (2 * Math.PI);
						const arcLength = fullCircLength * frac;

						// 7) Sample the arc
						const segments = Math.max(2, Math.round(segmentsPerUnit * arcLength));
						const rawPoints = getArcPoints(cx, cy, rx, ry, θ1, θ1 + Δθ, segments);

						// 8) Rotate each back by phi
						const points: [number, number][] = rawPoints.map(([x, y]) => {
							const dx = x - cx;
							const dy = y - cy;
							return [
								cx + (Math.cos(phi) * dx - Math.sin(phi) * dy),
								cy + (Math.sin(phi) * dx + Math.cos(phi) * dy),
							];
						});
						hpgl.push(...PUD(tf, points));
					} else if (cmd === 'Z') {
						const firstIns = instructions[0];
						const firstX = firstIns?.cmd === 'M' ? firstIns.x : 0;
						const firstY = firstIns?.cmd === 'M' ? firstIns.y : 0;
						hpgl.push(PD(tf, firstX, firstY));
					}
					updateCurr(ins);
				});
				return;
			}
		});
	});

	return hpgl;
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

/** Returns unified color syntax, like `rgb(255, 0, 0)` */
export function getSVGStrokeColors(svg: SVGSVGElement): string[] {
	return Object.keys(getSVGStrokedElements(svg));
}

/** Returns unified color syntax, like `rgb(255, 0, 0)` */
export function getSVGStrokedElements(svg: SVGSVGElement): Record<string, SVGGraphicsElement[]> {
	const svgEls = svg.querySelectorAll<SVGGraphicsElement>('line, polyline, polygon, circle, ellipse, rect, path');
	const strokeEls: Record<string, SVGGraphicsElement[]> = {};
	svgEls.forEach(el => {
		const stroke = getComputedStyle(el).getPropertyValue('stroke');
		if (!stroke || stroke === 'none') return;
		strokeEls[stroke] ??= [];
		strokeEls[stroke].push(el);
	});
	return strokeEls;
}

function grabElementsByStroke(
	strokeEls: ReturnType<typeof getSVGStrokedElements>,
	stroke: PenSelector['stroke']
): SVGGraphicsElement[] {
	if (typeof stroke === 'string') {
		return strokeEls[stroke] || [];
	} else if (Array.isArray(stroke)) {
		return stroke.map(s => strokeEls[s] || []).flat();
	} else {
		return Object.values(strokeEls).flat();
	}
}
