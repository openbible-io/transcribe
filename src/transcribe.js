import { toViewport } from './helpers.js';
import { PanZoomRotate } from './pan.js';
import { Touch } from './touch.js';
import { Text } from './text.js';
import { Select } from './select.js';

import SelectIcon from './icons/select.svg?raw';
import PanIcon from './icons/pan.svg?raw';
import TextIcon from './icons/text.svg?raw';

const tools = {
	select: SelectIcon,
	pan: PanIcon,
	text: TextIcon,
};

const template = document.createElement('template');
template.innerHTML = `
<div class="panelLeft">
	<select id="lang">
		<option value="he">Hebrew</option>
		<option value="grc">Ancient Greek</option>
		<option value="en">English</option>
	</select>
	<a id="save" href="data:image/svg+xml">Save</a>
</div>
<div class="toolbar">
	<div>
		${Object.entries(tools).map(([name, icon]) => `
			<label>
				<input type="radio" name="tool" id="${name}">
				${icon}
			</label>
		`).join('')}
	</div>
</div>
<svg xmlns="http://www.w3.org/2000/svg" class="editor">
	<g id="view" transform="matrix(1,0,0,1,0,0)">
		<svg xmlns="http://www.w3.org/2000/svg">
			<style>
				text[lang=he] { dominant-baseline: hanging; }
			</style>
			<image />
		</svg>
		<g id="ui">
			<path id="selectDrag" />
			<path id="selectGroup" />
			<rect id="selectGroupTop" />
			<rect id="selectGroupBot" />
			<foreignObject>
				<form>
					<input id="textInput" enterkeyhint="done">
				</form>
			</foreignObject>
			<g id="pathPoints" />
		</g>
	</g>
</svg>
`;

class Transcribe extends HTMLElement {
	constructor() {
		super();

		this.appendChild(template.content.cloneNode(true));
		/** @type {SVGSVGElement} */
		this.editor = this.querySelector('.editor');
		/** @type {SVGSVGElement} */
		this.doc = this.editor.querySelector('svg');
		/** @type {SVGSVGElement} */
		this.view = this.editor.querySelector('#view');
		/** @type {SVGImageElement} */
		this.image = this.view.querySelector('image');
		/** @type {HTMLInputElement} */
		this.textInput = this.querySelector('#textInput');
		/** @type {HTMLAnchorElement} */
		this.save = this.querySelector('#save');
		/** @type {HTMLSelectElement} */
		this.langSelect = this.querySelector('#lang');

		this.panZoomRot = new PanZoomRotate(this.editor);
		this.touch = new Touch(this.editor);
		this.select = new Select(this.editor);
		this.text = new Text(this.editor, this.select, this.langSelect);
		this.tool = 'text'; // custom setter pushes state to DOM

		this.querySelectorAll('[name="tool"]')
			.forEach(n => n.addEventListener('change', ev => this.tool = ev.target.id));
		// 1-1 pixel ratio with image allows rounding final coordinates to integers
		this.image.addEventListener('load', () => {
			const bb = this.image.getBBox();
			const viewBox = `0 0 ${bb.width} ${bb.height}`;
			this.editor.setAttribute('viewBox', viewBox);
			this.doc.setAttribute('viewBox', viewBox);
			this.image.setAttribute('opacity', '0.5');
		});

		// rarely want to copy image. highlighting text is not possible outside text editing mode.
		// right click used as pan, but could one day make custom context menu.
		this.editor.addEventListener('contextmenu', ev => ev.preventDefault());
		this.editor.addEventListener('pointerdown', ev => {
			if (ev.target == this.textInput) return ev.stopPropagation();
			ev.preventDefault();
			ev.posView = this.toViewport(ev.x, ev.y);

			if (this.panZoomRot.pointerdown(ev, this.tool)) return;
			if (this.text.pointerdown(ev, this.tool)) return;
			if (this.select.pointerdown(ev, this.tool)) return;
		});
		this.editor.addEventListener('pointermove', ev => {
			ev.posView = this.toViewport(ev.x, ev.y);

			// Ignore this event while touching or waiting for touch timeout.
			if (this.touch.touches || !this.touch.allow) return;
			// Give precedence to panning while using other tools.
			if (this.panZoomRot.pointermove(ev, this.tool)) return;
			// Select also makes a box in text mode.
			if (this.select.pointermove(ev, this.tool)) return;
		});
		this.editor.addEventListener('pointerup', ev => {
			if (ev.target == this.textInput) return;
			ev.preventDefault();
			ev.posView = this.toViewport(ev.x, ev.y);

			if (this.panZoomRot.pointerup(ev, this.tool)) return;
			if (this.text.pointerup(ev, this.tool)) return;
			if (this.select.pointerup(ev, this.tool)) return;
		});
		this.editor.addEventListener('wheel', ev => {
			ev.preventDefault();
			ev.posView = this.toViewport(ev.x, ev.y);
			this.panZoomRot.wheel(ev);
		});
	}

