import { parseCommands, fmtCommands, matrixScale, getTransform, setTransform, xmlns } from './helpers.js';

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

	/**
	 * @param {PointerEvent} ev
	 * @param {string} tool
	 */
	pointerdown(ev, tool) {
		this.pos = new DOMPoint(ev.x, ev.y);
		if (ev.target.tagName == 'circle') {
			this.movingPathPoint = ev.target;
			return true;
		}
	}

	/**
	 * @param {PointerEvent} ev
	 * @param {string} tool
	 */
	pointermove(ev, tool) {
		if (!this.movingPathPoint) return;

		const posOld = this.pos;
		if (!posOld) return;
		this.pos = new DOMPoint(ev.x, ev.y);
		const clientDx = this.pos.x - posOld.x;
		const clientDy = this.pos.y - posOld.y;
		const scale = matrixScale(this.svg.getScreenCTM()) * matrixScale(getTransform(this.view));
		const d = new DOMPoint(clientDx / scale, clientDy / scale);

		if (this.movingPathPoint) {
			/** @type {SVGGElement} */
			const span = this.movingPathPoint.parentElement.parentElement;
			const spanTransform = getTransform(span);
			d.x /= matrixScale(spanTransform);
			d.y /= matrixScale(spanTransform);
			const point = new DOMPoint(
				this.movingPathPoint.cx.baseVal.value + d.x,
				this.movingPathPoint.cy.baseVal.value + d.y,
			);
			// move circle
			this.movingPathPoint.cx.baseVal.value = point.x;
			this.movingPathPoint.cy.baseVal.value = point.y;
			const cmdI = +this.movingPathPoint.getAttribute('data-command');
			const pointI = +this.movingPathPoint.getAttribute('data-point');
			// move path
			this.commands[cmdI].coords[pointI] = point.x;
			this.commands[cmdI].coords[pointI + 1] = point.y;
			this.path.setAttribute('d', fmtCommands(this.commands));
			this.path.nextElementSibling.setAttribute('textLength', this.path.getTotalLength());

			this.updateSelectGroup();

			return true;
		}
	}

	pointerup() {
		const selections = this.view.getElementsByClassName('selected');
		if (selections.length == 1) {
			this.showPoints(selections[0]);
			this.updateSelectGroup();
		}
		this.pos = undefined;
		const res = this.movingPathPoint != undefined;
		this.movingPathPoint = undefined;
		return res;
	}

	/**
	 * @param {SVGGElement} span
	 */
	showPoints(span) {
		if (span.contains(this.pathPoints) && this.pathPoints.children.length > 0) return;
		this.selectNone();
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

	selectNone() {
		this.pathPoints.replaceChildren();
	}
}
