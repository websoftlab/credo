import type { PhragonJS } from "@phragon/server";

export default function bootstrap(phragon: PhragonJS) {
	if (!phragon.isApp()) {
		return;
	}

	// load validate language package
	phragon.hooks.subscribe("onResponse", async (event) => {
		const { ctx } = event;
		if (!ctx.store.packages.includes("validate")) {
			await ctx.store.loadLanguage(ctx.store.language, "validate");
		}
	});
}
