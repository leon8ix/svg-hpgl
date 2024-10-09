declare module 'adaptive-bezier-curve' {
	function getBezierPoints(
		start: [number, number],
		c1: [number, number],
		c2: [number, number],
		end: [number, number],
		scale?: number
	): Array<[number, number]>;

	export = getBezierPoints;
}
