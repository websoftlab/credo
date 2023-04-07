import { join } from "node:path";

export default function buildPath(...args: string[]) {
	return join(process.cwd(), ".phragon/", ...args);
}
