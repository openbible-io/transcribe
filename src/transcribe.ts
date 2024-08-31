import { LitElement, html, svg, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { styleMap } from 'lit/directives/style-map.js';

@customElement('ob-transcribe')
export class Transcribe extends LitElement {
	static styles = [
		css`
:host {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
}
svg {
	touch-action: none;
}
.editor {
	flex: 1;
	width: 100vw;
	/* Prevent double clicking from inconsistently selecting previous words */
	user-select: none;
}
.input {
	width: 100%;
	height: 100%;
	background: none;
}
.wordBaseline {
	stroke-width: 5px;
}
.toolbar {
	display: flex;
	margin: 4px;
	flex-wrap: wrap;
}
.toolbar > * {
	margin-left: 2px;
}
.mode {
	align-self: right;
}
#textInput {
	border: none;
	background: transparent;
	padding: 0;
}
		`
	];

	@property({ type: String }) href?: string;
	@property({ type: Number }) width: number = 0;
	@property({ type: Number }) height: number = 0;
	@property({ type: Number }) zoomMult: number = 0.05;
	@property({ type: Number }) rotMult: number = 5;
	@property({ type: Number }) backgroundOpacity: number = 0.5;
	@property({ type: Number }) foregroundOpacity: number = 1;

	@state() fontSize = 0;
	@state() fontColor = 'black';

	@state() strokeWidth = 5;
	@state() transform = new DOMMatrix();
	@state() mode: 'normal' | 'path' | 'word' = 'normal';

	/// timeout used for gestures to prevent jerking when releasing one of two fingers
	@state() scale = 1;
	@state() allowTouch = true;
	@state() touches?: TouchList;
	@state() touchTransform = new DOMMatrix();

	@state() words: Word[] = [];
	@state() selectedWord?: Word;

	connectedCallback() {
		super.connectedCallback()
		this.fontSize = Math.round(this.width / 20);
		this.strokeWidth = Math.round(this.fontSize / 10);
		window.addEventListener('keydown', this.onKeyDown.bind(this));
	}

	disconnectedCallback() {
		super.disconnectedCallback()
		window.removeEventListener('keydown', this.onKeyDown.bind(this));
	}

	pan(clientDx: number, clientDy: number) {
		const scale = matrixScale(this.svg().getScreenCTM()!);
		const dx = clientDx / scale;
		const dy = clientDy / scale;
		this.transform = new DOMMatrix().translate(dx, dy).multiply(this.transform);
	}

	onPointerDown(ev: PointerEvent) {
		console.log('onPointerDown', ev.button);
		if (ev.button != 0) return;

		if (this.mode == 'normal') {
			this.addWord(ev.x, ev.y);
			this.mode = 'path';
		} else if (this.mode == 'word') {
			this.mode = 'normal';
			this.selectedWord = undefined;
		}
	}

	onPointerDownWord(ev: PointerEvent, w: Word) {
		console.log('onPointerDownWord');
		ev.stopPropagation();

		this.selectedWord = w;
		this.mode = 'word';
	}

	onPointerMove(ev: MouseEvent) {
		ev.stopPropagation();
		console.log('onPointerMove', this.mode);

		if (this.mode == 'normal') {
			if (ev.buttons & 2) {
				this.pan(ev.movementX, ev.movementY);
				return;
			}
		} else if (this.mode == 'path') {
			if (this.selectedWord) {
				if (this.lang == 'hb') {
					this.selectedWord.baselineEnd = this.toViewport(ev.x, ev.y);
				} else {
					this.selectedWord.baselineStart = this.toViewport(ev.x, ev.y);
				}
				this.requestUpdate('words');
			}
		}
		if ((ev.buttons & 2) || (ev.buttons & 4)) this.pan(ev.movementX, ev.movementY);
	}

	onPointerUp(_ev: PointerEvent) {
		if (this.mode == 'path') {
			this.shadowRoot?.getElementById('textInput')?.focus();
			this.mode = 'word';
			this.requestUpdate('words');
		}
	}

	onWheel(ev: WheelEvent) {
		ev.preventDefault();

		const dir = ev.deltaY < 0 ? 1 : -1;
		if (ev.ctrlKey) {
			const origin = new DOMPoint(this.width / 2, this.height / 2);
			this.transform = new DOMMatrix()
				.translate(origin.x, origin.y)
				.rotate(dir * this.rotMult)
				.translate(-origin.x, -origin.y)
				.multiply(this.transform);
		} else {
			const scale = 1 + dir * this.zoomMult;
			const origin = new DOMPoint(ev.x, ev.y).matrixTransform(this.svg().getScreenCTM()!.inverse());
			this.transform = new DOMMatrix()
				.scale(scale, scale, 1, origin.x, origin.y)
				.multiply(this.transform);
		}
	}

	// Touch events only for 2 finger zoom/pan
	onTouchStart(ev: TouchEvent) {
		if (ev.touches.length == 2 && this.allowTouch) {
			ev.preventDefault();
			this.touches = ev.touches;
		}
	}

	onTouchMove(ev: TouchEvent) {
		if (ev.touches.length == 2) {
			if (!this.touches) return this.onTouchStart(ev);

			const scale = distance(ev.touches) / distance(this.touches);
			const rotation = angle(ev.touches) - angle(this.touches);
			const mpStart = midpoint(this.touches);
			const mpCur = midpoint(ev.touches);
			const translationX = mpCur.x - mpStart.x;
			const translationY = mpCur.y - mpStart.y;
			const origin = mpStart
				.matrixTransform(this.svg().getScreenCTM()!.inverse())
				.matrixTransform(this.transform.inverse());

			this.touchTransform = new DOMMatrix()
				.translate(origin.x, origin.y)
				.translate(translationX, translationY)
				.rotate(rotation)
				.scale(scale)
				.translate(-origin.x, -origin.y);
			ev.preventDefault();
		}
	}

	onTouchEnd(_ev: TouchEvent) {
		this.touches = undefined;
		this.transform = this.transform.multiply(this.touchTransform);
		this.touchTransform = new DOMMatrix();
		this.allowTouch = false;
		setTimeout(() => this.allowTouch = true, 200);
	}

	onKeyDown(ev: KeyboardEvent) {
		if (this.mode == 'path') {
			if (ev.key == 'Escape') this.deleteSelected();
		}
	}

	addWord(clientX: number, clientY: number) {
		const pos = this.toViewport(clientX, clientY);
		const word = new Word(pos, pos, this.words.length);
		this.words.push(word);
		this.selectedWord = word;
	}

	deleteSelected() {
		if (this.selectedWord) {
			this.words.splice(this.selectedWord.index, 1);
			this.requestUpdate('words');
		}
	}

	svg(): SVGSVGElement {
		return this.shadowRoot!.querySelector('svg')!;
	}

	toViewport(clientX: number, clientY: number): Point {
		return Point.fromDOMPoint(new DOMPoint(clientX, clientY)
			.matrixTransform(this.svg().getScreenCTM()!.inverse())
			.matrixTransform(this.transform.inverse()));
	}

	render() {
		const pathColor = 'pink';
		const pointEdit = (point: DOMPoint) => svg`
			<g>
				<circle
					fill="${pathColor}"
					cx="${point.x}"
					cy="${point.y}"
					r="${this.strokeWidth * 2}"
					@pointerdown="${(ev: PointerEvent) => ev.stopPropagation()}"
					@pointermove="${(ev: PointerEvent) => {
						if (!(ev.buttons & 1) || this.mode != 'word') return;
						ev.stopPropagation();

						const newPoint = this.toViewport(ev.x, ev.y);
						point.x = newPoint.x;
						point.y = newPoint.y;
						this.requestUpdate('selectedWord');
						this.requestUpdate('words');
						ev.stopPropagation();
					}}"
				/>
			</g>
		`;

		return html`
			<div class="toolbar">
				<button @click="${() => this.transform = new DOMMatrix()}">
					Fit
				</button>
				<div>
					<label>Color</label>
					<input
						type="color"
						.value="${this.fontColor}"
						@input="${(ev: InputEvent) => this.fontColor = (ev.target as HTMLInputElement).value}"
					>
				</div>
				<div>
					<label>Size</label>
					<input
						type="number"
						style="width: 5ch"
						.value="${this.fontSize}"
						@input="${(ev: InputEvent) => this.fontSize = +(ev.target as HTMLInputElement).value}"
					>
				</div>
				<div>
					<label>Background</label>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						.value="${this.backgroundOpacity}"
						@input="${(ev: Event) => this.backgroundOpacity = +(ev.target as HTMLInputElement).value}"
					>
				</div>
				<div>
					<label>Foreground</label>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						.value="${this.foregroundOpacity}"
						@input="${(ev: Event) => this.foregroundOpacity = +(ev.target as HTMLInputElement).value}"
					>
				</div>
				<div style="flex: 1"></div>
				<label class="mode">${this.mode}</label>
			</div>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 ${this.width} ${this.height}"
				class="editor"
				@pointerdown="${this.onPointerDown}"
				@pointermove="${this.onPointerMove}"
				@pointerup="${this.onPointerUp}"
				@touchstart="${this.onTouchStart}"
				@touchmove="${this.onTouchMove}"
				@touchend="${this.onTouchEnd}"
				@wheel="${this.onWheel}"
				@contextmenu="${(ev: Event) => ev.preventDefault()}"
				style="font-size: ${this.fontSize}px"
				stroke="${this.fontColor}"
				fill="${this.fontColor}"
			>
				<g transform="${this.transform.multiply(this.touchTransform).toString()}">
					<image href="${this.href}" opacity="${this.backgroundOpacity}" />
					<g opacity="${this.foregroundOpacity}">
						${this.words.map((w, i) => svg`
							<g
								display="${w == this.selectedWord ? 'none' : 'inline'}"
								@pointerdown="${(ev: PointerEvent) => this.onPointerDownWord(ev, w)}"
							>
								<path id="word${i}" d="${w.textPathString()}" stroke="none" fill="none" />
								<text
									dominant-baseline="${this.lang == 'he' ? 'hanging' : 'auto'}"
									lengthAdjust="spacingAndGlyphs"
									textLength="${this.selectedWord == w ? nothing : w.textPathLen()}"
								>
									<textPath href="#word${i}">
										${w.text}
									</textPath>
								</text>
							</g>
						`)}
					</g>
					${this.selectedWord && svg`
						<g id="selection">
							<foreignObject
								width="${this.selectedWord.textPathLen()}"
								height="${this.fontSize}"
								transform="${this.selectedWord.transform(this.fontSize).toString()}"
							>
								<input
									id="textInput"
									style="${styleMap({
										width: this.selectedWord.textPathLen() + 'px',
										fontSize: this.fontSize + 'px',
									})}"
									.value="${this.selectedWord!.text}"
									@input="${(ev: InputEvent) => {
										const target = ev.target as HTMLInputElement;
										this.selectedWord!.text = target.value;
										this.requestUpdate('words');
									}}"
									@keydown="${(ev: KeyboardEvent) => {
										if (ev.key == 'Enter') {
											this.selectedWord = undefined;
											this.mode = 'normal';
											(ev.target as HTMLInputElement).blur();
										}
									}}"
								/>
							</foreignObject>
							<path
								stroke-width="${this.strokeWidth}"
								d="${this.selectedWord.textPathString()}"
								fill="${pathColor}"
							/>
							${pointEdit(this.selectedWord.baselineStart)}
							${pointEdit(this.selectedWord.baselineEnd)}
						</g>
					`}
				</g>
			</svg>
		`;

								//<button @click="${() => {
								//	this.selectedWord!.text = this.selectedWord!.text.replace(/[\u0591-\u05C7]/g, '');
								//	this.requestUpdate('selectedWord');
								//	this.requestUpdate('words');
								//}}">
								//	Remove diacritics
								//</button>
								//<button @click="${() => {
								//	this.words.splice(this.selectedWord!.index, 1);
								//	this.selectedWord = undefined;
								//	this.mode = 'pan';
								//	this.requestUpdate('selectedWord');
								//	this.requestUpdate('words');
								//}}">
								//	Delete word
								//</button>
	}
}

