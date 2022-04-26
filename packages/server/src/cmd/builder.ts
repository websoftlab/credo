import type { PhragonJSCmd, CommanderCtor } from "./types";
import type { Command } from "@phragon/cli-commander";

const BUILD_KEY = Symbol();
let onBuildEmit = false;

export function preventBuildListener(event: { name: string; [BUILD_KEY]?: boolean }) {
	if (event.name === "onBuild" && (!event[BUILD_KEY] || onBuildEmit)) {
		throw new Error(
			`The \`${event.name}\` event is a system hook, you can not emit it outside the system, or re-emit`
		);
	}
	onBuildEmit = true;
}

export const cmdBuild: CommanderCtor = function cmdBuild(phragon: PhragonJSCmd, command: Command) {
	if (!phragon.hooks.has("onBuild", preventBuildListener)) {
		phragon.hooks.subscribe("onBuild", preventBuildListener);
	}

	phragon.cmd.on("add", () => {
		if (phragon.loaded) {
			throw new Error("You cannot add a new command to the command list because the system is already loaded");
		}
	});

	phragon.cmd.on("remove", (cmd: Command) => {
		if (cmd === command) {
			throw new Error("You cannot remove the default build command");
		}
	});

	command
		.description("The command is run after building the server in production mode. Can be forced")
		.notation("Emit onBuild hook...")
		.strict()
		.option("--timeout", {
			alt: "-T",
			description: "Timeout for onBuild hook functions",
			type: "value",
			format: "time-interval",
		})
		.action<never, { timeout?: number }, void>(async (_, opt) => {
			let { timeout } = opt;
			if (timeout == null) {
				timeout = 15000;
			}

			const id =
				timeout === 0
					? 0
					: setTimeout(() => {
							phragon.debug.error(
								`Attention! Assembly takes too long [{green %s} second limit], process aborted`,
								(timeout as number) / 1000
							);
							process.exit(1);
					  }, timeout);

			await phragon.hooks.emit("onBuild", { [BUILD_KEY]: true });
			if (id !== 0) {
				clearTimeout(id);
			}
		});
};
