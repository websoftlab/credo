import type { Dashboard } from "../types";
import type { Context } from "koa";
import { ctxLoadLanguagePackage } from "./ctxLoadLanguagePackage";

export abstract class AbstractPlugin implements Dashboard.Plugin {
	protected readonly name!: string;
	public readonly api: Dashboard.PluginControllerRule<Dashboard.PluginApiController>[] = [];
	public readonly raw: Dashboard.PluginControllerRule<Dashboard.PluginRawController>[] = [];
	public readonly web: Omit<Dashboard.PluginControllerRule<Dashboard.PluginWebController>, "method">[] = [];
	public readonly middleware: Dashboard.PluginMiddleware[] = [];

	protected constructor(name: string) {
		Object.defineProperty(this, "name", {
			get() {
				return name;
			},
		});
	}

	async onRequest(ctx: Context) {
		const { name } = this;
		if (name && !name.includes(":")) {
			await ctxLoadLanguagePackage(ctx, name);
		}
	}
}
