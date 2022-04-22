import spawn from "cross-spawn";
import type { SpawnOptions } from "child_process";

export default async function (command: string, args: string[] = [], options: SpawnOptions = {}) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: "inherit",
			...options,
		});
		child.on("close", (code) => {
			if (code !== 0) {
				reject({
					command: `${command} ${args.join(" ")}`,
				});
			} else {
				resolve();
			}
		});
	});
}
