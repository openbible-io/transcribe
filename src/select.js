import { fmtPoint, parseCommands, fmtCommands, rectsOverlap, matrixScale, getTransform } from './helpers.js';
const xmlns = 'http://www.w3.org/2000/svg';

export class Select {
	/** @param {SVGSVGElement} svg */
	constructor(svg) {
		this.svg = svg;

		/** @type {SVGGElement} */
		this.words = svg.getElementById('words');
		/** @type {SVGGElement} */
		this.pathPoints = svg.getElementById('pathPoints');
		/** @type {SVGPathElement} */
		this.selectDrag = svg.getElementById('selectDrag');
		/** @type {SVGPathElement} */
		this.selectGroup = svg.getElementById('selectGroup');
	}

	/** @param {PointerEvent} ev */
	pointerdown(ev) {
		this.pos = new DOMPoint(ev.x, ev.y);
		this.posView = this.toViewport(ev.x, ev.y);
		if (ev.target.parentElement == this.pathPoints) {
			/** @type {SVGCircleElement} */
			this.pathPoint = ev.target;
			return true;
		}

		// selecting word?
		if (!ev.shiftKey) this.selectNone();
		console.log(ev.shiftKey, ev.target);
		/** @type {SVGGElement} */
		const word = ev.target.closest('g.word');
		if (word) {
			this.posView = undefined; // don't make a select box
			word.classList.toggle('selected');

			const selections = this.words.getElementsByClassName('selected');
			const isOnlySelection = selections.length == 1 && word == selections.item(0);
			if (isOnlySelection) {
				this.startPathEdit(word);
			} else {
				this.pathPoints.replaceChildren();
			}

			this.updateSelectGroup(selections);
		}
	}

	/**
	 * @param {PointerEvent} ev
	 * @param {string} tool
	 * */
	pointermove(ev, tool) {
		const posOld = this.pos;
		this.pos = new DOMPoint(ev.x, ev.y);

		if (this.pathPoint) {
			/** @type {SVGGElement} */
			const word = this.pathPoint.parentElement.parentElement;
			const wordTransform = word.transform.baseVal[0].matrix;

			const clientDx = this.pos.x - posOld.x;
			const clientDy = this.pos.y - posOld.y;
			const scale = matrixScale(this.svg.getScreenCTM()) *
				matrixScale(getTransform(this.svg)) *
				matrixScale(wordTransform);
			const d = new DOMPoint(clientDx / scale, clientDy / scale);
			const point = new DOMPoint(
				this.pathPoint.cx.baseVal.value + d.x,
				this.pathPoint.cy.baseVal.value + d.y,
			);
			// move circle
			this.pathPoint.cx.baseVal.value = point.x;
			this.pathPoint.cy.baseVal.value = point.y;
			const cmdI = +this.pathPoint.getAttribute('data-command');
			const pointI = +this.pathPoint.getAttribute('data-point');
			// move path
			this.commands[cmdI].coords[pointI] = point.x;
			this.commands[cmdI].coords[pointI + 1] = point.y;
			this.path.setAttribute('d', fmtCommands(this.commands));
			this.path.nextElementSibling.setAttribute('textLength', this.path.getTotalLength());

			const selections = this.words.getElementsByClassName('selected');
			this.updateSelectGroup(selections);

			return true;
		}

		const start = this.posView;
		if (!start) return;
		const pos = this.toViewport(ev.x, ev.y);
		const width = (pos.x - start.x).toFixed(0);
		const height = (pos.y - start.y).toFixed(0);
		this.selectDrag.setAttribute('d', `M${fmtPoint(start)} h${width} v${height} h${-width}Z`);

		if (tool == 'select') {
			const selectDragBBox = this.selectDrag.getBoundingClientRect();

			for (let i = 0; i < this.words.children.length; i++) {
				const c = this.words.children[i];
				const bbox = c.getBoundingClientRect();
				if (rectsOverlap(selectDragBBox, bbox)) {
					c.classList.add('selected');
				} else {
					c.classList.remove('selected');
				}
			}
		}

		return true;
	}

	pointerup() {
		const selections = this.words.getElementsByClassName('selected');
		this.updateSelectGroup(selections);

		this.selectDrag.setAttribute('d', '');
		this.pathPoint = undefined;
		this.posView = undefined;
	}

	/**
	 * @param {HTMLCollectionOf<SVGGElement>} selections
	 */
	updateSelectGroup(selections) {
		const min = new DOMPoint(Infinity, Infinity);
		const max = new DOMPoint(-Infinity, -Infinity);
		for (let i = 0; i < selections.length; i++) {
			/** @type {SVGRect} */
			const rect = selections.item(i).getBBox();
			const rectMatrix = new DOMMatrix(selections.item(i).getAttribute('transform'));
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
		for (let i = 0; i < this.words.children.length; i++) {
			this.words.children[i].classList.remove('selected');
		}
		this.selectGroup.setAttribute('d', '');
		this.pathPoints.replaceChildren();
	}

	/**
	 * @param {SVGGElement} word
	 */
	startPathEdit(word) {
		this.pathPoints.replaceChildren();
		word.append(this.pathPoints);
		/** @type {SVGPathElement} */
		this.path = word.firstElementChild;
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
			.matrixTransform(this.svg.getScreenCTM().inverse())
			.matrixTransform(getTransform(this.svg).inverse());
	}
}
