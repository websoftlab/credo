import { cwdPath, existsStat } from "../utils";
import { readFile, writeFile } from "fs/promises";

function ref(name: string) {
	const ended = name.startsWith("@") ? name.lastIndexOf("/") !== name.indexOf("/") : name.includes("/");
	if (!ended) {
		name += "/global";
	}
	return `/// <reference types="${name}" />`;
}

export default async function docTypeReference(name: string | string[]) {
	const file = cwdPath("phragon-env.d.ts");
	const stat = await existsStat(file);

	let text = "";
	let update = false;

	function add(line: string) {
		if (!text.includes(line)) {
			update = true;
			text = line + "\n" + text;
		}
	}

	if (stat) {
		if (stat.isFile) {
			text = (await readFile(file)).toString();
		} else {
			return;
		}
	}

	if (!Array.isArray(name)) {
		name = [name];
	}

	name.map(ref).forEach(add);

	if (update) {
		await writeFile(file, text);
	}
}
