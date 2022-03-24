import {join} from "path";
import cwd from "./cwd";

export default function cwdPath(... args: string[]) {
	return join(cwd(), ...args);
}