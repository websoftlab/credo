import type { Context } from "koa";

export interface CtxMatchIdOptions {
	idName?: string;
}

export default function ctxMatchId(ctx: Context, options: CtxMatchIdOptions = {}): number | null {
	if (!ctx.match) {
		return null;
	}
	const { idName = "id" } = options;
	let id: string | number | undefined = ctx.match[idName];
	if (!id) {
		return null;
	}
	if (typeof id === "number") {
		return id;
	}
	id = parseInt(id);
	return isNaN(id) || !isFinite(id) ? null : id;
}
