import type { PhragonJS } from "@phragon/server";

export default function bootstrap(phragon: PhragonJS) {
	if(!phragon.isApp()) {
		return;
	}

	// load validate language package
	phragon.hooks.subscribe("onResponse", async (event) => {
		const {ctx} = event;
		await ctx.store.loadLanguage(ctx.store.language, "validate");
	});
}