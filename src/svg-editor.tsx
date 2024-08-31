import { createEffect, createSignal, For, Switch, Match, batch } from 'solid-js';
import styles from './svg-editor.module.css';

const identity = new DOMMatrix([1, 0, 0, 1, 0, 0]);
const zoomMult = 0.05;
const panMult = 1;

interface SvgEditorProps {
	img: string;
	width: number;
	height: number
}
export function SvgEditor(props: SvgEditorProps) {
	type Mode = 'normal' | 'textInput';
	const [mode, setMode] = createSignal<Mode>('normal');
	const [transform, setTransform] = createSignal(identity);
	const [svg, setSvg] = createSignal<SVGSVGElement>();
	const [words, setWords] = createSignal<Word[]>([]);
	const [fontSize, setFontSize] = createSignal(180);
	const [strokeWidth, setStrokeWidth] = createSignal(5);
	const [v1, setV1] = createSignal<DOMPoint>();
	const [v2, setV2] = createSignal<DOMPoint>();
	const [backOpacity, setBackOpacity] = createSignal(1);
	const [frontOpacity, setFrontOpacity] = createSignal(1);

	createEffect(() => {
		// center our SVG using our transform instead of
		// preserveAspectRatio="xMidYMid meet"
		const s = svg();
		if (!s) return;
		const rect = s.getBoundingClientRect();
		const widthRatio = rect.width / props.width;
		const heightRatio = rect.height / props.height;
		const scale = Math.min(heightRatio, widthRatio);
		/// TODO: how to make this cleaner without conditionals?
		const translateX = scale == heightRatio ? (props.width - rect.width) * scale / 2 : 0;
		const translateY = scale == widthRatio ? (props.height - rect.height) * scale / 2 : 0;
		setTransform(identity.scale(scale, scale).translate(translateX, translateY));
	});

	function onMouseMove(ev: MouseEvent) {
		const s = svg();
		if (!s) return;
		if (v1()) setV2(toViewport(ev.x, ev.y));
		if (!(ev.buttons & 1 || ev.buttons & 4) || mode() != 'normal') return;
		ev.preventDefault();

		const t = transform();
		const mat = t.translate(ev.movementX * panMult / t.a, ev.movementY * panMult / t.d);
		setTransform(mat);

		if (v1()) setV2();
	}

	function onWheel(ev: WheelEvent) {
		const s = svg();
		if (!s) return;
		ev.preventDefault();

		const dir = ev.deltaY < 0 ? 1 : -1;
		const xFactor = 1 + dir * zoomMult;
		const yFactor = 1 + dir * zoomMult;
		const rect = s.getBoundingClientRect();
		const originX = ev.x - rect.x;
		const originY = ev.y - rect.y;
		const mat = identity
			.scale(xFactor, yFactor, 1, originX, originY)
			.multiply(transform());
		setTransform(mat);
	}

	function toViewport(clientX: number, clientY: number): DOMPoint {
		const s = svg();
		if (!s) throw Error('missing svg');
		const rect = s.getBoundingClientRect();
		const eleSpace = new DOMPoint(
			(clientX - rect.x),
			(clientY - rect.y),
		);
		return transform().inverse().transformPoint(eleSpace);
	}

	function onDblClick(ev: MouseEvent) {
		if (mode() != 'normal') return;
		ev.preventDefault();
		const mapped = toViewport(ev.x, ev.y);
		if (!v1()) {
			setV1(mapped);
		} else {
			batch(() => {
				setWords(w => [...w, new Word(v1()!, mapped, '')]);
				setV1();
				setV2();
			});
			svg()?.firstElementChild?.lastElementChild?.lastElementChild?.querySelector('input')?.focus();
		}
	}

	return (
		<>
			<div class={styles.toolbar}>
				<input type="number" value={fontSize()} onInput={ev => setFontSize(+ev.target.value)} />
				<input type="range" min="0" max="1" step={0.05} value={backOpacity()} onInput={ev => setBackOpacity(+ev.target.value)} />
				<input type="range" min="0" max="1" step={0.05} value={frontOpacity()} onInput={ev => setFrontOpacity(+ev.target.value)} />
				<button onClick={()=>console.log(words())}>words</button>
			</div>
			<svg
				class={styles.editor}
				preserveAspectRatio="xMinYMin meet"
				xmlns="http://www.w3.org/2000/svg"
				ref={setSvg}
				onMouseMove={onMouseMove}
				onWheel={onWheel}
				onDblClick={onDblClick}
			>
				<g transform={transform().toString()}>
					<image href={props.img} opacity={backOpacity()} />
					<Switch>
						<Match when={v2()}>
							<path
								stroke="blue"
								fill="none"
								stroke-width={strokeWidth()}
								d={`M${v1()!.x},${v1()!.y} L${v2()!.x},${v2()!.y}`}
							/>
						</Match>
						<Match when={v1()}>
							<circle
								fill="blue"
								cx={v1()!.x}
								cy={v1()!.y}
								r={strokeWidth()}
							/>
						</Match>
					</Switch>
					<g>
						<For each={words()}>
							{(w, i) =>
								<g opacity={frontOpacity()}>
									<path
										id={`word${i()}`}
										stroke="pink"
										fill="none"
										stroke-width={strokeWidth()}
										d={w.path()}
									/>
									<text
										fill="black"
										font-size={`${fontSize()}px`}
										dominant-baseline={w.dominantBaseline()}
										lengthAdjust="spacingAndGlyphs"
										textLength={w.pathLen()}
									>
										<textPath href={`#word${i()}`}>
											{w.text}
										</textPath>
									</text>
									<foreignObject
										width={w.pathLen()}
										height={fontSize()}
										transform={w.transform().toString()}
									>
										<input
											class={styles.input}
											style={{ "font-size": `${fontSize()}px` }}
											onMouseMove={ev => ev.stopPropagation()}
											onInput={ev => {
												w.text = ev.target.value;
											}}
											onFocus={() => setMode('textInput')}
											onBlur={() => {
												setMode('normal');
												setWords(old => old.with(i(), w.clone()));
											}}
										/>
									</foreignObject>
								</g>
							}
						</For>
					</g>
				</g>
			</svg>
		</>
	);
}

