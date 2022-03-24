import cwd from "./cwd";
import {relative} from "path";

export default function localPathName(file: string) {
	const pref = cwd();
	if(file === pref) {
		return "./";
	}
	let local = relative(pref, file);
	if(local.includes("\\")) {
		local = local.replace(/\\/g, "/");
	}
	return local;
}