import { matrixScale, getTransform, setTransform } from './helpers.js';
import RotateIcon from './icons/rotate.svg?raw';

const zoomMult = 0.05;
const rotMult = 0.1;
const blob = new Blob([RotateIcon], {type: 'image/svg+xml'});
const rotationCursor = `url(${window.URL.createObjectURL(blob)}) 8 8, pointer`;

export class PanZoomRotate {
	/** @param {SVGSVGElement} svg */
	constructor(svg) {
		this.svg = svg;
		/** @type {SVGGElement} */
		this.view = svg.getElementById('view');
		/** @type {SVGGElement} */
		this.ui = svg.getElementById('ui');
	}

	isPanning(ev, tool) {
		return (tool == 'pan' && ev.buttons & 1) || (ev.buttons & 2) || (ev.buttons & 4);
	}

	pointerdown(ev, tool) {
		this.pos = new DOMPoint(ev.x, ev.y);
		if (this.isPanning(ev, tool)) {
			this.pushCursor('grabbing');
			return true;
		}
	}

	pointermove(ev, tool) {
		const posOld = this.pos;
		this.pos = new DOMPoint(ev.x, ev.y);
		if (this.isPanning(ev, tool)) {
			const pos = new DOMPoint(ev.x, ev.y);

			const clientDx = pos.x - posOld.x;
			const clientDy = pos.y - posOld.y;
			const scale = matrixScale(this.svg.getScreenCTM());
			const d = new DOMPoint(clientDx / scale, clientDy / scale);
			const translation = new DOMMatrix().translate(d.x, d.y);

			this.setTransform(translation.multiply(getTransform(this.view)));
			return true;
		}
	}

	pointerup() {
		this.popCursor();
	}

	/**
	 * @param {KeyboardEvent} ev
	 * @param {string} tool
	 */
	keydownDoc(ev, tool) {
		if (tool != 'pan') return; // give other tools cursor priority
		if (ev.shiftKey) this.svg.style.cursor = rotationCursor;
	}

	/**
	 * @param {KeyboardEvent} ev
	 * @param {string} tool
	 */
	keyupDoc(ev, tool) {
		if (tool != 'pan') return; // give other tools cursor priority
		if (!ev.shiftKey) this.svg.style.cursor = '';
	}

	/** @param {WheelEvent} ev */
	wheel(ev) {
		const dir = ev.deltaY < 0 ? 1 : -1;
		const origin = new DOMPoint(ev.x, ev.y)
			.matrixTransform(this.svg.getScreenCTM().inverse());

		let transform = new DOMMatrix()
			.translate(origin.x, origin.y);

		if (ev.shiftKey) {
			transform.rotateSelf(dir * rotMult);
		} else {
			transform.scaleSelf(dir * zoomMult + 1);
		}
		transform.translateSelf(-origin.x, -origin.y)

		if (ev.shiftKey) {
			setTransform(this.ui, transform.inverse().multiply(getTransform(this.ui)));
		}
		this.setTransform(transform.multiply(getTransform(this.view)));
	}

	/** @param {string} c */
	pushCursor(c) {
		this.tmpCursor = this.svg.style.cursor ?? '';
		this.svg.style.cursor = c;
	}

	popCursor() {
		this.svg.style.cursor = this.tmpCursor ?? '';
		this.tmpCursor = '';
	}

	/** @param {DOMMatrix} transform */
	setTransform(transform) {
		setTransform(this.view, transform);
		this.view.style.setProperty('--view-scale', matrixScale(transform));
	}
}
