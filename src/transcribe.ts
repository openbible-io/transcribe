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
	/* Prevent double clicking from inconsistently selecting previous words */
	user-select: none;
}
.input {
	width: 100%;
	height: 100%;
	background: none;
}
.word {
	pointer-events: all;
}
.word:hover:not(.selected) {
	outline: 2px dashed blue;
}
.word.selected {
	outline: 2px solid blue;
}
.mode {
	align-self: right;
}
#textInput {
	border: none;
	outline: none;
	background: transparent;
	padding: 0;
	width: 100%;
	height: 100%;
}
.toolbar {
	position: fixed;
	pointer-events: none;
	display: flex;
	justify-content: center;
	left: 0;
	right: 0;
	bottom: 12px;
	z-index: 8;
}
.toolbar > div {
	position: relative;
	pointer-events: all;
}
.panelLeft {
	position: absolute;
	pointer-events: none;
	top: 0;
}
.panelLeft button,
.panelLeft input {
	pointer-events: all;
}
.baselinePoint {
	fill: pink;
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
	@property({ type: Number }) dblClickMs: number = 500;
	@property({ type: Number }) dblClickPxRadius: number = 8;

	@state() words: Word[] = [];
	@state() fontSize = 0;
	@state() fontColor = 'black';

	@state() strokeWidth = 5;
	@state() transform = new DOMMatrix();
	@state() mode: 'pan' | 'select' | 'textPosition' | 'textInput' | 'translate' = 'pan';
	/// For text input and select box select
	@state() startPos?: Point;
	/// Box select
	@state() endPos?: Point;
	@state() selectedWords: Set<number> = new Set();
	@state() selectedPoint?: Point;
	@state() editingWord?: number;
	@state() dblClickFirst?: Point;

	/// timeout used for gestures to prevent jerking when releasing one of two fingers
	@state() scale = 1;
	@state() allowTouch = true;
	@state() touches?: TouchList;
	@state() touchTransform = new DOMMatrix();

	connectedCallback() {
		super.connectedCallback()
		this.fontSize = Math.round(this.width / 20);
		this.strokeWidth = Math.round(this.fontSize / 10);
		window.addEventListener('pointermove', this.onPointerMove.bind(this));
		window.addEventListener('pointerup', this.onPointerUp.bind(this));
		window.addEventListener('keydown', this.onKeyDown.bind(this));
	}

	disconnectedCallback() {
		super.disconnectedCallback()
		window.removeEventListener('pointermove', this.onPointerMove.bind(this));
		window.removeEventListener('pointerup', this.onPointerUp.bind(this));
		window.removeEventListener('keydown', this.onKeyDown.bind(this));
	}

	panAmount(clientDx: number, clientDy: number) {
		const scale = matrixScale(this.svg().getScreenCTM()!);
		return new Point(clientDx / scale, clientDy / scale);
	}

	pan(clientDx: number, clientDy: number) {
		const amount = this.panAmount(clientDx, clientDy);
		this.transform = new DOMMatrix().translate(amount.x, amount.y).multiply(this.transform);
	}

	onPointerDown(ev: PointerEvent) {
		console.log('onPointerDown', this.mode);
		if (ev.button != 0) return;

		if (this.mode == 'textPosition') {
			this.mode = 'textInput';
			this.startPos = this.toViewport(ev.x, ev.y);
		} else if (this.mode == 'select') {
			this.selectedWords.clear();
			this.startPos = this.toViewport(ev.x, ev.y);
			this.endPos = this.startPos;
			this.requestUpdate('selectedWords');
		}
	}

	onPointerDownText(ev: PointerEvent, i: number) {
		if (this.mode == 'select' || this.mode == 'translate') {
			this.selectedWords.add(i);

			const p = new Point(ev.x, ev.y);
			if (this.dblClickFirst && p.distance(this.dblClickFirst) < this.dblClickPxRadius) {
				const w = this.words[i];
				this.editingWord = i;
				this.mode = 'textInput';
				const measured = this.measureText(w.text);
				this.startPos = w.commands[0].points[0].add(0, -this.fontSize - measured.ideographicBaseline);
				setTimeout(() => {
					const textInput = this.shadowRoot!.getElementById('textInput')! as HTMLInputElement;
					textInput.value = w.text;
					textInput.focus();
				});
			} else {
				this.mode = 'translate';
			}
			this.dblClickFirst = p;
			setTimeout(() => this.dblClickFirst = undefined, this.dblClickMs);
			ev.stopPropagation();
		}
	}

	onPointerMove(ev: PointerEvent) {
		if (this.mode == 'pan') {
			if (ev.buttons & 1) {
				this.pan(ev.movementX, ev.movementY);
				return;
			}
		} else if (this.mode == 'textPosition') {
			this.startPos = this.toViewport(ev.x, ev.y);
		} else if (this.mode == 'translate') {
			if (!(ev.buttons & 1)) return;
			if (this.selectedWords.size > 0) {
				const amount = this.panAmount(ev.movementX, ev.movementY);
				for (let i of this.selectedWords.values()) {
					this.words[i].translate(amount.x, amount.y);
				}
				this.requestUpdate('words');
			}
		} else if (this.mode == 'select') {
			if (ev.buttons & 1) {
				if (this.startPos) this.endPos = this.toViewport(ev.x, ev.y);
				if (this.selectedPoint) {
					const amount = this.panAmount(ev.movementX, ev.movementY);
					this.selectedPoint.x += amount.x;
					this.selectedPoint.y += amount.y;
					this.requestUpdate('words');
				}
				return;
			}
		}
		if ((ev.buttons & 2) || (ev.buttons & 4)) this.pan(ev.movementX, ev.movementY);
	}

	onPointerUp(_ev: PointerEvent) {
		if (this.mode == 'translate') {
			this.mode = 'select';
		} else if (this.mode == 'select') {
			this.startPos = this.endPos = undefined;
			this.selectedPoint = undefined;
		}
	}

	onKeyDown(ev: KeyboardEvent) {
		if (this.mode == 'select') {
			if (ev.key == 'Delete' || ev.key == 'Backspace') {
				this.words = this.words.filter((_, i) => !this.selectedWords.has(i));
				this.selectedWords.clear();
			}
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

	svg(): SVGSVGElement {
		return this.shadowRoot!.querySelector('svg')!;
	}

	font() {
		return `${this.fontSize}px sans`;
	}

	baseline() {
		return this.lang == 'he' ? 'hanging' : 'auto';
	}

	measureText(str: string) {
		const canvas = new OffscreenCanvas(10, 10);
		const ctx = canvas.getContext('2d')!;
		ctx.font = this.font();
		ctx.textBaseline = this.baseline() as CanvasTextBaseline;
		return ctx.measureText(str);
	}

	wordPath(str: string) {
		const measured = this.measureText(str);
		const from = this.startPos!.add(0, this.fontSize + measured.ideographicBaseline);
		const to = from.add(measured.width, 0);

		return [
			{ command: 'M', points: [from] },
			{ command: 'L', points: [to] },
		];
	}

	pathLength(d: string) {
		const path = document.createElementNS(xmlns, 'path');
		path.setAttribute('d', d);

		return path.getTotalLength();
	}

	toViewport(clientX: number, clientY: number): Point {
		return Point.fromDOMPoint(new DOMPoint(clientX, clientY)
			.matrixTransform(this.svg().getScreenCTM()!.inverse())
			.matrixTransform(this.transform.inverse()));
	}

	render() {
		const pointEdit = (point: Point) => svg`
			<circle
				fill="pink"
				cx="${point.x}"
				cy="${point.y}"
				r="${this.strokeWidth * 2}"
				@pointerdown="${(ev: PointerEvent) => {
					this.selectedPoint = point;
					ev.stopPropagation();
				}}"
			/>
		`;

		return html`
			<svg
				xmlns="${xmlns}"
				viewBox="0 0 ${this.width} ${this.height}"
				class="editor"
				@pointerdown="${this.onPointerDown}"
				@touchstart="${this.onTouchStart}"
				@touchmove="${this.onTouchMove}"
				@touchend="${this.onTouchEnd}"
				@wheel="${this.onWheel}"
				@contextmenu="${(ev: Event) => ev.preventDefault()}"
				stroke="${this.fontColor}"
				fill="${this.fontColor}"
			>
				<g transform="${this.transform.multiply(this.touchTransform).toString()}">
					<image href="${this.href}" opacity="${this.backgroundOpacity}" />
					<g opacity="${this.foregroundOpacity}" id="words">
						${this.words.map((w, i) => svg`
							<g
								class="word ${this.selectedWords.has(i) ? 'selected' : ''}"
								style="${styleMap({
									font: w.font,
									display: i == this.editingWord ? 'none' : null,
								})}"
							>
								<path id="word${i}" d="${w.fmtPath()}" fill="none" />
								<text lengthAdjust="spacingAndGlyphs">
									<textPath
										href="#word${i}"
										@pointerdown="${(ev: PointerEvent) => this.onPointerDownText(ev, i)}"
										textLength="${this.pathLength(w.fmtPath())}"
									>
										${w.text}
									</textPath>
								</text>
							</g>
						 `)}
					</g>
					${(this.mode == 'textPosition' || this.mode == 'textInput') && this.startPos && svg`
						<foreignObject
							x="${this.startPos.x}"
							y="${this.startPos.y}"
							width="${this.width * 2}"
							height="${this.fontSize}"
						>
							<input
								id="textInput"
								style="font: ${this.font()}"
								@blur="${(ev: FocusEvent) => {
									const str = (ev.target as HTMLInputElement).value;
									if (this.editingWord != undefined) {
										this.words[this.editingWord].text = str;
										const path = this.words[this.editingWord].commands;
										if (path.length == 2 && path[0].command == 'M' && path[1].command == 'L') {
											this.words[this.editingWord].commands = this.wordPath(str);
										}
										this.editingWord = undefined;
									} else {
										const path = this.wordPath(str);
										this.words.push(new Word(this.font(), this.lang, path, str));
										this.selectedWords.add(this.words.length - 1);
									}
									this.requestUpdate('words');
									this.startPos = undefined;
									this.mode = 'select';
								}}"
								@keydown="${(ev: KeyboardEvent) => {
									if (ev.key == 'Enter') (ev.target as HTMLInputElement).blur();
								}}"
							>
						</foreignObject>
					`}
					${this.mode == 'select' && this.startPos && this.endPos && svg`
						<path
							fill="rgba(0, 0, 255, 0.2)"
							d="M${this.startPos.toString()} h${(this.endPos.x - this.startPos.x).toFixed(0)} v${(this.endPos.y - this.startPos.y).toFixed(0)} h${(this.startPos.x - this.endPos.x).toFixed(0)}Z"
						/>
					`}
					${this.mode == 'select' && this.selectedWords.size == 1 && this.words[this.selectedWords.values().next().value].commands.map(c => c.points.map(pointEdit))}
				</g>
			</svg>
			<div class="panelLeft">
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
				${this.mode}
			</div>
			<div class="toolbar">
				<div>
					<button @click="${() => this.mode = 'pan'}">
						P
					</button>
					<button @click="${() => this.mode = 'select'}">
						S
					</button>
					<button @click="${(ev: PointerEvent) => {
						this.mode = 'textPosition';
						this.startPos = this.toViewport(ev.x, ev.y);
						setTimeout(() => this.shadowRoot!.getElementById('textInput')?.focus());
					}}">
						T
					</button>
				</div>
			</div>
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
	constructor(
		public font: string,
		public language: string,
		public commands: SVGCommand[],
		public text = '',
	) {}

	transform(fontSize: number): DOMMatrix {
		const p1 = this.commands[0].points[0];
		const lastCommand = this.commands[this.commands.length - 1];
		const p2 = lastCommand.points[lastCommand.points.length - 1];
		const rotX = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
		return new DOMMatrix()
			.translate(p1.x, p1.y - fontSize)
			.rotate(rotX);
	}

	translate(x: number, y: number) {
		this.commands.forEach(c => c.points.forEach(p => {
			p.x += x;
			p.y += y;
		}));
	}

	fmtPath() {
		return this.commands.map(c =>
			`${c.command}${c.points.map(p => p.toString()).join(',')}`
		).join(' ');
	}
}

const xmlns = 'http://www.w3.org/2000/svg';
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

type SVGCommand = {
	command: string,
	points: Point[],
};
