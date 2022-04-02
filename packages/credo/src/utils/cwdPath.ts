import {join} from "path";

export default function cwdPath(... args: string[]) {
	return join(process.cwd(), ...args);
}