class Word {
	text = ' ';

	constructor(
		public baselineStart: Point,
		public baselineEnd: Point,
		public index: number,
	) {}

	textPathLen(): number {
		const p1 = this.baselineEnd;
		const p2 = this.baselineStart;
		return Math.hypot(p1.x - p2.x, p1.y - p2.y);
	}

	textPathString() {
		return `M${this.baselineEnd.toString()} L${this.baselineStart.toString()}`;
	}

	transform(fontSize: number): DOMMatrix {
		const p1 = this.baselineEnd;
		const p2 = this.baselineStart;
		const rotX = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
		return new DOMMatrix()
			.translate(p1.x, p1.y - fontSize)
			.rotate(rotX);
	}
}

class Point extends DOMPoint {
	static fromDOMPoint(p: DOMPoint) {
		return new Point(p.x, p.y, p.z, p.w);
	}

	toString() {
		return `${this.x.toFixed(0)},${this.y.toFixed(0)}`;
	}

	add(x?: number, y?: number, z?: number) {
		return new Point(this.x + (x ?? 0), this.y + (y ?? 0), this.z + (z ?? 0));
	}

	mult(x?: number, y?: number, z?: number) {
		return new Point(this.x * (x ?? 0), this.y * (y ?? 0), this.z * (z ?? 0));
	}

	distance(other: DOMPoint) {
		return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z);
	}
}

function matrixScale(matrix: DOMMatrix) {
	return Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
}
function distance(touches: TouchList) {
	let [t1, t2] = touches;
	return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}
function angle(touches: TouchList) {
	let [t1, t2] = touches;
	let dx = t2.clientX - t1.clientX;
	let dy = t2.clientY - t1.clientY;
	return (Math.atan2(dy, dx) * 180) / Math.PI;
}
function midpoint(touches: TouchList) {
	let [t1, t2] = touches;
	return new DOMPoint((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
}
