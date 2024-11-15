"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHPGL = buildHPGL;
exports.svgToHPGL = svgToHPGL;
exports.hpglFindBBox = hpglFindBBox;
exports.drawHPGL = drawHPGL;
exports.getSVGStrokeColors = getSVGStrokeColors;
const svg_path_1 = require("./svg-path");
const adaptive_bezier_curve_1 = __importDefault(require("adaptive-bezier-curve"));
function buildHPGL(program, prefix = '', suffix = '') {
    return prefix + program.map(([cmd, ...vals]) => cmd + vals.join(',') + ';').join('') + suffix;
}
function svgToHPGL(svg, pens = [{ pen: 1 }], options = {}) {
    const hpgl = [['PA']];
    const { segmentsPerUnit = 1 } = options;
    pens.forEach(({ pen, selector, stroke, cmd: penCmd }) => {
        let sel = selector;
        if (Array.isArray(stroke))
            sel ??= stroke.map(s => `[stroke="${s}"]`).join(',');
        if (stroke)
            sel ??= `[stroke="${stroke}"]`;
        sel ??= '[stroke]';
        const elements = svg.querySelectorAll(sel);
        if (!elements.length)
            return;
        hpgl.push([`SP${pen}`], ['PU']);
        if (penCmd)
            hpgl.push([penCmd]);
        elements.forEach(el => {
            if (!(el instanceof SVGGraphicsElement))
                return;
            const tf = getTransformer(el, options);
            if (el instanceof SVGLineElement) {
                // <line>
                hpgl.push(PU(tf, svgVal(el.x1), svgVal(el.y1)));
                hpgl.push(PD(tf, svgVal(el.x2), svgVal(el.y2)));
                return;
            }
            else if (el instanceof SVGPolylineElement) {
                // <polyline>
                const points = el.points;
                if (points[0])
                    hpgl.push(PU(tf, points[0]?.x, points[0]?.y));
                for (const pt of points)
                    hpgl.push(PD(tf, pt.x, pt.y));
                return;
            }
            else if (el instanceof SVGCircleElement) {
                // <circle>
                const { cx, cy, r } = svgVals(el, ['cx', 'cy', 'r']);
                const circum = 2 * Math.PI * r;
                const segments = circum * segmentsPerUnit;
                hpgl.push(PU(tf, cx + r, cy));
                hpgl.push(...getArcPoints(cx, cy, r, r, 0, 2 * Math.PI, segments).map(pt => PD(tf, ...pt)));
                return;
            }
            else if (el instanceof SVGEllipseElement) {
                // <ellipse>
                const { cx, cy, rx, ry } = svgVals(el, ['cx', 'cy', 'rx', 'ry']);
                const circum = Math.PI * (rx + ry); // approx.
                const segments = circum * segmentsPerUnit;
                hpgl.push(PU(tf, cx + rx, cy));
                hpgl.push(...getArcPoints(cx, cy, rx, ry, 0, 2 * Math.PI, segments).map(pt => PD(tf, ...pt)));
                return;
            }
            else if (el instanceof SVGRectElement) {
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
                }
                else {
                    const circum = 0.25 * Math.PI * (rx + ry); // approx.
                    const segments = circum * segmentsPerUnit;
                    hpgl.push(...PUD(tf, [
                        ...getArcPoints(x + rx, y + ry, rx, ry, Math.PI, 1.5 * Math.PI, segments),
                        ...getArcPoints(x + w - rx, y + ry, rx, ry, 1.5 * Math.PI, 2 * Math.PI, segments),
                        ...getArcPoints(x + w - rx, y + h - ry, rx, ry, 0, 0.5 * Math.PI, segments),
                        ...getArcPoints(x + rx, y + h - ry, rx, ry, 0.5 * Math.PI, Math.PI, segments),
                        [x, y + ry],
                    ]));
                }
                return;
            }
            else if (el instanceof SVGPathElement) {
                // <path>
                const d = el.getAttribute('d');
                if (!d)
                    return;
                let currX = 0;
                let currY = 0;
                function updateCurr(ins) {
                    if ('x' in ins)
                        currX = ins.x;
                    if ('y' in ins)
                        currY = ins.y;
                }
                const instructions = (0, svg_path_1.parsePath)(d);
                // console.log('Path', instructions);
                instructions.forEach((ins, insI) => {
                    const { cmd } = ins;
                    if (cmd === 'M') {
                        hpgl.push(PU(tf, ins.x, ins.y));
                    }
                    else if (cmd === 'L') {
                        hpgl.push(PD(tf, ins.x, ins.y));
                    }
                    else if (cmd === 'H') {
                        hpgl.push(PD(tf, ins.x, currY));
                    }
                    else if (cmd === 'V') {
                        hpgl.push(PD(tf, currX, ins.y));
                    }
                    else if (cmd === 'C') {
                        const points = (0, adaptive_bezier_curve_1.default)([currX, currY], [ins.x1, ins.y1], [ins.x2, ins.y2], [ins.x, ins.y], 10);
                        hpgl.push(...PUD(tf, points));
                    }
                    else if (cmd === 'S') {
                        // If the previous command was cubic Bézier (C or S): Reflect the second control point.
                        // If the previous command was anything else: Treat the first control point as the current point.
                        const preCmd = instructions[insI - 1];
                        const preHasC2 = preCmd && 'x2' in preCmd && 'y2' in preCmd;
                        const x1 = preHasC2 ? 2 * currX - preCmd.x2 : currX;
                        const y1 = preHasC2 ? 2 * currY - preCmd.y2 : currY;
                        const points = (0, adaptive_bezier_curve_1.default)([currX, currY], [x1, y1], [ins.x2, ins.y2], [ins.x, ins.y], 10);
                        hpgl.push(...PUD(tf, points));
                        updateCurr(ins);
                    }
                    else if (cmd === 'Q') {
                        // TODO
                    }
                    else if (cmd === 'T') {
                        // TODO
                    }
                    else if (cmd === 'A') {
                        // TODO
                    }
                    else if (cmd === 'Z') {
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
function getTransformer(element, { offsetX = 0, offsetY = 0, rotation = 0, scale = 1 }) {
    const rootSVG = getRootSVG(element);
    if (!rootSVG) {
        console.warn('Could not retrieve ownerSVGElement');
        return (x, y) => [Math.round(x), Math.round(y)];
    }
    const familyTree = getSVGFamilyTree(element);
    // console.log('getTransformer', familyTree);
    let ctm = rootSVG.createSVGMatrix();
    let elCTM;
    for (const el of familyTree) {
        if (el instanceof SVGSVGElement) {
            // console.log('SVGSVGElement');
            elCTM = getSVGSVGElementTransform(el);
        }
        else if (el instanceof SVGGraphicsElement) {
            // console.log('SVGGraphicsElement');
            elCTM = el.transform.baseVal.consolidate()?.matrix;
        }
        else {
            elCTM = undefined;
        }
        // console.log({ elCTM, el });
        if (elCTM)
            ctm = elCTM.multiply(ctm);
    }
    // Merge in manually specified transformations
    const userCTM = rootSVG.createSVGMatrix().translate(offsetX, offsetY).rotate(rotation).scale(scale);
    ctm = userCTM.multiply(ctm);
    const point = rootSVG.createSVGPoint();
    // Return a transformed coordinate function
    return (x, y) => {
        point.x = x;
        point.y = y;
        const transformedPoint = point.matrixTransform(ctm);
        return [Math.round(transformedPoint.x), Math.round(transformedPoint.y)];
    };
}
function getSVGSVGElementTransform(currSVG) {
    const rootSVG = currSVG.ownerSVGElement || currSVG;
    const pos = {
        x: svgVal(currSVG.x),
        y: svgVal(currSVG.y),
        w: svgVal(currSVG.width) || rootSVG.viewBox.baseVal.width,
        h: svgVal(currSVG.height) || rootSVG.viewBox.baseVal.height,
    };
    const view = {
        x: currSVG.viewBox.baseVal.x || 0,
        y: currSVG.viewBox.baseVal.y || 0,
        w: currSVG.viewBox.baseVal.width || pos.w,
        h: currSVG.viewBox.baseVal.height || pos.h,
    };
    // Handle preserveAspectRatio alignment
    const preserveAspectRatio = currSVG.preserveAspectRatio.baseVal;
    const align = preserveAspectRatio.align;
    const meetOrSlice = preserveAspectRatio.meetOrSlice;
    // align === SVGPreserveAspectRatio.SVG_PRESERVEASPECTRATIO_NONE
    let scaleX = pos.w / view.w;
    let scaleY = pos.h / view.h;
    let translateX = pos.x - view.x;
    let translateY = pos.y - view.y;
    // console.log('align', SVGPreserveAspectRatio.SVG_PRESERVEASPECTRATIO_NONE === align, align, scaleX, scaleY);
    if (align !== SVGPreserveAspectRatio.SVG_PRESERVEASPECTRATIO_NONE) {
        if (meetOrSlice === SVGPreserveAspectRatio.SVG_MEETORSLICE_SLICE) {
            scaleX = scaleY = Math.max(scaleX, scaleY); // slice / fill
        }
        else {
            scaleX = scaleY = Math.min(scaleX, scaleY); // meet / contain / default
        }
        // Apply alignment adjustments
        const alignX = align % 3; // xMin(1), xMid(2), xMax(3)
        const alignY = Math.floor(align / 3); // yMin(1), yMid(2), yMax(3)
        if (alignX === 2)
            translateX += (pos.w - view.w * scaleX) / 2; // xMid
        if (alignX === 3)
            translateX += pos.w - view.w * scaleX; // xMax
        if (alignY === 2)
            translateY += (pos.h - view.h * scaleY) / 2; // yMid
        if (alignY === 3)
            translateY += pos.h - view.h * scaleY; // yMax
    }
    // console.log('Handling SVG scaling', { currSVG, translateX, translateY, scaleX, scaleY });
    // Account for <svg> x, y offset, and scale to viewBox with adjusted origin
    return rootSVG.createSVGMatrix().translate(translateX, translateY).scale(scaleX, scaleY);
}
/** Finds the root SVGSVGElement, even for nested SVGs */
function getRootSVG(element) {
    let svg = element.ownerSVGElement;
    while (svg?.ownerSVGElement)
        svg = svg.ownerSVGElement;
    return svg;
}
/** Retrieves the whole ancestry of SVGs as well as nested SVGs going from child to root SVG */
function getSVGFamilyTree(element) {
    const tree = [];
    let currEl = element;
    while (currEl instanceof SVGElement) {
        tree.push(currEl);
        currEl = currEl.parentNode;
    }
    return tree;
}
function svgVal(prop) {
    return prop.baseVal.value || 0;
}
function svgVals(el, props) {
    const vals = {};
    for (const prop of props) {
        if (!el[prop]?.baseVal) {
            console.warn(`Prop ${String(prop)} not in Element`, el);
            continue;
        }
        vals[prop] = el[prop].baseVal.value || 0;
    }
    return vals;
}
function getArcPoints(cx, cy, rx, ry, startAngle, endAngle, 
/** Will be rounded and changed to min of `2` */
segments) {
    segments = Math.max(2, Math.round(segments));
    const arcPoints = [];
    for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (i * (endAngle - startAngle)) / segments;
        arcPoints.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
    }
    return arcPoints;
}
function PU(tf, x, y) {
    return ['PU', ...tf(x, y)];
}
function PD(tf, x, y) {
    return ['PD', ...tf(x, y)];
}
function PUD(tf, points) {
    return points.map((pt, i) => (i === 0 ? PU(tf, ...pt) : PD(tf, ...pt)));
}
/** Implements and expects absolute coords (PA)  */
function hpglFindBBox(hpgl) {
    const cmds = ['PU', 'PD', 'PA'];
    let xMin, xMax, yMin, yMax;
    xMin = xMax = yMin = yMax = 0;
    hpgl.forEach(([cmd, x, y, ...vals]) => {
        if (cmds.includes(cmd) && x && y && vals.length === 0) {
            if (x < xMin)
                xMin = x;
            if (x > xMax)
                xMax = x;
            if (y < yMin)
                yMin = y;
            if (y > yMax)
                yMax = y;
        }
    });
    return { xMin, xMax, yMin, yMax, width: xMax - xMin, height: yMax - yMin };
}
function drawHPGL(canvas, hpgl, width, height) {
    // console.log(width, height);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('Context of canvas unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = Math.round(Math.max(width, height) / 1000);
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    hpgl.forEach(([cmd, x, y, ...vals]) => {
        // console.log({ cmd, x, y, vals });
        if (x === undefined || y === undefined || vals.length)
            return;
        if (cmd === 'PU') {
            ctx.moveTo(x, y);
        }
        else if (cmd === 'PD') {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();
}
function getSVGStrokeColors(svg) {
    const colors = new Set();
    svg.querySelectorAll('[stroke]').forEach(el => {
        const stroke = el.getAttribute('stroke');
        if (stroke)
            colors.add(stroke);
    });
    return colors;
}
//# sourceMappingURL=index.js.map