import { fmtPoint, selectableSelector } from './helpers.js';

const spanTemplate = document.createElement('template');
spanTemplate.innerHTML = `
<svg>
<g class="span">
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

const dblClickMs = 500;
const dblClickRadius = 8;

export class Text {
	/** @param {SVGGSVGElement} svg */
	constructor(svg) {
		this.svg = svg;
		/** @type {SVGGElement} */
		this.transcription = svg.getElementById('transcription');
		this.uidCount = this.transcription.children.length;
		/** @type {SVGForeignObjectElement} */
		this.fo = svg.querySelector('foreignObject');
		/** @type {HTMLInputElement} */
		this.textInput = svg.getElementById('textInput');
		/** @type {SVGPathElement} */
		this.selectDrag = svg.getElementById('selectDrag');

		/** @type {SVGPathElement} */
		this.selectDrag = svg.getElementById('selectDrag');

		this.textInput.parentElement.addEventListener('submit', ev => {
			ev.preventDefault()
			this.end();
		});
		this.textInput.addEventListener('blur', ev => ev.relatedTarget && this.end());
	}

	/**
	 * @param {DOMRect} bbox
	 * @param {string} lang
	 */
	start(bbox, lang) {
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

		this.textInput.setAttribute('lang', lang);
		if (lang == 'he') this.textInput.setAttribute('dir', 'rtl');
		this.textInput.focus();
	}

	end() {
		/** @type {SVGGElement} */
		const span = this.editing ?? spanTemplate.content.cloneNode(true).querySelector('g');
		/** @type {SVGPathElement} */
		const path = span.querySelector('path');
		/** @type {SVGTextElement} */
		const text = span.querySelector('text');
		text.setAttribute('lang', this.textInput.getAttribute('lang'));
		/** @type {SVGTextPathElement} */
		const textPath = span.querySelector('textPath');
		textPath.textContent = this.textInput.value;

		if (!this.editing) {
			span.setAttribute('transform', this.fo.getAttribute('transform'));
			path.id = this.uid('span');
			textPath.setAttribute('href', `#${path.id}`);
			this.transcription.appendChild(span);
			const metrics = fontMetrics(this.textInput);
			const p1 = new DOMPoint(
				this.fo.x.baseVal.value,
				this.fo.y.baseVal.value + metrics.fontBoundingBoxAscent,
			);
			const p2 = new DOMPoint(p1.x + this.fo.width.baseVal.value, p1.y);
			path.setAttribute('d', `M${fmtPoint(p1)} L${fmtPoint(p2)}`);
			text.setAttribute('textLength', path.getTotalLength());
		} else {
			this.editing.removeAttribute('style');
		}
		this.editing = undefined;
		this.textInput.value = '';
		this.fo.style.display = 'none';
		this.textInput.blur();
	}

	/**
	 * @param {PointerEvent} ev
	 * @param {string} tool
	 */
	pointerdown(ev, tool) {
		if (tool != 'select' && tool != 'text') return;

		if (!this.dblClickFirst) {
			this.dblClickFirst = new DOMPoint(ev.x, ev.y);
		} else {
			const distance = Math.hypot(ev.x - this.dblClickFirst.x, ev.y - this.dblClickFirst.y);
			if (distance > dblClickRadius) return;
			/** @type {SVGGElement | undefined} */
			this.editing = ev.target.closest(selectableSelector);
			if (this.editing) {
				const text = this.editing.querySelector('text');
				const transform = this.editing.transform.baseVal[0]?.matrix ?? this.editing.ownerSVGElement.createSVGMatrix();
				const bbox = text.getBBox();
				const actual = new DOMPoint(bbox.x, bbox.y).matrixTransform(transform);
				bbox.x = actual.x;
				bbox.y = actual.y + 1;
				bbox.width *= transform.a;
				bbox.height *= transform.d;
				this.start(bbox, text.getAttribute('lang') || this.svg.getAttribute('lang'));
				this.textInput.value = this.editing.querySelector('textPath').textContent;
				this.editing.style.display = 'none';

				ev.stopPropagation();
				return true;
			}
		}
		setTimeout(() => this.dblClickFirst = undefined, dblClickMs);
	}

	/** @param {string} tool */
	pointerup(_, tool) {
		if (tool != 'text') return;
		const bbox = this.selectDrag.getBBox();
		if (bbox.width > 1 && bbox.height > 1) this.start(bbox, this.svg.getAttribute('lang'));
	}

	pointerdownDoc() {
		if (this.fo.style.display == 'block') this.end();
	}

	/** @param {KeyboardEvent} ev */
	keydownDoc(ev) {
		if (ev.key == 'Escape') {
			if (this.editing) {
				this.editing.removeAttribute('style');
				this.editing = undefined;
			}
			this.fo.style.display = 'none';
		}
	}

	/** @param {string} prefix */
	uid(prefix) {
		let uid;
		do {
			uid = `${prefix}${this.uidCount++}`;
		} while (document.getElementById(uid));

		return uid;
	}
}
