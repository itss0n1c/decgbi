import { test } from 'bun:test';
import { join } from 'node:path';
import { decgbi } from './index.js';

const proj_root = join(import.meta.url.replace(`file://${process.platform === 'win32' ? '/' : ''}`, ''), '../..');

const test_folder = join(proj_root, 'test');
const img_path = Bun.file(join(test_folder, 'cgbi.png'));
const out_path = Bun.file(join(test_folder, 'out.png'));
async function prepare_img() {
	let buf: ArrayBuffer | undefined;
	if (!(await img_path.exists())) {
		const res = await fetch('https://files.s0n1c.ca/images/miru_cgbi.png');
		buf = await res.arrayBuffer();
		await img_path.write(buf);
	} else {
		buf = await img_path.arrayBuffer();
	}

	return new Uint8Array(buf);
}

test('test hello', async () => {
	const img = await prepare_img();
	// console.log(Buffer.from(img).toBase64());
	const out = decgbi(img);
	await out_path.write(out);
});
