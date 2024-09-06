import { Text } from './text.js';
import { Touch } from './touch.js';
import { fmtPoint, parseCommands, fmtCommands, rectsOverlap, matrixScale } from './helpers.js';

const rotMult = 1;
const zoomMult = 0.05;
const xmlns = 'http://www.w3.org/2000/svg';

export class Transcribe {
	/**
	 * @param {SVGSVGElement} svg
	 */
	constructor(root) {
		/** @type {SVGSVGElement} */
		this.svg = root.querySelector('svg');
		/** @type {SVGImageElement} */
		this.img = root.querySelector('image');
		/** @type {SVGGElement} */
		this.words = root.getElementById('words');
		/** @type {SVGForeignObjectElement} */
		this.fo = root.querySelector('foreignObject');
		/** @type {SVGPathElement} */
		this.selectDrag = root.getElementById('selectDrag');
		/** @type {SVGPathElement} */
		this.selectGroup = root.getElementById('selectGroup');
		/** @type {HTMLInputElement} */
		this.textInput = root.getElementById('textInput');
		/** @type {SVGGElement} */
		this.pathPoints = root.getElementById('pathPoints');

		// call custom setter to push state to DOM
		this.tool = 'pan';
		root.querySelectorAll('[name="tool"]')
			.forEach(n => n.addEventListener('change', ev => this.tool = ev.target.id));
		this.text = new Text(this.textInput, this.fo, this.lang, this.words, word => {
			this.tool = 'select';
			this.startPathEdit(word);
		});
		this.touch = new Touch(this.svg);

		// 1-1 pixel ratio with image allows rounding final coordinates to integers
		this.fitToImg();
		this.img.addEventListener('load', this.fitToImg.bind(this));

		// rarely want to copy image. highlighting text is not possible outside text editing mode.
		// right click used as pan, but could one day make custom context menu.
		this.svg.addEventListener('contextmenu', ev => ev.preventDefault());
		this.svg.addEventListener('pointerdown', this.onPointerDown.bind(this));
		this.svg.addEventListener('pointermove', this.onPointerMove.bind(this));
		this.svg.addEventListener('pointerup', this.onPointerUp.bind(this));
		this.svg.addEventListener('wheel', this.onWheel.bind(this));

		this.text.registerListeners();
		this.touch.registerListeners();
	}

	fitToImg() {
		const bb = this.img.getBBox();
		this.svg.setAttribute('viewBox', `0 0 ${bb.width} ${bb.height}`);
	}

