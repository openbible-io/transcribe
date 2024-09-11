import { matrixScale, getTransform, setTransform, selectableSelector, toViewport } from './helpers.js';

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
		/** @type {SVGPathElement} */
		this.selectGroup = svg.getElementById('selectGroup');
		/** @type {SVGPathElement} */
		this.selectGroupTop = svg.getElementById('selectGroupTop');
		/** @type {SVGPathElement} */
		this.selectGroupBot = svg.getElementById('selectGroupBot');

		this.selectGroupTop.addEventListener('pointerdown', this.pointerdownControl.bind(this));
		this.selectGroupBot.addEventListener('pointerdown', this.pointerdownControl.bind(this));
	}

	/** @param {PointerEvent} ev */
	pointerdown(ev) {
		this.pos = new DOMPoint(ev.x, ev.y);
		const selectable = ev.target.closest(selectableSelector);
		if (selectable && selectable.classList.contains('selected')) {
			this.translating = true;
		}
	}

	/** @param {PointerEvent} ev */
	pointerdownControl(ev) {
		const bbox = this.selectGroup.getBBox();
		/** @type {DOMPoint} */
		this.posView = toViewport(this.svg, ev.x, ev.y);
		this.scaleOrigin = new DOMPoint(
			bbox.x,
			bbox.y + (ev.target == this.selectGroupTop ? bbox.height : 0),
		);
		ev.stopPropagation();
	}

	/** @param {PointerEvent} ev */
	pointermove(ev) {
		if (this.translating || this.scaleOrigin) {
			let transform = new DOMMatrix();
			if (this.translating) {
				const posOld = this.pos;
				this.pos = new DOMPoint(ev.x, ev.y);
				const clientDx = this.pos.x - posOld.x;
				const clientDy = this.pos.y - posOld.y;
				const scale = matrixScale(this.svg.getScreenCTM()) * matrixScale(getTransform(this.view));
				const d = new DOMPoint(clientDx / scale, clientDy / scale);
				transform = transform.translate(d.x, d.y);
			}
			if (this.scaleOrigin) {
				const posViewOld = this.posView;
				this.posView = DOMPoint.fromPoint(ev.posView);
				transform = transform
					.translate(this.scaleOrigin.x, this.scaleOrigin.y);
				transform.d *= (this.posView.y - this.scaleOrigin.y) / (posViewOld.y - this.scaleOrigin.y);
				transform = transform
					.translate(-this.scaleOrigin.x, -this.scaleOrigin.y);
			}
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
		const res = this.translating || this.scaling;
		this.translating = undefined;
		this.scaleOrigin = undefined;
		this.posView = undefined;
		return res;
	}
}
