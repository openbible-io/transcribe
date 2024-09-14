//! Downloads full resolution images for transcription from their original source.
//! We will mirror full resolution versions on a CDN for self-sufficiency.
import sharp from 'sharp';
import { mkdirSync, writeFileSync  } from 'node:fs';
import { dirname, basename } from 'node:path';

/**
 * Retry `fn` with an exponential backoff.
 */
async function retry(fn, maxAttempts = 10, baseDelayMs = 100) {
	for (let i = 1; i <= maxAttempts; i++) {
		try {
			return await fn();
		} catch (error) {
			console.warn('Retry', i, error.toString());
			const delayMs = baseDelayMs * (2 ** i);
			await new Promise(res => setTimeout(res, delayMs));
		}
	}
	throw new Error('Max attempts reached');
}

async function fetch200(url, opts) {
	const resp = await fetch(url, opts);
	if (resp.status != 200) throw Error(`${resp.status} ${url}`);
	return resp;
}

/**
 * Returns a full-resolution `sharp` image object of IIIF url by following `tiling` info.
 * Protocol: https://iiif.io/api/image/3.0/
 */
async function downloadIiif(base_url) {
	const resp = await retry(() => fetch200(`${base_url}/info.json`));
	const info = await resp.json();

	const tile_width = Math.max(...info.sizes.map(s => s.width));
	const tile_height = Math.max(...info.sizes.map(s => s.height));
	const fmt = info.profile[1].formats[0];

	const tiles = [];
	for (let i = 0; i < info.width; i += tile_width) {
		for (let j = 0; j < info.height; j += tile_height) {
			const left = i;
			const top = j;
			const width = Math.min(info.width - j, tile_width);
			const height = Math.min(info.height - j, tile_height);
			const region = `${left},${top},${width},${height}`;
			// /{region}/{size}/{rotation}/{quality}.{format}
			const url = `${base_url}/${region}/pct:100/0/default.${fmt}`;
			tiles.push({ left, top, width, height, url });
		}
	}
	await Promise.all(tiles.map(tile => retry(async() => {
		const resp = await fetch200(tile.url);
		tile.input = await resp.arrayBuffer();
		try {
			const img_sharp = sharp(tile.input);
			const meta = await img_sharp.metadata();
			if (meta.width != tile.width || meta.height != tile.height) {
				throw Error(`expected ${tile.width}x${tile.height}, got ${meta.width}x${meta.height}`);
			}
		} catch (e) {
			e.message += ` ${tile.url}`;
			throw e;
		}
	})));

	return sharp({
		create: {
			width: info.width,
			height: info.height,
			channels: 3,
			background: 'pink',
		}
	}).composite(tiles);
}

/**
 * Code: https://github.com/Scripta-Qumranica-Electronica/SQE_API
 *
 * This API is designed for the following flow (as of 2019):
 * - Admin adds raw "imaged objects" with foreground masks to SQL DB. Each foreground mask becomes
 *   an "artefact."
 * - Users may transcribe by adding polygon Regions of Interest ("ROI"s).
 * - Users may visually assemble artefacts into "manuscripts".
 * - Admin versions of artefacts, ROIs, and manuscripts are master copies. Users may clone and edit
 *   these. Users may request their version become the master version.
 *
 * For the purpose of critical textual analysis, we'd like the final manuscripts and leftover
 * artifacts both with transcriptions. However, the final manuscripts and transcriptions are often
 * missing. For this reason, we'll just take ALL the raw images and foreground polygons for later
 * processing.
 *
 * The images are stored on various iiif servers which a separate function handles.
 */
class SQE {
	constructor(base) {
		this.base = base ?? 'https://sqe-api.deadseascrolls.org.il/v1';
	}

	async fetch(path) {
		const url = `${this.base}${path}`;
		const resp = await retry(() => fetch200(url));
		return resp.json();
	}

	/**
	 * Returns "edition" ids, which loosely map to scrolls.
	 *
	 * @returns {Promise<number[]>} list of ids
	 */
	async index() {
		const editions = await this.fetch('/editions');
		return editions.editions.map(e => {
			if (e.length > 1) console.warn('strange edition', e);
			return e[0].id;
		});
	}

	async images(id) {
		const metadata = await this.fetch(`/editions/${id}/metadata`);
		const imaged_objects = await this.fetch(`/editions/${id}/imaged-objects?optional=artefacts&optional=masks`);

		const common = {
			name: metadata.manuscript,
			name_alt: metadata.abbreviation,
			material: metadata.material,
			book: metadata.composition,
			copy: metadata.copy,
			frag: metadata.frag,
			plate: metadata.plate,
			publication: metadata.publication,
			publication_num: metadata.publicationNumber,
		};
		const res = [];

		imaged_objects.imagedObjects.forEach(io => {
			['recto', 'verso'].forEach(side => io[side].images.forEach(img => {
				const fragments = (io.artefacts || [])
					.filter(a => a.side == side)
					.map(a => ({ name: a.name, mask: a.mask }));

				res.push({
					...common,
					id: io.id,
					side,
					type: img.type,
					url: img.url,
					fragments,
				});
			}));
		});

		return res;
	}
}

async function main() {
	const sqe = new SQE();
	// console.log('fetching index...');
	// const index = await sqe.index();
	const id = 937;
	console.log('fetching edition', id);
	const images = await sqe.images(id);
	console.log('downloading', images.length, 'images');
	const fmt = '.webp';
	while (images.length) {
		// Batches allow managable concurrency without running out of RAM.
		await Promise.all(images.splice(0, 10).map(async img => {
			// psa/dss/iaa/263-20-recto.webp
			const path = `dist/${img.book}/dss/${img.id}-${img.side}-${img.type}`;
			console.log(path, img.url);
			const img_sharp = await downloadIiif(img.url);
			mkdirSync(dirname(path), { recursive: true });

			const stats = await img_sharp.metadata();
			const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stats.width} ${stats.height}">
	<title>${img.id}</title>
	<metadata>
		<ob:OB xmlns:ob="http://not.real">
			<ob:name>${img.name}</ob:name>
			<ob:name_alt>${img.name_alt}</ob:name_alt>
			<ob:material>${img.material}</ob:material>
			<ob:copy>${img.copy}</ob:copy>
			<ob:frag>${img.frag}</ob:frag>
			<ob:plate>${img.plate}</ob:plate>
			<ob:publication>${img.publication}</ob:publication>
			<ob:publication_num>${img.publication_num}</ob:publication_num>
			<ob:url>${img.url}</ob:url>
		</ob:OB>
	</metadata>
	<image href="${basename(path)}${fmt}" />${img.fragments.map(f => `
	<polygon fill="rgba(0,0,100,0.5)" id="${f.name}" points="${f.mask.substring("POLYGON((".length, f.mask.length - 2).replaceAll(',', ' ')}" />`).join('\n')}
</svg>`;
			writeFileSync(path + '.svg', svg);
			try {
				await img_sharp.toFile(path + fmt);
			} catch (e) {
				console.error(img, e);
				throw e;
			}
		}));
	}
}

main();