class Word {
	constructor(
		public v1: DOMPoint,
		public v2: DOMPoint,
		public text: string,
	) {}

	clone(): Word {
		return new Word(this.v1, this.v2, this.text);
	}

	lang() {
		if (this.text.match(/[\u0590-\u05FF]/) != null) return 'hebrew';
	}

	ltr(): boolean {
		switch (this.lang()) {
			case 'hebrew': return true;
			default: return false;
		}
	}

	dominantBaseline() {
		switch (this.lang()) {
			case 'hebrew': return 'hanging';
			default: return 'auto';
		}
	}

	p1(): DOMPoint {
		return this.v1.x < this.v2.x ? this.v1 : this.v2;
	}

	p2(): DOMPoint {
		return this.v1.x < this.v2.x ? this.v2 : this.v1;
	}

	path(): string {
		const p1 = this.p1();
		const p2 = this.p2();
		return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
	}

	pathLen(): number {
		const p1 = this.p1();
		const p2 = this.p2();
		return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
	}

	transform(): DOMMatrix {
		const p1 = this.p1();
		const p2 = this.p2();
		const rotX = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
		return identity
			.translate(p1.x, p1.y)
			.rotate(rotX);
	}
}

//import { createWorker, Line } from 'tesseract.js';
// const worker = await createWorker('heb', 1, {
// 	// logger: m => console.log(new Date().getTime(), m),
// });
// await worker.setParameters({
// 	tessedit_char_whitelist: 'אבּבגדהוזחטיכּלמנסעפּפצקרשׁשׂתּת',
// });
// const { data } = await worker.recognize(props.img);
// setLines(data.lines);
// await worker.terminate();
