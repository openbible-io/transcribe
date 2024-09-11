import { fmtPoint, getTransform, setTransform, selectableSelector } from './helpers.js';
import { Select } from './select.js'; // Just for type...

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
	/**
	 * @param {SVGGSVGElement} editor
	 * @param {Select} select
	 * @param {HTMLDivElement} leftPanel
	 */
	constructor(editor, select, leftPanel) {
		this.editor = editor;
		/** @type {SVGGElement} */
		this.doc = editor.querySelector('svg');
		this.uid = this.doc.children.length;
		/** @type {SVGForeignObjectElement} */
		this.fo = editor.querySelector('foreignObject');
		/** @type {HTMLInputElement} */
		this.textInput = editor.getElementById('textInput');
		/** @type {SVGPathElement} */
		this.selectDrag = editor.getElementById('selectDrag');
		/** @type {SVGGElement} */
		this.ui = editor.getElementById('ui');
		this.select = select;
		/** @type {HTMLSelectElement} */
		this.lang = leftPanel.querySelector('#lang');
		/** @type {HTMLInputElement} */
		this.fontSize = leftPanel.querySelector('#fontSize');
		/** @type {HTMLSelectElement} */
		this.fontFamily = leftPanel.querySelector('#fontFamily');

		this.textInput.parentElement.addEventListener('submit', ev => {
			ev.preventDefault()
			this.end();
		});
		this.textInput.addEventListener('blur', ev => ev.relatedTarget && this.end());
	}

	/**
	 * @param {DOMRect} bbox
	 * @param {string | undefined} lang
	 */
	start(bbox, lang) {
		this.fo.style.display = 'block';
		this.fo.setAttribute('x', bbox.x);
		this.fo.setAttribute('y', bbox.y);
		this.fo.setAttribute('width', bbox.width);
		this.fo.setAttribute('height', bbox.height);
		this.fo.removeAttribute('transform');
		this.textInput.style.fontFamily = this.fontFamily.value;
		this.textInput.style.fontSize = this.fontSize.value + 'px';

		// scale input to selection
		const foreignHeight = this.fo.getBoundingClientRect().height;
		const inputHeight = this.textInput.getBoundingClientRect().height;
		const scale = foreignHeight / inputHeight;
		const transform = new DOMMatrix().scale(scale, scale, 1, bbox.x, bbox.y);
		this.fo.setAttribute('width', bbox.width / scale);
		this.fo.setAttribute('height', bbox.height / scale);
		this.fo.setAttribute('transform', transform.toString());

		if (!lang) lang = this.lang.value;
		this.textInput.setAttribute('lang', lang);
		this.textInput.setAttribute('dir', lang == 'he' ? 'rtl' : 'ltr');
		this.textInput.focus();
	}

	end() {
		if (this.editing) {
			this.editing.removeAttribute('style');
			if (this.textInput.value == '') {
				this.editing.remove();
				this.select.selectNone();
			}
		}
		if (this.textInput.value) {
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

			setTransform(span, getTransform(this.ui).multiply(getTransform(this.fo)));
			path.id = this.getUid('span');
			textPath.setAttribute('href', `#${path.id}`);
			this.doc.appendChild(span);
			const metrics = fontMetrics(this.textInput);
			const p1 = new DOMPoint(
				this.fo.x.baseVal.value,
				this.fo.y.baseVal.value + metrics.fontBoundingBoxAscent,
			);
			const p2 = new DOMPoint(p1.x + this.fo.width.baseVal.value, p1.y);
			path.setAttribute('d', `M${fmtPoint(p1)} L${fmtPoint(p2)}`);
			text.setAttribute('textLength', path.getTotalLength());
			text.setAttribute('style', this.textInput.getAttribute('style'));
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
				this.select.selectNone();
				const text = this.editing.querySelector('text');
				const transform = getTransform(this.editing);
				const bbox = text.getBBox();
				const actual = new DOMPoint(bbox.x, bbox.y).matrixTransform(transform);
				bbox.x = actual.x;
				bbox.y = actual.y + 1;
				bbox.width *= transform.a;
				bbox.height *= transform.d;
				this.start(bbox, text.getAttribute('lang'));
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
		if (bbox.width > 1 && bbox.height > 1) this.start(bbox);
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
		if ((ev.key == 'Backspace' || ev.key == 'Delete') && this.editing) {
			this.editing.remove();
			this.editing = undefined;
			this.fo.style.display = 'none';
		}
		if (document.activeElement == this.textInput) return true;
	}

	/** @param {string} prefix */
	getUid(prefix) {
		let uid;
		do {
			uid = `${prefix}${this.uid++}`;
		} while (document.getElementById(uid));

		return uid;
	}
}
