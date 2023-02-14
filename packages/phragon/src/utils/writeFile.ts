import type { WriteFileOptions } from "fs";
import type { FileHandle } from "fs/promises";
import { open, unlink, writeFile as fsWriteFile } from "fs/promises";
import { constants } from "fs";

function wait() {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, 50);
	});
}

async function lockFile(path: string): Promise<FileHandle> {
	const lockPath = `${path}.lock`;
	try {
		return await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR);
	} catch (err) {
		await wait();
		return lockFile(path);
	}
}

async function unlockFile(path: string): Promise<void> {
	const lockPath = `${path}.lock`;
	try {
		await unlink(lockPath);
	} catch (err) {
		return unlockFile(path);
	}
}

export default async function writeFile(file: string, data: string, options?: WriteFileOptions | null) {
	const handle = await lockFile(file);
	await fsWriteFile(file, data, options);
	await handle.close();
	await unlockFile(file);
}
