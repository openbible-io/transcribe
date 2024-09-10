import { matrixScale, getTransform, setTransform } from './helpers.js';

const zoomMult = 0.05;
const rotMult = 0.1;
const blob = new Blob([`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" height="16" width="16">
	<path d="M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.8 62.5-62.5 163.8-62.5 226.3 0l17.1 17.2H336c-17.7 0-32 14.3-32 32s14.3 32 32 32h127.9c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v51.2l-17.5-17.6c-87.5-87.5-229.3-87.5-316.8 0-24.4 24.4-42 53.1-52.8 83.8-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5zM39 289.3c-5 1.5-9.8 4.2-13.7 8.2-4 4-6.7 8.8-8.1 14-.3 1.2-.6 2.5-.8 3.8-.3 1.7-.4 3.4-.4 5.1V448c0 17.7 14.3 32 32 32s32-14.3 32-32v-51.1l17.6 17.5c87.5 87.4 229.3 87.4 316.7 0 24.4-24.4 42.1-53.1 52.9-83.7 5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8-62.5 62.5-163.8 62.5-226.3 0l-.1-.1-17.1-17.1H176c17.7 0 32-14.3 32-32s-14.3-32-32-32H48.4c-1.6 0-3.2.1-4.8.3s-3.1.5-4.6 1z" />
</svg>
`], {type: 'image/svg+xml'});
const rotationCursor = `url(${window.URL.createObjectURL(blob)}) 8 8, pointer`;

export class PanZoomRotate {
	/** @param {SVGSVGElement} svg */
	constructor(svg) {
		this.svg = svg;
		/** @type {SVGGElement} */
		this.view = svg.getElementById('view');
	}

	isPanning(ev, tool) {
		return (tool == 'pan' && ev.buttons & 1) || (ev.buttons & 2) || (ev.buttons & 4);
	}

	pointerdown(ev, tool) {
		this.pos = new DOMPoint(ev.x, ev.y);
		if (this.isPanning(ev, tool)) {
			this.svg.style.cursor = 'grab';
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
			const translation = this.svg.createSVGMatrix().translate(d.x, d.y);

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
		transform
			.translateSelf(-origin.x, -origin.y)
			.multiplySelf(getTransform(this.view));

		this.setTransform(transform);
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
		this.svg.style.setProperty('--view-scale', matrixScale(transform));
	}
}
