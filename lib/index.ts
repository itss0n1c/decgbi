import pako from 'pako';

function crc32(buf: Uint8Array): number {
	const table =
		crc32.table ||
		(crc32.table = (() => {
			const t = new Uint32Array(256);
			for (let i = 0; i < 256; ++i) {
				let c = i;
				for (let k = 0; k < 8; ++k) {
					c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
				}
				t[i] = c;
			}
			return t;
		})());

	let crc = -1;
	for (let i = 0; i < buf.length; ++i) {
		crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ -1) >>> 0;
}

crc32.table = undefined as unknown as Uint32Array;

const PNG_SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const u32 = (b: Uint8Array, o: number) => (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
const w32 = (v: number, d: Uint8Array, o: number) => {
	d[o] = v >>> 24;
	d[o + 1] = v >>> 16;
	d[o + 2] = v >>> 8;
	d[o + 3] = v;
};

function defilter(raw: Uint8Array, w: number, h: number, bpp: number): Uint8Array {
	const row = w * bpp;
	const out = new Uint8Array(h * row);
	let p = 0;
	let q = 0;

	for (let y = 0; y < h; ++y) {
		const type = raw[p++];
		switch (type) {
			case 0:
				out.set(raw.subarray(p, p + row), q);
				break;
			case 1:
				for (let x = 0; x < row; ++x) {
					const left = x >= bpp ? out[q + x - bpp] : 0;
					out[q + x] = (raw[p + x] + left) & 0xff;
				}
				break;
			case 2:
				for (let x = 0; x < row; ++x) {
					const up = y ? out[q + x - row] : 0;
					out[q + x] = (raw[p + x] + up) & 0xff;
				}
				break;
			case 3:
				for (let x = 0; x < row; ++x) {
					const left = x >= bpp ? out[q + x - bpp] : 0;
					const up = y ? out[q + x - row] : 0;
					out[q + x] = (raw[p + x] + ((left + up) >> 1)) & 0xff;
				}
				break;
			case 4: {
				const paeth = (a: number, b: number, c: number) => {
					const p = a + b - c;
					const pa = Math.abs(p - a);
					const pb = Math.abs(p - b);
					const pc = Math.abs(p - c);
					return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
				};
				for (let x = 0; x < row; ++x) {
					const a = x >= bpp ? out[q + x - bpp] : 0;
					const b = y ? out[q + x - row] : 0;
					const c = x >= bpp && y ? out[q + x - row - bpp] : 0;
					out[q + x] = (raw[p + x] + paeth(a, b, c)) & 0xff;
				}
				break;
			}
			default:
				throw new Error(`Unknown PNG filter ${type}`);
		}
		p += row;
		q += row;
	}
	return out;
}

/**
 * Decodes a PNG image with CgBI chunk.
 * @param data The PNG image data as a Uint8Array.
 * @returns A Uint8Array containing the decoded PNG image data.
 */
function decgbi(data: Uint8Array): Uint8Array {
	if (!PNG_SIG.every((v, i) => v === data[i])) throw new Error('Not a PNG');

	let offset = 8;
	let width = 0;
	let height = 0;
	const idat: Uint8Array[] = [];
	let hasCgBI = false;

	while (offset < data.length) {
		const len = u32(data, offset);
		const type = String.fromCharCode(...data.subarray(offset + 4, offset + 8));
		const body = data.subarray(offset + 8, offset + 8 + len);
		if (type === 'CgBI') hasCgBI = true;
		else if (type === 'IHDR') {
			width = u32(body, 0);
			height = u32(body, 4);
		} else if (type === 'IDAT') idat.push(body);
		offset += 12 + len;
	}

	if (!hasCgBI) return data;

	const rawBuf = pako.inflateRaw(Uint8Array.from(idat.flatMap((b) => Array.from(b))));

	const bpp = 4;
	const pixels = defilter(rawBuf, width, height, bpp);
	for (let i = 0; i < pixels.length; i += 4) {
		const b = pixels[i];
		const r = pixels[i + 2];
		pixels[i] = r;
		pixels[i + 2] = b;
	}

	const row = width * bpp;
	const filtered = new Uint8Array((row + 1) * height);
	for (let y = 0; y < height; ++y) {
		filtered[y * (row + 1)] = 0;
		filtered.set(pixels.subarray(y * row, y * row + row), y * (row + 1) + 1);
	}

	const deflated = pako.deflate(filtered);

	const chunks: Uint8Array[] = [];
	const push = (typeStr: string, bytes: Uint8Array) => {
		const len = new Uint8Array(4);
		w32(bytes.length, len, 0);
		const type = new TextEncoder().encode(typeStr);
		const crc = new Uint8Array(4);
		w32(crc32(new Uint8Array([...type, ...bytes])), crc, 0);
		chunks.push(len, type, bytes, crc);
	};

	const ihdr = new Uint8Array(13);
	w32(width, ihdr, 0);
	w32(height, ihdr, 4);
	ihdr.set([8, 6, 0, 0, 0], 8);
	push('IHDR', ihdr);
	push('IDAT', deflated);
	push('IEND', new Uint8Array());

	const totalLength = PNG_SIG.length + chunks.reduce((sum, arr) => sum + arr.length, 0);
	const result = new Uint8Array(totalLength);
	let pos = 0;
	result.set(PNG_SIG, pos);
	pos += PNG_SIG.length;
	for (const chunk of chunks) {
		result.set(chunk, pos);
		pos += chunk.length;
	}
	return result;
}

export { decgbi };
export default decgbi;
