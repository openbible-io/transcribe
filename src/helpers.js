class Color {
	/**
	 * @param {string} str
	 */
	constructor(str) {
		if (str.startsWith('rgb(')) {
			const val = str.substring(4, str.length - 1);
			const split = val.split(',').map(s => parseInt(s.trim()));
			this.r = split[0];
			this.g = split[1];
			this.b = split[2];
		} else {
			throw Error('could not parse color ' + str);
		}
	}

	toHex() {
		return '#' + [this.r, this.g, this.b].map(v => v.toString(16).padStart(2, '0')).join('');
	}
}

/**
 * @param {DOMMatrix} matrix
 */
export function matrixScale(matrix) {
	return Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
}
/**
 * @param {DOMPoint} p
 */
export function fmtPoint(p) {
	return `${p.x.toFixed(0)},${p.y.toFixed(0)}`;
}
/**
 * @param {DOMRectReadOnly} a
 * @param {DOMRectReadOnly} b
 */
export function rectsOverlap(a, b) {
	return !(a.top > b.bottom || a.right < b.left || a.bottom < b.top || a.left > b.right);
}
/**
 * @param {string} path
 */
export function parseCommands(path) {
	return path
		.split(' ')
		.map(str => ({
			command: str[0],
			coords: str.substring(1).split(',').map(n => Number.parseFloat(n)),
		}));
}
/**
 * @param {ReturnType<parseCommands>} cmds
 */
export function fmtCommands(cmds) {
	return cmds
		.map(cmd => `${cmd.command}${cmd.coords.join(',')}`)
		.join(' ');
}
