import {mkdir, readdir, stat, rename} from "fs/promises";
import {dirname, join, sep} from "path";
import debug from "../debug";
import exists from "./exists";
import {newError} from "../color";
import localPathName from "./localPathName";

async function mv(src: string, dst: string) {
	await rename(src, dst);
	debug(`Move file from {yellow %s} to {yellow %s}`, localPathName(src), localPathName(dst));
}

async function checkDir(dst: string) {
	const fileDir = dirname(dst);
	if(!await exists(fileDir)) {
		await mkdir(fileDir, {recursive: true});
	}
}

async function checkExists(src: string, dst: string) {
	if(await exists(dst)) {
		throw newError("Can't move file from {yellow %s} to {yellow %s}, target file already exists", localPathName(src), localPathName(dst));
	}
}

export default async function move(src: string, dst: string) {
	if(src === dst || !await exists(src)) {
		return;
	}

	if(src.startsWith(dst.concat(sep)) || dst.startsWith(src.concat(sep))) {
		throw newError("Can't move file from {yellow %s} to {yellow %s}, there is a nested dependency", localPathName(src), localPathName(dst));
	}

	const info = await stat(src);
	if(info.isFile()) {
		await checkExists(src, dst);
		await checkDir(dst);
		await mv(src, dst);
		return;
	}

	if(!info.isDirectory()) {
		return;
	}

	const files = await readdir(src);
	const items: Array<{src: string, dst: string}> = [];

	for(const file of files) {
		const srcPath = join(src, file);
		const dstPath = join(dst, file);

		const info = await stat(srcPath);
		if(info.isDirectory() || info.isFile()) {
			await checkExists(srcPath, dstPath);
			items.push({
				src: srcPath,
				dst: dstPath,
			});
		}
	}

	await checkDir(dst);
	for(const item of items) {
		await mv(item.src, item.dst);
	}
}
