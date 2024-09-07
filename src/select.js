import { fmtPoint, parseCommands, fmtCommands, rectsOverlap, matrixScale, getTransform, setTransform } from './helpers.js';
const xmlns = 'http://www.w3.org/2000/svg';

export class Select {
	/** @param {SVGSVGElement} svg */
	constructor(svg) {
		this.svg = svg;

		/** @type {SVGGElement} */
		this.view = svg.getElementById('view');
		/** @type {SVGGElement} */
		this.ui = svg.getElementById('ui');
		/** @type {SVGPathElement} */
		this.selectDrag = svg.getElementById('selectDrag');
		/** @type {SVGPathElement} */
		this.selectGroup = svg.getElementById('selectGroup');
		this.selectable = 'g.span';
	}

	/**
	 * @param {PointerEvent} ev
	 * @param {string} tool
	 */
	pointerdown(ev, tool) {
		this.pos = new DOMPoint(ev.x, ev.y);
		this.posView = this.toViewport(ev.x, ev.y);

		if (tool != 'select') return;
		/** @type {SVGElement} */
		const selectable = ev.target.closest(this.selectable);
		if (ev.shiftKey) {
			this.add = true;
		} else {
			this.selectNone();
		}
		if (selectable) {
			this.posView = undefined; // don't make a select box
			selectable.classList.toggle('selected');
			this.updateSelectGroup();
			return true;
		}
	}

	/**
	 * @param {PointerEvent} ev
	 * @param {string} tool
	 * */
	pointermove(ev, tool) {
		// const posOld = this.pos;
		// this.pos = new DOMPoint(ev.x, ev.y);
		// const clientDx = this.pos.x - posOld.x;
		// const clientDy = this.pos.y - posOld.y;
		// const scale = matrixScale(this.svg.getScreenCTM()) * matrixScale(getTransform(this.svg.firstElementChild));
		// const d = new DOMPoint(clientDx / scale, clientDy / scale);

		// if (this.movingPathPoint) {
		// 	/** @type {SVGGElement} */
		// 	const span = this.movingPathPoint.parentElement.parentElement;
		// 	const spanTransform = getTransform(span);
		// 	d.x /= matrixScale(spanTransform);
		// 	d.y /= matrixScale(spanTransform);
		// 	const point = new DOMPoint(
		// 		this.movingPathPoint.cx.baseVal.value + d.x,
		// 		this.movingPathPoint.cy.baseVal.value + d.y,
		// 	);
		// 	// move circle
		// 	this.movingPathPoint.cx.baseVal.value = point.x;
		// 	this.movingPathPoint.cy.baseVal.value = point.y;
		// 	const cmdI = +this.movingPathPoint.getAttribute('data-command');
		// 	const pointI = +this.movingPathPoint.getAttribute('data-point');
		// 	// move path
		// 	this.commands[cmdI].coords[pointI] = point.x;
		// 	this.commands[cmdI].coords[pointI + 1] = point.y;
		// 	this.path.setAttribute('d', fmtCommands(this.commands));
		// 	this.path.nextElementSibling.setAttribute('textLength', this.path.getTotalLength());

		// 	this.updateSelectGroup();

		// 	return true;
		// } else if (this.movingSelected) {
		// 	const transform = this.svg.createSVGMatrix().translate(d.x, d.y);
		// 	const selections = this.view.getElementsByClassName('selected');
		// 	for (let i = 0; i < selections.length; i++) {
		// 		/** @type {SVGGElement | SVGImageElement} */
		// 		const selectable = selections[i];
		// 		setTransform(selectable, transform.multiply(getTransform(selectable)));
		// 	}

		// 	this.updateSelectGroup();
		// 	return true;
		// }

		const start = this.posView;
		if (!start) return;
		const pos = this.toViewport(ev.x, ev.y);
		const width = (pos.x - start.x).toFixed(0);
		const height = (pos.y - start.y).toFixed(0);

		this.selectDrag.setAttribute('d', `M${fmtPoint(start)} h${width} v${height} h${-width}Z`);

		if (tool == 'select') {
			const selectDragBBox = this.selectDrag.getBoundingClientRect();
			const selectable = this.view.querySelectorAll(this.selectable);

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
		}

		return true;
	}

	pointerup() {
		const selections = this.view.getElementsByClassName('boxed');
		for (let i = 0; i < selections.length; i++) selections[i].classList.remove('boxed');

		this.selectDrag.setAttribute('d', '');
		this.pos = undefined;
		this.posView = undefined;
		this.add = undefined;
	}

	/**
	 * Resize selection group box.
	 * Start path editing if there is only one selection.
	 * @param {boolean} startEdit
	 * @returns {boolean} if there is only a single selection
	 */
	updateSelectGroup() {
		const selections = this.view.getElementsByClassName('selected');
		const min = new DOMPoint(Infinity, Infinity);
		const max = new DOMPoint(-Infinity, -Infinity);
		this.selectGroup.setAttribute('d', '');
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
			this.selectGroup.setAttribute('d', `M${min.x},${min.y} h${max.x - min.x} v${max.y - min.y} h${min.x - max.x}Z`);
		}
	}

	selectNone() {
		for (let i = 0; i < this.view.children.length; i++) {
			this.view.children[i].classList.remove('selected');
		}
		this.selectGroup.setAttribute('d', '');
		this.selectGroup.setAttribute('transform', new DOMMatrix().toString());
	}

	/**
	 * @param {SVGGElement} span
	 */
	startPathEdit(span) {
		if (span.contains(this.pathPoints) && this.pathPoints.children.length > 0 || span.tagName != 'g') return;
		this.pathPoints.replaceChildren();
		span.append(this.pathPoints);
		/** @type {SVGPathElement} */
		this.path = span.firstElementChild;
		this.commands = parseCommands(this.path.getAttribute('d'));
		for (let i = 0; i < this.commands.length; i++) {
			const cmd = this.commands[i];
			for (let j = 0; j < cmd.coords.length; j += 2) {
				const circle = document.createElementNS(xmlns, 'circle');
				circle.cx.baseVal.value = cmd.coords[j * 2];
				circle.cy.baseVal.value = cmd.coords[j * 2 + 1];
				circle.setAttribute('data-command', i.toString());
				circle.setAttribute('data-point', (j * 2).toString());
				this.pathPoints.append(circle);
			}
		}
	}

	/**
	 * @param {clientX} number
	 * @param {clientY} number
	 */
	toViewport(clientX, clientY) {
		return new DOMPoint(clientX, clientY)
			.matrixTransform(this.svg.getScreenCTM().multiply(getTransform(this.view)).inverse())
	}
}
