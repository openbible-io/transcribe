import { LitElement, html, svg, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

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
		`
	];

	@property({ type: String }) href?: string;
	@property({ type: Number }) width: number = 0;
	@property({ type: Number }) height: number = 0;
	@property({ type: Number }) zoomMult: number = 0.05;
	@property({ type: Number }) rotMult: number = 5;
	/// Average size in pixels of text in `href`.
	@property({ type: Number }) fontSize: number = 32;
	@property({ type: Number }) backgroundOpacity: number = 0.5;
	@property({ type: Number }) foregroundOpacity: number = 1;

	@state() lastFontSize = this.fontSize;
	@state() strokeWidth = 5;
	@state() transform = new DOMMatrix();
	@state() mode: 'pan' | 'measure' | 'path' | 'edit' = 'pan';

	/// timeout used for gestures to prevent jerking when releasing one of two fingers
	@state() scale = 1;
	@state() allowTouch = true;
	@state() touches?: TouchList;
	@state() touchTransform = new DOMMatrix();

	@state() measure?: { start: Point, end: Point };

	@state() words: Word[] = [];
	@state() selectedWord?: Word;
	@state() selectedStretch = false;

	connectedCallback() {
		super.connectedCallback()
		this.fontSize = Math.round(this.width / 40);
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
	
	onMouseDown(ev: PointerEvent) {
		if (this.mode == 'measure') {
			if (ev.button != 0) return;
			const start = this.toViewport(ev.x, ev.y);
			if (!this.measure) this.measure = { start, end: start };
			this.lastFontSize = this.fontSize;
		} else if (this.mode == 'path') {
			if (ev.button != 0) return;
			this.addWord(ev.x, ev.y);
		} else if (this.mode == 'edit') {
			if (!this.selectedWord) throw Error('fix bug');
			const editingG = this.svg()
				.getElementById(`word${this.selectedWord.index}`)!
				.parentElement! as unknown as SVGGElement;
			if (!rectContains(editingG.getBoundingClientRect(), ev.x, ev.y)) {
				this.mode = 'pan';
				this.selectedWord = undefined;
			}
		}
	}

	onMouseMove(ev: MouseEvent) {
		ev.stopPropagation();
		if (this.mode == 'measure') {
			if (this.measure) {
				this.measure = { start: this.measure.start, end: this.toViewport(ev.x, ev.y) };
				this.fontSize = Math.round(this.measure.start.distance(this.measure.end));
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
		} else if (this.mode == 'pan') {
			if (ev.buttons & 1) {
				this.pan(ev.movementX, ev.movementY);
				return;
			}
		}
		if (ev.buttons & 4) {
			this.pan(ev.movementX, ev.movementY);
		}
	}

	onMouseUp(_ev: PointerEvent) {
		if (this.mode == 'measure') {
			this.mode = 'pan';
			if (this.measure) setTimeout(() => this.measure = undefined, 200);
		} else if (this.mode == 'path') {
			this.shadowRoot?.getElementById('textInput')?.focus();
			this.mode = 'edit';
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

	onCtx(ev: PointerEvent) {
		console.log('dbl', ev.x, ev.y);
		ev.preventDefault();
		if (this.mode == 'pan') {
			this.addWord(ev.x, ev.y);
			this.mode = 'path';
		}
	}

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
		if (this.mode == 'measure') {
			if (ev.key == 'Escape') {
				this.fontSize = this.lastFontSize;
				this.mode = 'pan';
				this.measure = undefined;
			}
		} else if (this.mode == 'path') {
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
		const pointEdit = (point: DOMPoint) => svg`
			<g>
				<circle
					cx="${point.x}"
					cy="${point.y}"
					r="${this.strokeWidth * 2}"
					@pointermove="${(ev: PointerEvent) => {
						if (!(ev.buttons & 1)) return;
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
				${this.selectedWord && html`
					<input
						id="textInput"
						.value="${this.selectedWord!.text}"
						@input="${(ev: InputEvent) => {
							const target = ev.target as HTMLInputElement;
							this.selectedWord!.text = target.value;
							this.requestUpdate('words');
						}}"
						@keydown="${(ev: KeyboardEvent) => {
							if (ev.key == 'Enter') {
								this.selectedWord = undefined;
								this.mode = 'pan';
								(ev.target as HTMLInputElement).blur();
							}
						}}"
						@focus="${() => this.selectedStretch = false}"
						@blur="${() => this.selectedStretch = true}"
					/>
					<button @click="${() => {
						this.selectedWord!.text = this.selectedWord!.text.replace(/[\u0591-\u05C7]/g, '');
						this.requestUpdate('selectedWord');
						this.requestUpdate('words');
					}}">
						Remove diacritics
					</button>
					<button @click="${() => {
						this.words.splice(this.selectedWord!.index, 1);
						this.selectedWord = undefined;
						this.mode = 'pan';
						this.requestUpdate('selectedWord');
						this.requestUpdate('words');
					}}">
						Delete word
					</button>
				`}
				<div style="flex: 1"></div>
				<label class="mode">${this.mode}</label>
			</div>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 ${this.width} ${this.height}"
				class="editor"
				@pointerdown="${this.onMouseDown}"
				@pointermove="${this.onMouseMove}"
				@pointerup="${this.onMouseUp}"
				@touchstart="${this.onTouchStart}"
				@touchmove="${this.onTouchMove}"
				@touchend="${this.onTouchEnd}"
				@wheel="${this.onWheel}"
				@contextmenu="${this.onCtx}"
				@dblclick="${this.onCtx}"
				style="font-size: ${this.fontSize}px"
				stroke="black"
				fill="pink"
			>
				<g transform="${this.transform.multiply(this.touchTransform).toString()}">
					<image href="${this.href}" opacity="${this.backgroundOpacity}" />
					<g opacity="${this.foregroundOpacity}">
						${this.words.map((w, i) => svg`
							<g
								@click="${() => {
									this.selectedWord = w;
									if (this.mode == 'edit') setTimeout(() => this.shadowRoot?.getElementById('textInput')?.focus(), 10);
									this.mode = 'edit';
								}}"
							>
								<path
									id="word${i}"
									stroke-width="${this.strokeWidth}"
									d="${w.textPathString()}"
								/>
								<text
									fill="black"
									dominant-baseline="${this.lang == 'he' ? 'hanging' : 'auto'}"
									lengthAdjust="spacingAndGlyphs"
									textLength="${(this.selectedWord === w && !this.selectedStretch) ? nothing : w.textPathLen()}"
								>
									<textPath href="#word${i}">
										${w.text}
									</textPath>
								</text>
							</g>
						`)}
					</g>
					${this.selectedWord && svg`
						${pointEdit(this.selectedWord.baselineStart)}
						${pointEdit(this.selectedWord.baselineEnd)}
					`}
					${this.measure && svg`
						<path
							d="M${this.measure.start.toString()} L${this.measure.end.toString()}"
							stroke-width="${5 / matrixScale(this.svg().getScreenCTM()!)}"
						/>
				</g>
				`}
			</svg>
		`;
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
		const p1 = this.baselineStart;
		const p2 = this.baselineEnd;
		return Math.hypot(p1.x - p2.x, p1.y - p2.y);
	}

	textPathString() {
		return `M${this.baselineEnd.toString()} L${this.baselineStart.toString()}`;
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
function rectContains(rect: DOMRect, x: number, y: number) {
	return (x >= rect.x && x <= rect.right && y >= rect.top && y <= rect.bottom);
}
