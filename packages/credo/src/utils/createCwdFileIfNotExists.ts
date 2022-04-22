import { asyncResult } from "@credo-js/utils";
import { writeFile } from "fs/promises";
import { debugBuild } from "../debug";
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
		text = await asyncResult(text());
	}

	await writeFile(full, text);
	debugBuild(`Make file {yellow %s}`, localPathName(full));

	return full;
}
