import { fmtPoint, parseCommands, fmtCommands, rectsOverlap, matrixScale, getTransform, setTransform, selectableSelector } from './helpers.js';

export class Transform {
	/**
	 * @param {SVGSVGElement} svg
	 * @param {() => void} updateSelectGroup
	 */
	constructor(svg, updateSelectGroup) {
		/** @type {SVGSVGElement} */
		this.svg = svg;
		this.updateSelectGroup = updateSelectGroup;

		/** @type {SVGGElement} */
		this.view = svg.getElementById('view');
		/** @type {SVGGElement} */
		this.pathPoints = svg.getElementById('pathPoints');
	}

	/**
	 * @param {PointerEvent} ev
	 * @param {string} tool
	 */
	pointerdown(ev, tool) {
		this.pos = new DOMPoint(ev.x, ev.y);
		const selectable = ev.target.closest(selectableSelector);
		if (selectable && selectable.classList.contains('selected')) {
			this.translating = true;
		}
	}

	/**
	 * @param {PointerEvent} ev
	 * @param {string} tool
	 */
	pointermove(ev, tool) {
		if (this.translating) {
			const posOld = this.pos;
			this.pos = new DOMPoint(ev.x, ev.y);
			const clientDx = this.pos.x - posOld.x;
			const clientDy = this.pos.y - posOld.y;
			const scale = matrixScale(this.svg.getScreenCTM()) * matrixScale(getTransform(this.view));
			const d = new DOMPoint(clientDx / scale, clientDy / scale);

			const transform = this.svg.createSVGMatrix().translate(d.x, d.y);
			const selections = this.view.getElementsByClassName('selected');
			for (let i = 0; i < selections.length; i++) {
				/** @type {SVGGElement | SVGImageElement} */
				const selectable = selections[i];
				setTransform(selectable, transform.multiply(getTransform(selectable)));
			}

			this.updateSelectGroup();
			return true;
		}
	}

	pointerup() {
		this.translating = undefined;
	}
}
