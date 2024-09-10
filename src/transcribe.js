import { toViewport } from './helpers.js';
import { PanZoomRotate } from './pan.js';
import { Touch } from './touch.js';
import { Text } from './text.js';
import { Select } from './select.js';

export class Transcribe {
	/** @param {HTMLElement} root */
	constructor(root) {
		/** @type {SVGSVGElement} */
		this.svg = root.querySelector('svg');
		/** @type {SVGImageElement} */
		this.img = root.querySelector('image');
		/** @type {HTMLInputElement} */
		this.textInput = root.getElementById('textInput');

		this.panZoomRot = new PanZoomRotate(this.svg);
		this.touch = new Touch(this.svg);
		this.select = new Select(this.svg);
		this.text = new Text(this.svg);
		this.tool = 'text'; // custom setter pushes state to DOM
		root.querySelectorAll('[name="tool"]')
			.forEach(n => n.addEventListener('change', ev => this.tool = ev.target.id));

		this.fitToImg(); // in case img loaded before us
		this.img.addEventListener('load', this.fitToImg.bind(this));

		// rarely want to copy image. highlighting text is not possible outside text editing mode.
		// right click used as pan, but could one day make custom context menu.
		this.svg.addEventListener('contextmenu', ev => ev.preventDefault());
		this.svg.addEventListener('pointerdown', ev => {
			if (ev.target == this.textInput) return ev.stopPropagation();
			ev.preventDefault();
			ev.posView = this.toViewport(ev.x, ev.y);

			if (this.panZoomRot.pointerdown(ev, this.tool)) return;
			if (this.text.pointerdown(ev, this.tool)) return;
			if (this.select.pointerdown(ev, this.tool)) return;
		});
		this.svg.addEventListener('pointermove', ev => {
			ev.posView = this.toViewport(ev.x, ev.y);
			// Ignore this event while touching or waiting for touch timeout.
			if (this.touch.touches || !this.touch.allow) return;
			// Give precedence to panning while using other tools.
			if (this.panZoomRot.pointermove(ev, this.tool)) return;
			// Select also makes a box in text mode.
			if (this.select.pointermove(ev, this.tool)) return;
		});
		this.svg.addEventListener('pointerup', ev => {
			if (ev.target == this.textInput) return;
			ev.preventDefault();
			ev.posView = this.toViewport(ev.x, ev.y);

			if (this.panZoomRot.pointerup(ev, this.tool)) return;
			if (this.text.pointerup(ev, this.tool)) return;
			if (this.select.pointerup(ev, this.tool)) return;
		});
		this.svg.addEventListener('wheel', ev => this.panZoomRot.wheel(ev));

		document.addEventListener('pointerdown', this.pointerdownDoc.bind(this));
		document.addEventListener('keydown', this.keydownDoc.bind(this));
		document.addEventListener('keyup', this.keyupDoc.bind(this));
	}

	unregisterListeners() {
		document.removeEventListener('pointerdown', this.pointerdownDoc.bind(this));
		document.removeEventListener('keydown', this.keydownDoc.bind(this));
		document.removeEventListener('keyup', this.keyupDoc.bind(this));
	}

	/** @param {PointerEvent} ev */
	pointerdownDoc(ev) {
		if (this.text.pointerdownDoc(ev, this.tool)) return;
	}

	/** @param {PointerEvent} ev */
	keydownDoc(ev) {
		if (this.panZoomRot.keydownDoc(ev, this.tool)) return;
		if (this.text.keydownDoc(ev, this.tool)) return;
	}

	/** @param {PointerEvent} ev */
	keyupDoc(ev) {
		if (this.panZoomRot.keyupDoc(ev, this.tool)) return;
	}

	/// 1-1 pixel ratio with image allows rounding final coordinates to integers
	fitToImg() {
		const bb = this.img.getBBox();
		this.svg.setAttribute('viewBox', `0 0 ${bb.width} ${bb.height}`);
	}

	/** @type {'pan' | 'select' | 'text' | 'ocr'} */
	#tool;
	get tool() { return this.#tool; }
	set tool(newValue) {
		document.getElementById(newValue).checked = true;
		this.svg.style.cursor = '';
		if (newValue != 'select') this.select.selectNone();
		this.svg.classList.remove(this.#tool);
		this.svg.classList.add(newValue);
		this.#tool = newValue;
	}

	/**
	 * @param {number} clientX
	 * @param {number} clientY
	 */
	toViewport(clientX, clientY) {
		return toViewport(this.svg, clientX, clientY);
	}
}

new Transcribe(document);
