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
 * @param {DOMMatrix} m
 */
export function matrixScale(m) {
	return Math.sqrt(m.a ** 2 + m.b ** 2);
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

/**
 * @param {SVGElement} g
 * @returns {SVGMatrix}
 */
export function getTransform(g) {
	return g?.transform?.baseVal[0]?.matrix ?? g.ownerSVGElement.createSVGMatrix();
}
/**
 * @param {SVGElement} svg
 * @param {DOMMatrix} newValue
 */
export function setTransform(g, newValue) {
	// While more efficient, this doesn't reflect back to DOM and so is undesirable.
	// g.transform.baseVal[0].setMatrix(newValue);
	g.setAttribute('transform', `matrix(${newValue.a}, ${newValue.b}, ${newValue.c}, ${newValue.d}, ${newValue.e}, ${newValue.f})`);
}
