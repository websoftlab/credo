import {join} from "path";
import {exists} from "../utils";
import {spawn} from "child_process";

export default async function cmdCmd() {
	const file = join(process.cwd(), "build/server/cmd.js");
	if(!await exists(file)) {
		throw new Error("Build cmd-server file not found");
	}
	spawn(process.argv[0], [file].concat(process.argv.slice(3)), {
		cwd: process.cwd(),
		stdio: "inherit",
	});
	return -1;
}