import { toAsync } from "@phragon-util/async";
import { writeFile } from "fs/promises";
import { debug } from "../debug";
import cwdPath from "./cwdPath";
import exists from "./exists";
import localPathName from "./localPathName";

export default async function createCwdFileIfNotExists(
	file: string,
	builder: string | (() => string | Promise<string>)
) {
	const full = cwdPath(file);
	if (await exists(full)) {
		return full;
	}

	let text = builder;
	if (typeof text === "function") {
		text = await toAsync(text());
	}

	await writeFile(full, text);
	debug(`Make file {yellow %s}`, localPathName(full));

	return full;
}
