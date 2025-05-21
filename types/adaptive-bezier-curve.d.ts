declare module 'adaptive-bezier-curve' {
	function getCubicBezierPoints(
		start: [number, number],
		c1: [number, number],
		c2: [number, number],
		end: [number, number],
		scale?: number
	): Array<[number, number]>;

	export = getCubicBezierPoints;
}
