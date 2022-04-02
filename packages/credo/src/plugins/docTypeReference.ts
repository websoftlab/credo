import {cwdPath, existsStat} from "../utils";
import {readFile, writeFile} from "fs/promises";

function ref(name: string) {
	return `/// <reference types="${name}/global" />`;
}

export default async function docTypeReference(name: string | string[]) {
	const file = cwdPath("credo-env.d.ts");
	const stat = await existsStat(file);

	let text = "";
	let update = false;

	function add(line: string) {
		if(!text.includes(line)) {
			update = true;
			text = line + "\n" + text;
		}
	}

	if(stat) {
		if(stat.isFile) {
			text = (await readFile(file)).toString();
		} else {
			return;
		}
	}

	if(!Array.isArray(name)) {
		name = [name];
	}

	name.map(ref).forEach(add);
	add(`/// <reference types="@credo-js/types/index" />`);

	if(update) {
		await writeFile(file, text);
	}
}