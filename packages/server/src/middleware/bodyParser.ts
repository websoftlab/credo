import koaBodyParser from "koa-bodyparser";
import type { PhragonJS } from "../types";

export function middleware(phragon: PhragonJS) {
	const conf = phragon.config("koa/body-parser");
	phragon.app.use(koaBodyParser(conf));
}
