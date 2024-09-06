import { PanZoom } from './pan.js';
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
		const textInput = root.getElementById('textInput');

		// call custom setter to push state to DOM
		this.tool = 'pan';
		root.querySelectorAll('[name="tool"]')
			.forEach(n => n.addEventListener('change', ev => this.tool = ev.target.id));
		this.panZoom = new PanZoom(this.svg);
		this.touch = new Touch(this.svg);
		this.select = new Select(this.svg);
		this.text = new Text(this.svg, word => {
			this.tool = 'select';
			this.select.startPathEdit(word);
		});

		this.fitToImg(); // in case img loaded before us
		this.img.addEventListener('load', this.fitToImg.bind(this));

		// rarely want to copy image. highlighting text is not possible outside text editing mode.
		// right click used as pan, but could one day make custom context menu.
		this.svg.addEventListener('contextmenu', ev => ev.preventDefault());
		this.svg.addEventListener('pointerdown', ev => {
			ev.preventDefault();
			if (ev.target == textInput) return ev.stopPropagation();

			if (this.panZoom.pointerdown(ev, this.tool)) return;
			if (this.select.pointerdown(ev, this.tool)) return;
		});
		this.svg.addEventListener('pointermove', ev => {
			// Ignore this event while touching or waiting for touch timeout.
			if (this.touch.touches || !this.touch.allow) return;
			// Give precedence to panning while using other tools.
			if (this.panZoom.pointermove(ev, this.tool)) return;
			// Select also makes a box for text in text mode.
			if (this.select.pointermove(ev, this.tool)) return;
		});
		this.svg.addEventListener('pointerup', ev => {
			ev.preventDefault();
			if (ev.target == this.textInput) return;

			if (this.panZoom.pointerup(ev, this.tool)) return;
			if (this.text.pointerup(ev, this.tool)) return;
			if (this.select.pointerup(ev, this.tool)) return;
		});
		this.svg.addEventListener('wheel', ev => this.panZoom.wheel(ev));

		this.text.registerListeners();
	}

	unregisterListeners() {
		this.text.unregisterListeners();
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
}

new Transcribe(document);
