import { parseCommands, fmtCommands, matrixScale, getTransform, xmlns, setTransform } from './helpers.js';

export class Path {
	/**
	 * @param {SVGSVGElement} svg
	 * @param {() => void} updateSelectGroup
	 */
	constructor(svg, updateSelectGroup) {
		/** @type {SVGAVGElement} */
		this.svg = svg;
		this.updateSelectGroup = updateSelectGroup;

		/** @type {SVGGElement} */
		this.view = svg.getElementById('view');
		/** @type {SVGGElement} */
		this.pathPoints = svg.getElementById('pathPoints');
	}

	/** @param {PointerEvent} ev */
	pointerdown(ev) {
		this.posView = ev.posView;
		if (ev.target.tagName == 'circle') {
			this.movingPathPoint = ev.target;
			return true;
		}

		const selections = this.view.getElementsByClassName('selected');
		if (selections.length != 1) return ;

		this.span = selections[0];
		/** @type {SVGPathElement} */
		this.path = this.span.querySelector('path');

		this.selectNone();
		this.commands = parseCommands(this.path.getAttribute('d'));
		this.updatePoints();
	}

	updatePoints() {
		if (!this.commands || !this.span) return;
		const transform = getTransform(this.span);
		let pointI = 0;
		for (let i = 0; i < this.commands.length; i++) {
			const cmd = this.commands[i];

			for (let j = 0; j < cmd.coords.length; j += 1) {
				const existing = this.pathPoints.children[pointI++];
				const circle = existing ?? document.createElementNS(xmlns, 'circle');
				const viewPt = cmd.coords[j].matrixTransform(transform);
				circle.cx.baseVal.value = viewPt.x;
				circle.cy.baseVal.value = viewPt.y;
				circle.setAttribute('data-command', i.toString());
				circle.setAttribute('data-point', (j * 2).toString());
				if (!existing) this.pathPoints.append(circle);
			}
		}
	}

	/** @param {PointerEvent} ev */
	pointermove(ev) {
		if (!this.movingPathPoint) return;

		const posOld = this.posView;
		if (!posOld) return;
		this.posView = ev.posView;
		const d = new DOMPoint(this.posView.x - posOld.x, this.posView.y - posOld.y);

		const point = new DOMPoint(
			this.movingPathPoint.cx.baseVal.value + d.x,
			this.movingPathPoint.cy.baseVal.value + d.y,
		);
		// move circle
		this.movingPathPoint.setAttribute('cx', point.x);
		this.movingPathPoint.setAttribute('cy', point.y);
		const cmdI = +this.movingPathPoint.getAttribute('data-command');
		const pointI = +this.movingPathPoint.getAttribute('data-point');
		// move path
		this.commands[cmdI].coords[pointI] = point.matrixTransform(getTransform(this.span).inverse());
		this.path.setAttribute('d', fmtCommands(this.commands));
		this.path.nextElementSibling.setAttribute('textLength', this.path.getTotalLength());

		this.updateSelectGroup();

		return true;
	}

	pointerup() {
		this.posView = undefined;
		const res = this.movingPathPoint != undefined;
		this.movingPathPoint = undefined;
		return res;
	}

	selectNone() {
		this.pathPoints.replaceChildren();
	}
}
