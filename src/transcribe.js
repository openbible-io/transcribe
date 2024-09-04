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
 * https://www.baeldung.com/java-check-if-two-rectangles-overlap
 * @param {DOMRectReadOnly} a
 * @param {DOMRectReadOnly} b
 */
function isOverlapping(a, b) {
	return !(
		a.top > b.bottom ||
		a.right < b.left ||
		a.bottom < b.top ||
		a.left > b.right
	);
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
	--font-size: 32px;
}
.editor {
	touch-action: none;
	flex: 1;
}
.word:hover:not(.selected) {
	outline: 2px dashed blue;
}
.word.selected {
	outline: 2px solid blue;
}
#textInput {
	border: none;
	background: transparent;
	padding: 0;
	font-size: var(--font-size);
	width: 100%;
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
.baselinePoint {
	fill: pink;
}
#boxSelect {
	fill: rgba(0, 0, 255, 0.2);
}
textPath {
	font-size: var(--font-size);
}
textPath[lang=he],
#textInput[lang=he] {
	dominant-baseline: hanging;
}
</style>
<svg xmlns="${xmlns}" class="editor">
	<g>
		<image opacity="0.5" />
		<path id="boxSelect" />
		<g opacity="1" id="words" />
		<foreignObject>
			<form>
				<input id="textInput" enterkeyhint="done">
			</form>
		</foreignObject>
		<path stroke="brown" id="tmp" />
	</g>
</svg>
<div class="panelLeft">
	<div>
		<input id="fontSize" type="number" style="width: 5ch">
		<input id="fontFamily">
		<input id="fontColor" type="color">
	</div>
</div>
<div class="toolbar">
	<div>
		${['pan', 'text', 'ocr', 'select'].map(id => `
			<input type="radio" name="tool" id="${id}">
			<label for="${id}">${id}</label>
		`).join('')}
	</div>
</div>
`;

const wordTemplate = document.createElement('template');
wordTemplate.innerHTML = `
<svg>
<g class="word">
	<path fill="none" stroke="pink" stroke-width="4" />
	<text>
		<textPath lengthAdjust="spacingAndGlyphs" />
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
		this.boxSelect = root.getElementById('boxSelect');
		/** @type {HTMLInputElement} */
		this.textInput = root.getElementById('textInput');

		this.tool = 'pan';
		root.querySelectorAll('[name="tool"]')
			.forEach(n => n.addEventListener('change', ev => this.tool = ev.target.id));

		this.img.addEventListener('load', e => {
			const bb = e.currentTarget.getBBox();
			this.svg.setAttribute('viewBox', `0 0 ${bb.width} ${bb.height}`);
		});
		this.svg.addEventListener('contextmenu', ev => ev.preventDefault());
		this.svg.addEventListener('pointerdown', ev => {
			if (this.tool == 'pan') {
				this.style.cursor = 'grabbing';
				this.upCursor = 'grab';
			} else if (this.tool == 'text' || this.tool == 'select') {
				if (ev.button != 0) return;

				this.svg.style.userSelect = 'none';
				this.start = this.toViewport(ev.x, ev.y);
			}
		});
		this.svg.addEventListener('pointermove', ev => {
			if (this.tool == 'pan') {
				if (ev.buttons & 1) {
					this.pan(ev.movementX, ev.movementY);
					return;
				}
			} else if (this.tool == 'text' || this.tool == 'select') {
				const pos = this.toViewport(ev.x, ev.y);
				if (this.start) {
					const width = (pos.x - this.start.x).toFixed(0);
					const height = (pos.y - this.start.y).toFixed(0);
					this.boxSelect.setAttribute('d', `M${fmtPoint(this.start)} h${width} v${height} h${-width}Z`);
					if (this.tool == 'select') {
						const selectBox = this.boxSelect.getBoundingClientRect();
						for (let i = 0; i < this.words.children.length; i++) {
							const c = this.words.children[i];
							const bbox = c.getBoundingClientRect();
							if (isOverlapping(selectBox, bbox)) {
								c.classList.add('selected');
							} else {
								c.classList.remove('selected');
							}
						}
					}
				}
			}

			if ((ev.buttons & 2) || (ev.buttons & 4)) {
				this.pan(ev.movementX, ev.movementY);
				this.pushCursor(this.style.cursor);
			} else {
				this.popCursor();
			}
		});
		this.svg.addEventListener('pointerup', ev => {
			this.popCursor();
			if (ev.button != 0) return;

			this.svg.style.userSelect = 'inherit';
			if (this.tool == 'text') {
				const bbox = this.boxSelect.getBBox();
				this.fo.setAttribute('x', bbox.x);
				this.fo.setAttribute('y', bbox.y);
				this.fo.setAttribute('width', bbox.width);
				this.fo.setAttribute('height', bbox.height);

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
				}
			}

			this.boxSelect.setAttribute('d', '');
			this.start = undefined;
		});
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
	}

	connectedCallback() {
		if (!this.hasAttribute('lang')) this.setAttribute('lang', 'en');
		document.addEventListener('pointerdown', this.onDocumentPointerDown.bind(this));
	}

	disconnectedCallback() {
		document.removeEventListener('pointerdown', this.onDocumentPointerDown.bind(this));
	}

	onTextInput() {
		if (this.curWord) {
		} else {
			/** @type {SVGGElement} */
			const word = wordTemplate.content.cloneNode(true).querySelector('g');
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

			const x = this.fo.x.baseVal.value;
			const y = this.fo.y.baseVal.value;
			const width = this.fo.width.baseVal.value;
			textPath.setAttribute('lang', this.lang);
			path.setAttribute('d', `M${x},${y + metrics.fontBoundingBoxAscent} h${width}`);
			textPath.setAttribute('textLength', width);
		}
		this.textInput.value = '';
		this.fo.setAttribute('width', 0);
		this.textInput.blur();
	}

	onDocumentPointerDown() {
		if (this.textInputFocused) {
			this.onTextInput();
		}
	}

	#transform = new DOMMatrix();
	get transform() { return this.#transform; }
	set transform(newValue) {
		this.svg.firstElementChild.setAttribute('transform', newValue.toString());
		this.#transform = newValue;
	}

	#tool = 'pan';
	get tool() { return this.#tool; }
	set tool(newValue) {
		this.shadowRoot.getElementById(newValue).checked = true;
		this.#tool = newValue;
		if (newValue == 'pan') {
			this.style.cursor = 'grab';
		} else if (newValue == 'text') {
			this.style.cursor = 'crosshair';
		} else {
			this.style.cursor = 'auto';
		}
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
	 * @param {clientDx} number
	 * @param {clientDy} number
	 */
	panAmount(clientDx, clientDy) {
		const scale = matrixScale(this.svg.getScreenCTM());
		return new DOMPoint(clientDx / scale, clientDy / scale);
	}

	/**
	 * @param {clientDx} number
	 * @param {clientDy} number
	 */
	pan(clientDx, clientDy) {
		const amount = this.panAmount(clientDx, clientDy);
		this.transform = new DOMMatrix().translate(amount.x, amount.y).multiply(this.transform);
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
