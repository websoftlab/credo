import {dirname, basename} from "path";

let cwdPath: string | null = null;

function find(): string {
	let file = __dirname;
	while(file) {
		const parent = dirname(file);
		if(!parent) {
			break;
		}
		if(basename(file) === "scripts") {
			return dirname(file);
		}
		file = parent;
	}

	throw new Error("Can't create CWD path, invalid parameters");
}

export default function cwd() {
	if(cwdPath == null) {
		cwdPath = find();
	}
	return cwdPath;
}