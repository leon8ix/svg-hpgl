declare module 'adaptive-quadratic-curve' {
	function getQuadraticBezierPoints(
		start: [number, number],
		c1: [number, number],
		end: [number, number],
		scale?: number
	): Array<[number, number]>;

	export = getQuadraticBezierPoints;
}
