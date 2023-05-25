import type { Context } from "koa";

export async function ctxLoadLanguagePackage(ctx: Context, packageName: string | string[]) {
	if (!Array.isArray(packageName)) {
		packageName = [packageName];
	}
	const store = ctx.store;
	for (const name of packageName) {
		if (!store.packages.includes(name)) {
			await ctx.store.loadLanguage(ctx.store.language, name);
		}
	}
}
