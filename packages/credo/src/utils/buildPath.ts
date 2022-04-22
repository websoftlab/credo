import { join } from "path";

export default function buildPath(...args: string[]) {
	return join(process.cwd(), ".credo/", ...args);
}
