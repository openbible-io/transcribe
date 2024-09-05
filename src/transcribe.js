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
const rotMult = 5;
const zoomMult = 0.05;
/**
 * @param {DOMMatrix} matrix
 */
function matrixScale(matrix) {
	return Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
}
/**
 * @param {TouchList} touches
 */
function distance(touches) {
	let [t1, t2] = touches;
	return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}
/**
 * @param {TouchList} touches
 */
function angle(touches) {
	let [t1, t2] = touches;
	let dx = t2.clientX - t1.clientX;
	let dy = t2.clientY - t1.clientY;
	return (Math.atan2(dy, dx) * 180) / Math.PI;
}
/**
 * @param {TouchList} touches
 */
function midpoint(touches) {
	let [t1, t2] = touches;
	return new DOMPoint((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
}
/**
 * @param {DOMPoint} p
 */
function fmtPoint(p) {
	return `${p.x.toFixed(0)},${p.y.toFixed(0)}`;
}
/**
 * @param {HTMLElement | SVGElement} ele
 */
function fontMetrics(ele) {
	const canvas = new OffscreenCanvas(10, 10);
	const ctx = canvas.getContext('2d');
	ctx.font = getComputedStyle(ele).font;
	ctx.textBaseline = getComputedStyle(ele).dominantBaseline;
	return ctx.measureText('()');
}
/**
 * @param {DOMRectReadOnly} a
 * @param {DOMRectReadOnly} b
 */
function isOverlapping(a, b) {
	return !(a.top > b.bottom || a.right < b.left || a.bottom < b.top || a.left > b.right);
}
/**
 * @param {string} path
 */
function parseCommands(path) {
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
function fmtCommands(cmds) {
	return cmds
		.map(cmd => `${cmd.command}${cmd.coords.join(',')}`)
		.join(' ');
}

const xmlns = 'http://www.w3.org/2000/svg';
const template = document.createElement('template');
template.innerHTML = `
<style>
:host {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	--font: 16px Arial;
	--select-stroke: blue;
}
.editor {
	touch-action: none;
	flex: 1;
	fill: black;
	stroke: var(--select-stroke);
	stroke-width: 1;
	user-select: none;
}
.word {
	stroke: none;
}
.editor.select .word:hover:not(.selected) > path {
	stroke-dasharray: 4;
	stroke: var(--select-stroke);
}
.editor.select .word.selected > path {
	stroke: var(--select-stroke);
}
#textInput {
	outline: none;
	border: none;
	background: transparent;
	padding: 0;
	font: var(--font);
	width: 100%;
}
foreignObject:has(#textInput:focus) {
	outline: 1px solid blue;
}
.toolbar {
	position: fixed;
	display: flex;
	justify-content: center;
	left: 0;
	right: 0;
	bottom: 12px;
	z-index: 8;
}
.toolbar > * {
	position: relative;
}
.panelLeft {
	position: absolute;
	top: 0;
	left: 0;
	background: gray;
}
.editor.select #pathPoints > circle {
	r: 4px;
	cursor: pointer;
}
#selectDrag {
	fill: rgba(0, 0, 255, 0.2);
}
#selectGroup {
	fill: none;
}
textPath {
	font: var(--font);
}
text[lang=he],
#textInput[lang=he] {
	dominant-baseline: hanging;
}
</style>
<div class="toolbar">
	<div>
		${['pan', 'select', 'text', 'ocr'].map(id => `
			<input type="radio" name="tool" id="${id}">
			<label for="${id}">${id}</label>
		`).join('')}
	</div>
</div>
<svg xmlns="${xmlns}" class="editor">
	<g>
		<image opacity="0.5" />
		<path id="selectDrag" />
		<path id="selectGroup" />
<g opacity="1" id="words"><g class="word" transform="matrix(1.8333333730697632, 0, 0, 1.8333333730697632, -50.833335876464844, -30)">
	<path id="word0" d="M61,50 L313,50"></path>
	<text lengthAdjust="spacingAndGlyphs" lang="en" textLength="252">
		<textPath href="#word0">The (quick) [brown] {fox} jumps!</textPath>
	</text>
</g><g class="word" transform="matrix(1.8333333730697632, 0, 0, 1.8333333730697632, -50, -110)">
	<path id="word1" d="M60,146 L341,146"></path>
	<text lengthAdjust="spacingAndGlyphs" lang="en" textLength="281">
		<textPath href="#word1">from aspammer@website.com is spam.</textPath>
	</text>
</g><g class="word" transform="matrix(1.7222222089767456, 0, 0, 1.7222222089767456, -41.166664123535156, -185.61111450195312)">
	<path id="word2" d="M57,271 L339,271"></path>
	<text lengthAdjust="spacingAndGlyphs" lang="en" textLength="282">
		<textPath href="#word2">parasseux. La volpe marrone rapida</textPath>
	</text>
</g></g>

		<foreignObject display="none">
			<form>
				<input id="textInput" enterkeyhint="done">
			</form>
		</foreignObject>
		<g id="pathPoints" />
	</g>
</svg>
<div class="panelLeft">
	<div>
		<input id="fontSize" type="number" style="width: 5ch">
		<input id="fontFamily">
		<input id="fontColor" type="color">
	</div>
</div>
`;

const wordTemplate = document.createElement('template');
wordTemplate.innerHTML = `
<svg>
<g class="word">
	<path />
	<text lengthAdjust="spacingAndGlyphs">
		<textPath />
	</text>
</g>
</svg>
`;

class Transcribe extends HTMLElement {
	static observedAttributes = ['href', 'lang'];

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		const root = this.shadowRoot;
		root.appendChild(template.content.cloneNode(true));
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

		this.img.addEventListener('load', e => {
			const bb = e.currentTarget.getBBox();
			this.svg.setAttribute('viewBox', `0 0 ${bb.width} ${bb.height}`);
		});
		this.svg.addEventListener('contextmenu', ev => ev.preventDefault());
		this.svg.addEventListener('pointerdown', this.onPointerDown.bind(this));
		this.svg.addEventListener('pointermove', this.onPointerMove.bind(this));
		this.svg.addEventListener('pointerup', this.onPointerUp.bind(this));
		this.svg.addEventListener('wheel', ev => {
			const dir = ev.deltaY < 0 ? 1 : -1;
			const origin = new DOMPoint(ev.x, ev.y).matrixTransform(this.svg.getScreenCTM().inverse());
			if (ev.shiftKey) {
				this.transform = new DOMMatrix()
					.translate(origin.x, origin.y)
					.rotate(dir * rotMult)
					.translate(-origin.x, -origin.y)
					.multiply(this.transform);
			} else {
				const scale = 1 + dir * zoomMult;
				this.transform = new DOMMatrix()
					.scale(scale, scale, 1, origin.x, origin.y)
					.multiply(this.transform);
			}
		});
		this.textInput.addEventListener('pointerdown', ev => ev.stopPropagation());
		this.textInput.parentElement.addEventListener('submit', ev => {
			ev.preventDefault()
			this.onTextInput();
		});
		this.textInput.addEventListener('focus', () => this.textInputFocused = true);
		this.textInput.addEventListener('blur', ev => {
			this.textInputFocused = false;
			if (ev.relatedTarget) this.onTextInput();
		});

		this.allowTouch = true;
		this.svg.addEventListener('touchstart', ev => {
			if (ev.touches.length == 2 && this.allowTouch) {
				ev.preventDefault();
				this.touches = ev.touches;
			}
		});
		this.svg.addEventListener('touchmove', ev => {
			if (ev.touches.length == 2) {
				if (!this.touches) return;
				ev.preventDefault();

				const scale = distance(ev.touches) / distance(this.touches);
				const rotation = angle(ev.touches) - angle(this.touches);
				const mpStart = midpoint(this.touches);
				const mpCur = midpoint(ev.touches);
				const translationX = mpCur.x - mpStart.x;
				const translationY = mpCur.y - mpStart.y;
				const origin = mpStart
					.matrixTransform(this.svg.getScreenCTM().inverse())
					.matrixTransform(this.transform.inverse());

				const touchTransform = new DOMMatrix()
					.translate(origin.x, origin.y)
					.translate(translationX, translationY)
					.rotate(rotation)
					.scale(scale)
					.translate(-origin.x, -origin.y);
				this.transform = this.transform.multiply(touchTransform);
				this.touches = ev.touches;
			}
		});
		this.svg.addEventListener('touchend', () => {
			this.touches = undefined;
			this.allowTouch = false;
			setTimeout(() => this.allowTouch = true, 200);
		});
	}

	connectedCallback() {
		if (!this.hasAttribute('lang')) this.setAttribute('lang', 'en');
		document.addEventListener('pointerdown', this.onDocumentPointerDown.bind(this));
	}

	disconnectedCallback() {
		document.removeEventListener('pointerdown', this.onDocumentPointerDown.bind(this));
	}

	/**
	 * @param {DOMRectReadOnly} bbox
	 */
	startTextInput(bbox) {
		this.fo.removeAttribute('display');
		this.fo.setAttribute('x', bbox.x);
		this.fo.setAttribute('y', bbox.y);
		this.fo.setAttribute('width', bbox.width);
		this.fo.setAttribute('height', bbox.height);
		this.fo.removeAttribute('transform');

		// scale input to selection
		const foreignHeight = this.fo.getBoundingClientRect().height;
		const inputHeight = this.textInput.getBoundingClientRect().height;
		if (inputHeight > 1 && foreignHeight > 1) {
			const scale = foreignHeight / inputHeight;
			const transform = new DOMMatrix().scale(scale, scale, 1, bbox.x, bbox.y);
			this.fo.setAttribute('width', bbox.width / scale);
			this.fo.setAttribute('height', bbox.height / scale);
			this.fo.setAttribute('transform', transform.toString());

			this.textInput.setAttribute('lang', this.lang);
			if (this.lang == 'he') this.textInput.setAttribute('dir', 'rtl');
			this.textInput.focus();

			this.tool = 'select';
		} else {
			console.log('too small', foreignHeight, inputHeight);
			this.fo.setAttribute('display', 'none');
		}
	}

	onTextInput() {
		/** @type {SVGGElement} */
		const word = wordTemplate.content.cloneNode(true).querySelector('g');
		word.lastElementChild.setAttribute('lang', this.lang);
		word.setAttribute('transform', this.fo.getAttribute('transform'));
		/** @type {SVGPathElement} */
		const path = word.querySelector('path');
		path.id = `word${this.words.children.length}`;

		/** @type {SVGTextPathElement} */
		const textPath = word.querySelector('textPath');
		textPath.setAttribute('href', `#${path.id}`);
		textPath.textContent = this.textInput.value;
		this.words.appendChild(word);

		const metrics = fontMetrics(this.textInput);

		const p1 = new DOMPoint(
			this.fo.x.baseVal.value,
			this.fo.y.baseVal.value + metrics.fontBoundingBoxAscent,
		);
		const p2 = new DOMPoint(p1.x + this.fo.width.baseVal.value, p1.y);
		path.setAttribute('d', `M${fmtPoint(p1)} L${fmtPoint(p2)}`);
		textPath.parentElement.setAttribute('textLength', path.getTotalLength());
		this.textInput.value = '';
		this.fo.setAttribute('display', 'none');
		this.textInput.blur();
	}

	/**
	 * Set up state for onPointerMove.
	 *
	 * @param {PointerEvent} ev
	 */
	onPointerDown(ev) {
		this.pos = new DOMPoint(ev.x, ev.y);
		if (ev.button != 0) return;
		this.startPosView = this.toViewport(ev.x, ev.y);
		ev.preventDefault();

		if (this.tool == 'pan') {
			this.style.cursor = 'grabbing';
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
		/** @type {SVGGElement} */
		const word = ev.target.closest('g.word');
		if (!ev.shiftKey) this.selectNone();
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

	onDocumentPointerDown() {
		if (this.textInputFocused) this.onTextInput();
	}

	/**
	 * Perform dragging select or translation of view/words.
	 *
	 * @param {PointerEvent} ev
	 */
	onPointerMove(ev) {
		ev.preventDefault();
		if (this.touches || !this.allowTouch || !this.pos) return;
		const posOld = this.pos;
		this.pos = new DOMPoint(ev.x, ev.y);

		const clientDx = this.pos.x - posOld.x;
		const clientDy = this.pos.y - posOld.y;
		const scale = matrixScale(this.svg.getScreenCTM());
		const d = new DOMPoint(clientDx / scale, clientDy / scale);
		const translation = new DOMMatrix().translate(d.x, d.y);
		// Allow panning while using other tools
		if ((this.tool == 'pan' && (ev.buttons & 1)) || (ev.buttons & 2) || (ev.buttons & 4)) {
			this.transform = translation.multiply(this.transform);
			this.pushCursor(this.style.cursor);
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
				if (isOverlapping(bselectDrag, bbox)) {
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
		ev.preventDefault();
		this.popCursor();
		if (ev.button != 0) return;

		if (this.tool == 'text') {
			const bbox = this.selectDrag.getBBox();
			this.startTextInput(bbox);
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

	#transform = new DOMMatrix();
	get transform() { return this.#transform; }
	set transform(newValue) {
		this.svg.firstElementChild.setAttribute('transform', newValue.toString());
		this.#transform = newValue;
	}

	/** @type {'pan' | 'select' | 'text' | 'ocr'} */
	#tool;
	get tool() { return this.#tool; }
	set tool(newValue) {
		this.shadowRoot.getElementById(newValue).checked = true;
		if (newValue == 'pan') {
			this.style.cursor = 'grab';
		} else if (newValue == 'text') {
			this.style.cursor = 'crosshair';
		} else {
			this.style.cursor = 'auto';
		}
		// for CSS selectors
		this.svg.classList.remove(this.#tool);
		this.svg.classList.add(newValue);
		this.#tool = newValue;
	}

	pushCursor() {
		if (!this.upCursor) {
			this.upCursor = this.style.cursor;
			this.style.cursor = 'grabbing';
		}
	}

	popCursor() {
		if (this.upCursor) {
			this.style.cursor = this.upCursor;
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

	/**
	 * @param {string} name
	 * @param {string} _oldValue
	 * @param {string} newValue
	 */
	attributeChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case 'href':
				this.img.setAttribute('href', newValue);
				break;
		}
	}
}
customElements.define('ob-transcribe', Transcribe);
