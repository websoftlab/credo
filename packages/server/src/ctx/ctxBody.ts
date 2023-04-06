import type { Context, Request } from "koa";
import type { CtxRequestSchema } from "./getRequestData";
import getRequestData from "./getRequestData";

export default function ctxBody<Result extends {} = any>(
	ctx: Context,
	schema: "*" | (CtxRequestSchema<keyof Result> | keyof Result)[] = "*"
): Partial<Result> {
	return getRequestData((ctx.request as Request & { body: any }).body, schema);
}
