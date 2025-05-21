import { SVGtoHPGLOptions } from '.';
import { svgVal } from './utils';

export function getTransformer(
	element: SVGGraphicsElement,
	{ offsetX = 0, offsetY = 0, rotation = 0, scale = 1, mirrorX = false, mirrorY = false }: SVGtoHPGLOptions
): (x: number, y: number) => [number, number] {
	const rootSVG = getRootSVG(element);

	if (!rootSVG) {
		console.warn('Could not retrieve ownerSVGElement');
		return (x: number, y: number) => [Math.round(x), Math.round(y)];
	}
	const familyTree = getSVGFamilyTree(element);
	// console.log('getTransformer', familyTree);

	let ctm = rootSVG.createSVGMatrix();
	let elCTM: DOMMatrix | undefined;

	for (const el of familyTree) {
		if (el instanceof SVGSVGElement) {
			// console.log('SVGSVGElement');
			elCTM = getSVGSVGElementTransform(el);
		} else if (el instanceof SVGGraphicsElement) {
			// console.log('SVGGraphicsElement');
			elCTM = el.transform.baseVal.consolidate()?.matrix;
		} else {
			elCTM = undefined;
		}
		// console.log({ elCTM, el });
		if (elCTM) ctm = elCTM.multiply(ctm);
	}

	// Merge in manually specified transformations
	let userCTM = rootSVG.createSVGMatrix().translate(offsetX, offsetY);
	if (mirrorX) userCTM = userCTM.flipX();
	if (mirrorY) userCTM = userCTM.flipY();
	userCTM = userCTM.rotate(rotation).scale(scale);
	ctm = userCTM.multiply(ctm);

	const point = rootSVG.createSVGPoint();
	// Return a transformed coordinate function
	return (x: number, y: number) => {
		point.x = x;
		point.y = y;
		const transformedPoint = point.matrixTransform(ctm);
		return [Math.round(transformedPoint.x), Math.round(transformedPoint.y)];
	};
}

function getSVGSVGElementTransform(currSVG: SVGSVGElement) {
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
		} else {
			scaleX = scaleY = Math.min(scaleX, scaleY); // meet / contain / default
		}

		// Apply alignment adjustments
		const alignX = align % 3; // xMin(1), xMid(2), xMax(3)
		const alignY = Math.floor(align / 3); // yMin(1), yMid(2), yMax(3)

		if (alignX === 2) translateX += (pos.w - view.w * scaleX) / 2; // xMid
		if (alignX === 3) translateX += pos.w - view.w * scaleX; // xMax

		if (alignY === 2) translateY += (pos.h - view.h * scaleY) / 2; // yMid
		if (alignY === 3) translateY += pos.h - view.h * scaleY; // yMax
	}
	// console.log('Handling SVG scaling', { currSVG, translateX, translateY, scaleX, scaleY });

	// Account for <svg> x, y offset, and scale to viewBox with adjusted origin
	return rootSVG.createSVGMatrix().translate(translateX, translateY).scale(scaleX, scaleY);
}

/** Finds the root SVGSVGElement, even for nested SVGs */
function getRootSVG(element: SVGGraphicsElement): SVGSVGElement | null {
	let svg = element.ownerSVGElement;
	while (svg?.ownerSVGElement) svg = svg.ownerSVGElement;
	return svg;
}

/** Retrieves the whole ancestry of SVGs as well as nested SVGs going from child to root SVG */
function getSVGFamilyTree(element: SVGElement): SVGElement[] {
	const tree: SVGElement[] = [];
	let currEl: ParentNode | null = element;
	while (currEl instanceof SVGElement) {
		tree.push(currEl);
		currEl = currEl.parentNode;
	}
	return tree;
}
