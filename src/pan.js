import { matrixScale, getTransform, setTransform } from './helpers.js';

const zoomMult = 0.05;

export class PanZoom {
	constructor(svg) {
		this.svg = svg;
	}

	pointerdown(ev, tool) {
		this.pos = new DOMPoint(ev.x, ev.y);
		if (tool == 'pan') {
			this.svg.style.cursor = 'grabbing';
			this.upCursor = 'grab';
			return true;
		}
	}

	pointermove(ev, tool) {
		const posOld = this.pos;
		this.pos = new DOMPoint(ev.x, ev.y);
		if ((tool == 'pan' && ev.buttons & 1) || (ev.buttons & 2) || (ev.buttons & 4)) {
			const pos = new DOMPoint(ev.x, ev.y);

			const clientDx = pos.x - posOld.x;
			const clientDy = pos.y - posOld.y;
			const scale = matrixScale(this.svg.getScreenCTM());
			const d = new DOMPoint(clientDx / scale, clientDy / scale);
			const translation = this.svg.createSVGMatrix().translate(d.x, d.y);
			
			const transform = getTransform(this.svg);
			setTransform(this.svg, translation.multiply(transform));
			this.pushCursor(this.svg.style.cursor);
			return true;
		} else {
			this.popCursor();
		}
	}

	pointerup() {
		this.popCursor();
	}

	/**
	 * @param {WheelEvent} ev
	 */
	wheel(ev) {
		const dir = ev.deltaY < 0 ? 1 : -1;
		const origin = new DOMPoint(ev.x, ev.y).matrixTransform(this.svg.getScreenCTM().inverse());
		const scale = 1 + dir * zoomMult;
		const transform = this.svg.createSVGMatrix()
			.translate(origin.x, origin.y)
			.scale(scale)
			.translate(-origin.x, -origin.y)
			.multiply(getTransform(this.svg));
		setTransform(this.svg, transform);
	}

	pushCursor() {
		if (!this.upCursor) {
			this.upCursor = this.svg.style.cursor;
			this.svg.style.cursor = 'grabbing';
		}
	}

	popCursor() {
		if (this.upCursor) {
			this.svg.style.cursor = this.upCursor;
			this.upCursor = undefined;
		}
	}
}
