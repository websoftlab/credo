import { join } from "node:path";

export default function cwdPath(...args: string[]) {
	return join(process.cwd(), ...args);
}
