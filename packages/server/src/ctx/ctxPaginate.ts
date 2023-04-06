import type { Context } from "koa";

export interface CtxPaginate {
	page: number;
	limit: number;
	offset: number;
}

export interface CtxPaginateOptions {
	limit?: number;
	pageName?: string;
	limitName?: string;
	limitVariant?: number[];
}

function getLimit(value: number, variant: number[], fallback: number) {
	if (variant.includes(value)) {
		return value;
	}
	if (variant.length > 0) {
		return variant[0];
	}
	return fallback;
}

export default function ctxPaginate(ctx: Context, options: CtxPaginateOptions = {}): CtxPaginate {
	let { limit = 25 } = options;
	const { pageName = "page", limitName, limitVariant = [limit] } = options;
	const q = ctx.query || {};

	// limit variant
	if (limitName) {
		let value: string | string[] | number | undefined = q[limitName];
		switch (typeof value) {
			case "string":
				limit = getLimit(parseInt(value), limitVariant, limit);
				break;
			case "number":
				limit = getLimit(value, limitVariant, limit);
				break;
			default:
				limit = getLimit(limit, limitVariant, limit);
				break;
		}
	}

	const pageValue = q[pageName];
	let page = typeof pageValue === "string" ? parseInt(pageValue) : 1;
	if (!isFinite(page) || page < 1) {
		page = 1;
	}

	const offset = limit * (page - 1);
	return {
		page,
		limit,
		offset,
	};
}
