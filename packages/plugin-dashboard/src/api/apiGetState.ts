import type { Context } from "koa";

export default function apiGetState(ctx: Context) {
	if (ctx.method !== "GET") {
		return ctx.throw(`The ${ctx.method} method is not supported for this request.`, 400);
	}
	return {
		ok: true,
		payload: {
			...ctx.store.state,
		},
	};
}
