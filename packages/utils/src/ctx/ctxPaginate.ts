import type { Context } from "koa";

export interface CtxPaginate {
	page: number;
	limit: number;
	offset: number;
}

export interface CtxPaginateOptions {
	limit?: number;
	pageName?: string;
}

export default function ctxPaginate(ctx: Context, options: CtxPaginateOptions = {}): CtxPaginate {
	const { limit = 25, pageName = "page" } = options;
	const q = ctx.query || {};
	const pageValue = q[pageName];
	let page = typeof pageValue === "string" ? parseInt(pageValue) : 1;
	if (isNaN(page) || !isFinite(page) || page < 1) {
		page = 1;
	}
	const offset = limit * (page - 1);
	return {
		page,
		limit,
		offset,
	};
}
