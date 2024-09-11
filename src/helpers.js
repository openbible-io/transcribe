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

/** @param {DOMMatrix} m */
export function matrixScale(m) {
	return Math.sqrt(m.a ** 2 + m.c ** 2);
}
/** @param {DOMPoint} p */
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
 * Parses commands in `Ax,y Bx,y` format.
 * Yes, there are libraries to properly do this if we need
 * to support more path commands and formats.
 *
 * @param {string} path
 */
export function parseCommands(path) {
	return path
		.split(' ')
		.map(str => {
			const pts = str.substring(1).split(',').map(n => Number.parseFloat(n));
			const coords = [];
			for (let i = 0; i < pts.length; i += 2) {
				coords.push(new DOMPoint(pts[i * 2], pts[i * 2 + 1]));
			}
			return { command: str[0], coords };
		});
}
/** @param {ReturnType<parseCommands>} cmds */
export function fmtCommands(cmds) {
	return cmds
		.map(cmd => `${cmd.command}${cmd.coords.map(c => `${c.x},${c.y}`).join(',')}`)
		.join(' ');
}
/** @param {SVGElement} g */
export function getTransform(g) {
	return new DOMMatrix(g.getAttribute('transform') ?? '');
}
/**
 * @param {SVGElement} g
 * @param {DOMMatrix} newValue
 */
export function setTransform(g, newValue) {
	g.setAttribute('transform', newValue.toString());
}

export const xmlns = 'http://www.w3.org/2000/svg';
export const selectableSelector = 'g.span';

/**
 * @param {SVGSVGElement} svg
 * @param {number} clientX
 * @param {number} clientY
 */
export function toViewport(svg, clientX, clientY) {
	const view = svg.getElementById('view');
	return new DOMPoint(clientX, clientY)
		.matrixTransform(svg.getScreenCTM().multiply(view.transform.baseVal[0].matrix).inverse())
}
