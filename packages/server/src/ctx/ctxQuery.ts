import type { Context } from "koa";
import type { CtxRequestSchema } from "./getRequestData";
import { default as getRequestData } from "./getRequestData";

export default function ctxQuery<Result extends {} = any>(
	ctx: Context,
	schema: "*" | (CtxRequestSchema<keyof Result> | keyof Result)[] = "*"
): Partial<Result> {
	return getRequestData(ctx.query, schema);
}
