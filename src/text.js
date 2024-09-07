import { fmtPoint } from './helpers.js';

const spanTemplate = document.createElement('template');
spanTemplate.innerHTML = `
<svg>
<g class="span selected">
	<path />
	<text lengthAdjust="spacingAndGlyphs">
		<textPath />
	</text>
</g>
</svg>
`;

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

export class Text {
	/**
	 * Inline text input handling.
	 *
	 * @param {SVGGSVGElement} svg
	 * @param {string} lang
	 */
	constructor(svg, onEnd) {
		this.svg = svg;
		/** @type {SVGGElement} */
		this.view = svg.getElementById('view');
		/** @type {SVGForeignObjectElement} */
		this.fo = svg.querySelector('foreignObject');
		/** @type {HTMLInputElement} */
		this.textInput = svg.getElementById('textInput');
		/** @type {SVGPathElement} */
		this.selectDrag = svg.getElementById('selectDrag');

		this.onEnd = onEnd;
		/** @type {SVGPathElement} */
		this.selectDrag = svg.getElementById('selectDrag');

		this.textInput.parentElement.addEventListener('submit', ev => {
			ev.preventDefault()
			this.end();
		});
		this.textInput.addEventListener('blur', ev => ev.relatedTarget && this.end());
	}

	/** @param {DOMRect} bbox */
	start(bbox) {
		this.fo.style.display = 'block';
		this.fo.setAttribute('x', bbox.x);
		this.fo.setAttribute('y', bbox.y);
		this.fo.setAttribute('width', bbox.width);
		this.fo.setAttribute('height', bbox.height);
		this.fo.removeAttribute('transform');

		// scale input to selection
		const foreignHeight = this.fo.getBoundingClientRect().height;
		const inputHeight = this.textInput.getBoundingClientRect().height;
		const scale = foreignHeight / inputHeight;
		const transform = new DOMMatrix().scale(scale, scale, 1, bbox.x, bbox.y);
		this.fo.setAttribute('width', bbox.width / scale);
		this.fo.setAttribute('height', bbox.height / scale);
		this.fo.setAttribute('transform', transform.toString());

		const lang = this.svg.getAttribute('lang');
		this.textInput.setAttribute('lang', lang);
		if (lang == 'he') this.textInput.setAttribute('dir', 'rtl');
		this.textInput.focus();
	}

	end() {
		/** @type {SVGGElement} */
		const span = spanTemplate.content.cloneNode(true).querySelector('g');
		span.lastElementChild.setAttribute('lang', this.svg.getAttribute('lang'));
		span.setAttribute('transform', this.fo.getAttribute('transform'));
		/** @type {SVGPathElement} */
		const path = span.querySelector('path');
		path.id = `span${this.view.children.length}`;

		/** @type {SVGTextPathElement} */
		const textPath = span.querySelector('textPath');
		textPath.setAttribute('href', `#${path.id}`);
		textPath.textContent = this.textInput.value;
		this.view.appendChild(span);

		const metrics = fontMetrics(this.textInput);
		const p1 = new DOMPoint(
			this.fo.x.baseVal.value,
			this.fo.y.baseVal.value + metrics.fontBoundingBoxAscent,
		);
		const p2 = new DOMPoint(p1.x + this.fo.width.baseVal.value, p1.y);
		path.setAttribute('d', `M${fmtPoint(p1)} L${fmtPoint(p2)}`);
		textPath.parentElement.setAttribute('textLength', path.getTotalLength());
		this.textInput.value = '';
		this.fo.style.display = 'none';
		this.textInput.blur();
		this.onEnd(span);
	}

	/** @param {string} tool */
	pointerup(_, tool) {
		if (tool != 'text') return;
		const bbox = this.selectDrag.getBBox();
		if (bbox.width > 1 && bbox.height > 1) this.start(bbox);
	}

	pointerdownDoc() {
		if (this.fo.style.display == 'block') this.end();
	}
}
