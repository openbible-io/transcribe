const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const text = "סָבִיב";
const x = 50;
const y = 100;
ctx.font = "64px Arial";
ctx.textBaseline = 'hanging';
ctx.fillText(text, x, y);

const textMetrics = ctx.measureText(text);
ctx.font = '10px serif';
ctx.fillStyle = 'red';
ctx.strokeStyle = 'red';
ctx.beginPath();
ctx.arc(x, y, 4, 0, 2 * Math.PI);
const props = [
	'actualBoundingBoxAscent',
	'actualBoundingBoxDescent',
	'alphabeticBaseline',
	'fontBoundingBoxAscent',
	'fontBoundingBoxDescent',
	'hangingBaseline',
	'ideographicBaseline',
];

props.forEach(k => {
  const v = textMetrics[k];
  const lineY = y + v;
  ctx.moveTo(0, lineY);
  ctx.lineTo(550, lineY);
  ctx.stroke();
  ctx.fillText(`${k} ${v}`, 250, lineY);
});
