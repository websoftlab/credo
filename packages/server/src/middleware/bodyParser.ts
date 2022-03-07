import koaBodyParser from "koa-bodyparser";
import type {CredoJS} from "../types";

export function middleware(credo: CredoJS) {
	const conf = credo.config("koa/body-parser");
	credo.app.use(koaBodyParser(conf));
}
