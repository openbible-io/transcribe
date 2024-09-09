import { fmtPoint, rectsOverlap, selectableSelector } from './helpers.js';
import { Path } from './path.js';
import { Transform } from './transform.js';

export class Select {
	/** @param {SVGSVGElement} svg */
	constructor(svg) {
		/** @type {SVGSVGElement} */
		this.svg = svg;
		/** @type {SVGGElement} */
		this.view = svg.getElementById('view');
		/** @type {SVGGElement} */
		this.ui = svg.getElementById('ui');
		/** @type {SVGPathElement} */
		this.selectDrag = svg.getElementById('selectDrag');
		/** @type {SVGPathElement} */
		this.selectGroup = svg.getElementById('selectGroup');
		/** @type {SVGPathElement} */
		this.selectGroupTop = svg.getElementById('selectGroupTop');
		/** @type {SVGPathElement} */
		this.selectGroupBot = svg.getElementById('selectGroupBot');

		this.path = new Path(svg, this.updateSelectGroup.bind(this));
		this.transform = new Transform(svg, this.updateSelectGroup.bind(this));
	}

	/**
	 * @param {PointerEvent} ev
	 * @param {string} tool
	 */
	pointerdown(ev, tool) {
		this.pos = new DOMPoint(ev.x, ev.y);
		/** @type {DOMPoint} */
		this.posView = ev.posView;
		if (this.path.pointerdown(ev, tool)) return;

		if (tool != 'select') return;
		/** @type {SVGElement} */
		const selectable = ev.target.closest(selectableSelector);
		if (selectable) {
			this.posView = undefined; // don't make a select box
			if (selectable.classList.contains('selected')) {
				this.toUnselect = selectable;
			} else {
				if (!ev.shiftKey) this.selectNone();
				selectable.classList.add('selected');
				this.updateSelectGroup();
			}
			if (this.transform.pointerdown(ev, tool)) return;
			return true;
		}
	}

	/**
	 * @param {PointerEvent} ev
	 * @param {string} tool
	 */
	pointermove(ev, tool) {
		if (this.path.pointermove(ev, tool)) {
			this.moveHandled = true;
			return;
		}
		if (this.transform.pointermove(ev, tool)) {
			this.moveHandled = true;
			return;
		}

		if (tool == 'select' || tool == 'text') {
			const start = this.posView;
			if (!start) return;
			const pos = ev.posView;
			const width = (pos.x - start.x).toFixed(0);
			const height = (pos.y - start.y).toFixed(0);

			this.selectDrag.setAttribute('d', `M${fmtPoint(start)} h${width} v${height} h${-width}Z`);
			if (tool == 'text') return true;
		}

		if (tool == 'select') {
			const selectDragBBox = this.selectDrag.getBoundingClientRect();
			const selectable = this.view.querySelectorAll(selectableSelector);

			for (let i = 0; i < selectable.length; i++) {
				const c = selectable[i];
				const bbox = c.getBoundingClientRect();
				if (rectsOverlap(selectDragBBox, bbox)) {
					if (!c.classList.contains('selected')) {
						c.classList.add('selected', 'boxed');
					}
				} else if (c.classList.contains('boxed')) {
					c.classList.remove('selected', 'boxed');
				}
			}
			this.updateSelectGroup();
			return true;
		}
	}

	pointerup() {
		if (this.toUnselect && !this.moveHandled) {
			this.toUnselect.classList.remove('selected');
			this.updateSelectGroup();
		}
		this.path.pointerup();
		this.transform.pointerup();

		const boxed = this.view.getElementsByClassName('boxed');
		while (boxed.length) boxed[0].classList.remove('boxed');
		this.selectDrag.setAttribute('d', '');
		this.pos = undefined;
		this.posView = undefined;
		this.toUnselect = undefined;
		this.moveHandled = undefined;
	}

	/**
	 * Resize selection group box.
	 * Start path editing if there is only one selection.
	 * @param {boolean} startEdit
	 * @returns {boolean} if there is only a single selection
	 */
	updateSelectGroup() {
		const selections = this.view.getElementsByClassName('selected');
		if (selections.length != 1) this.path.selectNone();
		const min = new DOMPoint(Infinity, Infinity);
		const max = new DOMPoint(-Infinity, -Infinity);
		this.selectGroup.setAttribute('d', '');
		this.selectGroupTop.setAttribute('d', '');
		this.selectGroupBot.setAttribute('d', '');
		for (let i = 0; i < selections.length; i++) {
			/** @type {SVGRect} */
			const rect = selections.item(i).getBBox();
			const rectMatrix = new DOMMatrix(selections.item(i).getAttribute('transform') ?? '');
			const minPoint = new DOMPoint(rect.x, rect.y).matrixTransform(rectMatrix);
			const maxPoint = new DOMPoint(rect.x + rect.width, rect.y + rect.height).matrixTransform(rectMatrix);

			if (minPoint.x < min.x) min.x = minPoint.x;
			if (minPoint.y < min.y) min.y = minPoint.y;
			if (maxPoint.x > max.x) max.x = maxPoint.x;
			if (maxPoint.y > max.y) max.y = maxPoint.y;
		}
		if (min.x != Infinity && max.y != -Infinity) {
			const width = max.x - min.x;
			const height = max.y - min.y;
			this.selectGroup.setAttribute('d', `M${min.x},${min.y} h${width} v${height} h${-width}Z`);
			const controlWidth = 16;
			const controlX = (width - controlWidth) / 2;
			this.selectGroupTop.setAttribute('d', `M${min.x + controlX},${min.y - controlWidth / 2} h${controlWidth} v${controlWidth} h${-controlWidth}Z`);
			this.selectGroupBot.setAttribute('d', `M${min.x + controlX},${max.y - controlWidth / 2} h${controlWidth} v${controlWidth} h${-controlWidth}Z`);
		}
	}

	selectNone() {
		for (let i = 0; i < this.view.children.length; i++) {
			this.view.children[i].classList.remove('selected');
		}
		this.selectGroup.setAttribute('d', '');
		this.selectGroupTop.setAttribute('d', '');
		this.selectGroupBot.setAttribute('d', '');
		this.selectGroup.setAttribute('transform', new DOMMatrix().toString());
		this.path.selectNone();
	}
}
