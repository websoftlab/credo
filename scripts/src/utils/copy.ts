import {copyFile, mkdir, readdir, stat} from "fs/promises";
import {dirname, join} from "path";
import debug from "../debug";
import exists from "./exists";
import localPathName from "./localPathName";

async function cpFile(src: string, dst: string) {
	// file exists
	if(await exists(dst)) {
		return;
	}

	const fileDir = dirname(dst);
	if(!await exists(fileDir)) {
		await mkdir(fileDir, {recursive: true});
	}

	await copyFile(src, dst);
	debug(`Copy file from {yellow %s} to {yellow %s}`, localPathName(src), localPathName(dst));
}

async function cpDirectory(src: string, dst: string) {

	// make directory
	if(!await exists(dst)) {
		await mkdir(dst);
	}

	const files = await readdir(src);

	for(const file of files) {
		const srcPath = join(src, file);
		const dstPath = join(dst, file);

		const info = await stat(srcPath);
		if(info.isDirectory()) {
			await cpDirectory(srcPath, dstPath);
		} else if(info.isFile()) {
			await cpFile(srcPath, dstPath);
		}
	}
}

export default async function copy(src: string, dst: string) {
	if(!await exists(src)) {
		return;
	}

	const info = await stat(src);
	if(info.isFile()) {
		return cpFile(src, dst);
	}

	if(!info.isDirectory()) {
		return;
	}

	// create dest path
	if(!await exists(dst)) {
		debug(`Make directory {yellow %s}`, localPathName(dst));
		await mkdir(dst, {recursive: true});
	}

	return cpDirectory(src, dst);
}
