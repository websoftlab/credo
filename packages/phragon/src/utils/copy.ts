import { copyFile, mkdir, readdir, stat } from "fs/promises";
import { dirname, join } from "path";
import { debugBuild } from "../debug";
import exists from "./exists";
import localPathName from "./localPathName";
import normalizeFilePath from "./normalizeFilePath";

export default async function copy(src: string, dst: string) {
	src = normalizeFilePath(src);
	dst = normalizeFilePath(dst);

	if (!(await exists(src))) {
		return;
	}

	const info = await stat(src);
	if (info.isFile()) {
		// file exists
		if (await exists(dst)) {
			return;
		}

		const fileDir = dirname(dst);
		if (!(await exists(fileDir))) {
			await mkdir(fileDir, { recursive: true });
		}

		await copyFile(src, dst);
		debugBuild(`Copy file from {yellow %s} to {yellow %s}`, localPathName(src), localPathName(dst));
		return;
	}

	if (!info.isDirectory()) {
		return;
	}

	// create dest path
	if (!(await exists(dst))) {
		debugBuild(`Make directory {yellow %s}`, localPathName(dst));
		await mkdir(dst, { recursive: true });
	}

	const _copy = async (prefix: string) => {
		const srcPath = prefix ? join(src, prefix) : src;
		const dstPath = prefix ? join(dst, prefix) : dst;

		if (!(await exists(dstPath))) {
			await mkdir(dstPath);
		}

		const files = await readdir(srcPath);

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const srcFilePath = join(srcPath, file);
			const srcInfo = await stat(srcFilePath);
			if (srcInfo.isDirectory()) {
				await _copy(prefix ? `${prefix}/${file}` : file);
			} else if (srcInfo.isFile()) {
				const dstFilePath = join(dstPath, file);
				if (!(await exists(dstFilePath))) {
					await copyFile(srcFilePath, dstFilePath);
					debugBuild(
						`Copy file from {yellow %s} to {yellow %s}`,
						localPathName(srcFilePath),
						localPathName(dstFilePath)
					);
				}
			}
		}
	};

	return _copy("");
}
