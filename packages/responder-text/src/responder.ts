import type {Context} from "koa";
import type {CredoJS, Ctor, Route} from "@credo-js/server";
import createHttpError from "http-errors";
import HttpText from "./HttpText";

function send(ctx: Context, body: HttpText) {
	ctx.bodyEnd(body.toText(), body.status);
}

export default (function responder(_credo: CredoJS, name: string): Route.Responder {

	async function error(ctx: Context, error: Error) {
		let code = 500;
		let message = "";
		if(createHttpError.isHttpError(error)) {
			code = error.status;
			if(error.expose) {
				message = error.message;
			}
		}
		if(!message) {
			message = ctx.store.translate("system.page.queryError", "Query error");
		}
		send(ctx, new HttpText(message, code < 600 ? code : 500));
	}

	return {
		name,
		async responder(ctx: Context, body: any) {
			if(createHttpError.isHttpError(body) || body instanceof Error) {
				return error(ctx, body);
			} else {
				send(ctx, HttpText.isHttpText(body) ? body : new HttpText(body));
			}
		},
		error,
	}
}) as Ctor.Responder;