import type {CredoJSCmd} from "./types";

const BUILD_KEY = Symbol();
let onBuildEmit = false;

export function preventBuildListener(event: {name: string, [BUILD_KEY]?: boolean}) {
	if(event.name === "onBuild" && (!event[BUILD_KEY] || onBuildEmit)) {
		throw new Error(`The \`${event.name}\` event is a system hook, you can not emit it outside the system, or re-emit`);
	}
	onBuildEmit = true;
}

export function cmdBuild(credo: CredoJSCmd) {
	if(!credo.hooks.has("onBuild", preventBuildListener)) {
		credo.hooks.subscribe("onBuild", preventBuildListener);
	}
	return async (name?: string) => {
		if(
			name ||
			credo.cmd.args.length > 0 ||
			credo.cmd.options.length > 0
		) {
			throw new Error("Command `build` does not contain additional names, arguments or options")
		}

		let {buildTimeout} = credo.config("config");
		if(typeof buildTimeout !== "number" || buildTimeout < 0.001) {
			buildTimeout = 15;
		}

		const id = setTimeout(() => {
			credo.debug.error(`Attention! Assembly takes too long [{green %s} second limit], process aborted`, buildTimeout);
			process.exit(1);
		}, buildTimeout * 1000);

		await credo.hooks.emit("onBuild", {[BUILD_KEY]: true});
		clearTimeout(id);
	};
}