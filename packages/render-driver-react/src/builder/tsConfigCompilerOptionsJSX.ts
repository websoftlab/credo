import {join} from "path";
import {exists, readJsonFile, writeJsonFile} from "credo/utils/index";
import {debug} from "@credo-js/utils/srv/index";

export default async function tsConfigCompilerOptionsJSX(cwd: string) {
	const file = join(cwd, "./tsconfig.json");
	if(!await exists(file)) {
		return debug.error("WARNING! {yellow %s} file not found", "./tsconfig.json");
	}

	const data = await readJsonFile(file);
	if(!data.compilerOptions) {
		data.compilerOptions = {};
	}

	const opt = data.compilerOptions;
	if(!opt.jsx) {
		opt.jsx = "react-jsx";
		if(!opt.types) {
			opt.types = ["react"];
		} else if(!opt.types.includes("react")) {
			opt.types.push("react");
		}
		await writeJsonFile(file, data);
	}
}