	/**
	 * @param {PointerEvent} ev
	 */
	onPointerDown(ev) {
		this.pos = new DOMPoint(ev.x, ev.y);
		if (ev.button != 0 || ev.target == this.textInput) return ev.stopPropagation();
		this.startPosView = this.toViewport(ev.x, ev.y);
		ev.preventDefault();

		if (this.tool == 'pan') {
			this.svg.style.cursor = 'grabbing';
			this.upCursor = 'grab';
			return;
		}
		// selecting point?
		if (ev.target.parentElement == this.pathPoints) {
			/** @type {SVGCircleElement} */
			this.pathPoint = ev.target;
			return;
		}

		// selecting word?
		if (!ev.shiftKey) this.selectNone();
		/** @type {SVGGElement} */
		const word = ev.target.closest('g.word');
		if (word) {
			this.pos = undefined; // don't make a select box
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
	 * Perform dragging select or translation of view/words.
	 *
	 * @param {PointerEvent} ev
	 */
	onPointerMove(ev) {
		ev.preventDefault();
		if (this.touch.touches || !this.touch.allow || !this.pos) return;
		const posOld = this.pos;
		this.pos = new DOMPoint(ev.x, ev.y);

		const clientDx = this.pos.x - posOld.x;
		const clientDy = this.pos.y - posOld.y;
		const scale = matrixScale(this.svg.getScreenCTM());
		const d = new DOMPoint(clientDx / scale, clientDy / scale);
		const translation = this.svg.createSVGMatrix().translate(d.x, d.y);
		// Allow panning while using other tools
		if ((this.tool == 'pan' && (ev.buttons & 1)) || (ev.buttons & 2) || (ev.buttons & 4)) {
			this.transform = translation.multiply(this.transform);
			this.pushCursor(this.svg.style.cursor);
			return;
		} else {
			this.popCursor();
		}

		if (this.pathPoint) {
			const word = this.pathPoint.parentElement.parentElement;
			const wordTransform = new DOMMatrix(word.getAttribute('transform'));
			const transformScale = matrixScale(this.transform);
			const wordScale = matrixScale(wordTransform);
			d.x /= transformScale * wordScale;
			d.y /= transformScale * wordScale;
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

			return;
		}

		const start = this.startPosView;
		if (!start) return;
		const pos = this.toViewport(ev.x, ev.y);
		const width = (pos.x - start.x).toFixed(0);
		const height = (pos.y - start.y).toFixed(0);
		this.selectDrag.setAttribute('d', `M${fmtPoint(start)} h${width} v${height} h${-width}Z`);

		if (this.tool == 'select') {
			const bselectDrag = this.selectDrag.getBoundingClientRect();

			for (let i = 0; i < this.words.children.length; i++) {
				const c = this.words.children[i];
				const bbox = c.getBoundingClientRect();
				if (rectsOverlap(bselectDrag, bbox)) {
					c.classList.add('selected');
				} else {
					c.classList.remove('selected');
				}
			}
		}
	}

	/**
	 * Reset state for next onPointerDown.
	 *
	 * @param {PointerEvent} ev
	 */
	onPointerUp(ev) {
		this.popCursor();
		if (ev.button != 0 || ev.target == this.textInput) return;
		ev.preventDefault();

		if (this.tool == 'text') {
			const bbox = this.selectDrag.getBBox();
			this.text.start(bbox);
		} else if (this.tool == 'select') {
			const selections = this.words.getElementsByClassName('selected');
			this.updateSelectGroup(selections);
		}

		this.selectDrag.setAttribute('d', '');
		this.startPosView = undefined;
		this.selected = undefined;
		this.pathPoint = undefined;
	}

	/**
	 * @param {WheelEvent} ev
	 */
	onWheel(ev) {
		const dir = ev.deltaY < 0 ? 1 : -1;
		const origin = new DOMPoint(ev.x, ev.y).matrixTransform(this.svg.getScreenCTM().inverse());
		if (ev.shiftKey) {
			this.transform = this.svg.createSVGMatrix()
				.translate(origin.x, origin.y)
				.rotate(dir * rotMult)
				.translate(-origin.x, -origin.y)
				.multiply(this.transform);
		} else {
			const scale = 1 + dir * zoomMult;
			this.transform = this.svg.createSVGMatrix()
				.translate(origin.x, origin.y)
				.scale(scale)
				.translate(-origin.x, -origin.y)
				.multiply(this.transform);
		}
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

	get transform() {
		/** @type {SVGGElement} */
		const g = this.svg.firstElementChild;
		return g.transform.baseVal[0].matrix;
	}
	set transform(newValue) {
		/** @type {SVGGElement} */
		const g = this.svg.firstElementChild;
		g.transform.baseVal[0].setMatrix(newValue);
	}

	/** @type {'pan' | 'select' | 'text' | 'ocr'} */
	#tool;
	get tool() { return this.#tool; }
	set tool(newValue) {
		document.getElementById(newValue).checked = true;
		if (newValue == 'pan') {
			this.svg.style.cursor = 'grab';
		} else if (newValue == 'text') {
			this.svg.style.cursor = 'crosshair';
		} else {
			this.svg.style.cursor = 'auto';
		}
		// for CSS selectors
		this.svg.classList.remove(this.#tool);
		this.svg.classList.add(newValue);
		this.#tool = newValue;
	}

	pushCursor() {
		if (!this.upCursor) {
			this.upCursor = this.svg.style.cursor;
			this.svg.style.cursor = 'grabbing';
		}
	}

	popCursor() {
		if (this.upCursor) {
			this.svg.style.cursor = this.upCursor;
			this.upCursor = undefined;
		}
	}

	/**
	 * @param {clientX} number
	 * @param {clientY} number
	 */
	toViewport(clientX, clientY) {
		return new DOMPoint(clientX, clientY)
			.matrixTransform(this.svg.getScreenCTM().inverse())
			.matrixTransform(this.transform.inverse());
	}
}

new Transcribe(document);
