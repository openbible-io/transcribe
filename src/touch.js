import { getTransform, setTransform } from './helpers.js';

/**
 * @param {TouchList} touches
 */
function distance(touches) {
	let [t1, t2] = touches;
	return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}
/**
 * @param {TouchList} touches
 */
function angle(touches) {
	let [t1, t2] = touches;
	let dx = t2.clientX - t1.clientX;
	let dy = t2.clientY - t1.clientY;
	return (Math.atan2(dy, dx) * 180) / Math.PI;
}
/**
 * @param {TouchList} touches
 */
function midpoint(touches) {
	let [t1, t2] = touches;
	return new DOMPoint((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
}

export class Touch {
	/** @param {SVGSVGElement} svg */
	constructor(svg) {
		this.svg = svg;
		/** @type {SVGGElement} */
		this.view = svg.getElementById('view');
		this.allow = true;
		this.svg.addEventListener('touchstart', this.touchstart.bind(this));
		this.svg.addEventListener('touchmove', this.touchmove.bind(this));
		this.svg.addEventListener('touchend', this.touchend.bind(this));
	}

	/**
	 * @param {TouchEvent} ev
	 */
	touchstart(ev) {
		if (ev.touches.length == 2 && this.allow) {
			ev.preventDefault();
			this.touches = ev.touches;
		}
	}

	/**
	 * @param {TouchEvent} ev
	 */
	touchmove(ev) {
		if (ev.touches.length == 2) {
			if (!this.touches) return this.touchstart(ev);
			ev.preventDefault();

			const transform = getTransform(this.view);
			const scale = distance(ev.touches) / distance(this.touches);
			const rotation = angle(ev.touches) - angle(this.touches);
			const mpStart = midpoint(this.touches);
			const mpCur = midpoint(ev.touches);
			const translationX = mpCur.x - mpStart.x;
			const translationY = mpCur.y - mpStart.y;
			const origin = mpStart
				.matrixTransform(this.svg.getScreenCTM().inverse())
				.matrixTransform(transform.inverse());

			const touchTransform = this.svg.createSVGMatrix()
				.translate(origin.x, origin.y)
				.translate(translationX, translationY)
				.rotate(rotation)
				.scale(scale)
				.translate(-origin.x, -origin.y);
			setTransform(this.view, transform.multiply(touchTransform));
			this.touches = ev.touches;
		}
	}

	touchend() {
		this.touches = undefined;
		this.allow = false;
		setTimeout(() => this.allow = true, 200);
	}
}
