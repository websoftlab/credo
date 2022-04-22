import spawn from "cross-spawn";
import type { SpawnOptions } from "child_process";

export default async function cmdData(
	command: string,
	args: string[] = [],
	options: SpawnOptions = {}
): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: "pipe",
			...options,
		});

		let text: string = "";
		let error: string = "";

		child.stdout?.on("data", (chunk) => {
			text += chunk;
		});

		child.stderr?.on("data", (chunk) => {
			error += chunk;
		});

		child.on("close", (code) => {
			if (code !== 0) {
				if (!error) {
					error = `CMD failure: ${command} ${args.join(" ")}`;
				}
				reject(new Error(error));
			} else {
				resolve(text);
			}
		});
	});
}