	connectedCallback() {
		document.addEventListener('pointerdown', this.pointerdownDoc.bind(this));
		document.addEventListener('keydown', this.keydownDoc.bind(this));
		document.addEventListener('keyup', this.keyupDoc.bind(this));
	}

	disconnectedCallback() {
		document.removeEventListener('pointerdown', this.pointerdownDoc.bind(this));
		document.removeEventListener('keydown', this.keydownDoc.bind(this));
		document.removeEventListener('keyup', this.keyupDoc.bind(this));
	}

	static observedAttributes = ['href', 'lang'];
	/**
	 * @param {string} name
	 * @param {string} _oldValue
	 * @param {string} newValue
	 */
	attributeChangedCallback(name, __oldValue, newValue) {
		switch (name) {
			case 'href':
				this.image.setAttribute('opacity', '0');
				this.image.setAttribute(name, newValue);
				break;
			case 'lang':
				this.langSelect.value = newValue;
				break;
		}
	}

	/** @param {PointerEvent} ev */
	pointerdownDoc(ev) {
		if (this.text.pointerdownDoc(ev, this.tool)) return;
		if (ev.target == this.save) {
			const xml = new XMLSerializer().serializeToString(this.doc);
			const svg64 = btoa(decodeURIComponent(encodeURIComponent(xml)))
			const b64start = 'data:image/svg+xml;base64,';
			const image64 = b64start + svg64;
			save.setAttribute('href', image64);
			save.setAttribute('download', (this.image.getAttribute('href') ?? 'untitled') + '.svg');
		}
	}

	/** @param {KeyboardEvent} ev */
	keydownDoc(ev) {
		if (this.panZoomRot.keydownDoc(ev, this.tool)) return;
		if (this.select.keydownDoc(ev, this.tool)) return;
		if (this.text.keydownDoc(ev, this.tool)) return;
		if (ev.key == 's') this.tool = 'select';
		if (ev.key == 'p') this.tool = 'pan';
		if (ev.key == 't') this.tool = 'text';
	}

	/** @param {PointerEvent} ev */
	keyupDoc(ev) {
		if (this.panZoomRot.keyupDoc(ev, this.tool)) return;
	}

	/** @type {keyof tools} */
	#tool;
	get tool() { return this.#tool; }
	set tool(newValue) {
		document.getElementById(newValue).checked = true;
		if (newValue != 'select') this.select.selectNone();
		this.editor.classList.remove(this.#tool);
		this.editor.classList.add(newValue);
		this.editor.style.cursor = '';
		this.#tool = newValue;
	}

	/**
	 * @param {number} clientX
	 * @param {number} clientY
	 */
	toViewport(clientX, clientY) {
		return toViewport(this.editor, clientX, clientY);
	}
}
customElements.define('ob-transcribe', Transcribe);
