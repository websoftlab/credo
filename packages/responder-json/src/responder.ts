import type {Context, Next} from "koa";
import type {CredoJS, Route} from "@credo-js/server";
import type {ResponderJsonConfigOptions} from "./types";
import createHttpError from "http-errors";
import HttpJSON from "./HttpJSON";
import asyncResult from "@credo-js/utils/asyncResult";

function getHeaderString(value?: string | string[]): string {
	return value != null ? (Array.isArray(value) ? value.join(",") : value) : "";
}

export default (function responder(credo: CredoJS, name: string): Route.Responder {

	const options: ResponderJsonConfigOptions = credo.config(`responder/${name}`);
	const corsKey = Symbol();
	const {
		cors: corsOption = true,
		done: doneHandler,
		error: errorHandler,
	} = options;
	const enabled: boolean = corsOption !== false;
	const cors = enabled && typeof corsOption === "object" ? corsOption : {};
	const exposeHeaders = getHeaderString(cors.exposeHeaders);
	const {
		keepHeadersOnError = true,
	} = cors;

	type Props = {
		origin: string,
		credentials: boolean,
	};

	function setProps(ctx: any, props: Props) {
		ctx[corsKey] = props;
	}

	function getProps(ctx: any): Props {
		return ctx[corsKey];
	}

	function isDetails(err: any): err is Error & {
		details: any;
	} {
		return "details" in err && err.details != null;
	}

	async function getOptionsMethods(ctx: Context): Promise<string[]> {
		const methods: string[] = [];

		for(const route of credo.route.routeList) {
			if(
				route.context.details.cors === false ||
				route.context.responder.name !== name ||
				! await asyncResult(route.match(ctx))
			) {
				continue;
			}
			route.methods.forEach(name => {
				if(!methods.includes(name)) {
					methods.push(name);
				}
			});
		}

		return methods;
	}

	function setHeaders(ctx: Context) {
		if(!enabled) {
			return;
		}

		const {route} = ctx;
		if(!route || route.details.cors === false) {
			return;
		}

		const props = getProps(ctx);
		if(!props || keepHeadersOnError && ctx.status >= 500) {
			return;
		}

		const {
			origin,
			credentials,
		} = props;

		// Simple Cross-Origin Request, Actual Request, and Redirects
		ctx.set('Access-Control-Allow-Origin', origin);

		if(credentials) {
			ctx.set('Access-Control-Allow-Credentials', 'true');
		}

		if(exposeHeaders) {
			ctx.set('Access-Control-Expose-Headers', exposeHeaders);
		}
	}

	function send(ctx: Context, body: HttpJSON) {
		ctx.status = body.status;
		ctx.body = body.toJSON();
	}

	async function error(ctx: Context, error: Error) {
		if(typeof errorHandler === "function") {
			return send(ctx, await asyncResult(errorHandler(error)));
		}

		let code = 500;
		let message = "";

		if(createHttpError.isHttpError(error)) {
			code = error.status;
			if(error.expose) {
				message = error.message;
			}
		}

		const body: any = {
			code,
			message: message || ctx.store.translate("system.page.queryError", "Query error"),
		};

		if(isDetails(error)) {
			body.details = error.details;
		}

		ctx.status = code < 600 ? code : 500;
		ctx.body = body;
	}

	return {
		name,
		async middleware(ctx: Context, next: Next) {
			if(!enabled) {
				return next();
			}

			// If the Origin header is not present terminate this set of steps.
			// The request is outside the scope of this specification.
			const requestOrigin = ctx.get('Origin');

			// Always set Vary header
			// https://github.com/rs/cors/issues/10
			ctx.vary('Origin');

			if (!requestOrigin) {
				return next();
			}

			let origin: string;
			if (typeof cors.origin === 'function') {
				origin = await asyncResult(cors.origin(ctx))
				if (!origin) {
					return next();
				}
			} else {
				origin = cors.origin || requestOrigin;
			}

			let credentials: boolean;
			if (typeof cors.credentials === 'function') {
				credentials = await asyncResult<boolean>(cors.credentials(ctx));
			} else {
				credentials = !!cors.credentials;
			}

			setProps(ctx, {
				origin,
				credentials,
			});

			if(ctx.method === "OPTIONS") {
				// Preflight Request

				// If there is no Access-Control-Request-Method header or if parsing failed,
				// do not set any additional headers and terminate this set of steps.
				// The request is outside the scope of this specification.
				if (ctx.route || !ctx.get('Access-Control-Request-Method')) {
					// this not preflight request, ignore it
					return next();
				}

				const methods = await getOptionsMethods(ctx);
				if(!methods.length) {
					return next();
				}

				ctx.set('Access-Control-Allow-Origin', origin);
				ctx.set('Access-Control-Allow-Methods', methods.join(','));

				if(credentials) {
					ctx.set('Access-Control-Allow-Credentials', 'true');
				}

				if(cors.maxAge) {
					ctx.set('Access-Control-Max-Age', String(cors.maxAge));
				}

				const allowHeaders = getHeaderString(cors.allowHeaders || ctx.get('Access-Control-Request-Headers'));
				if(allowHeaders) {
					ctx.set('Access-Control-Allow-Headers', allowHeaders);
				}

				ctx.status = 204;
			} else {
				return next();
			}
		},
		async responder(ctx: Context, body: any) {
			setHeaders(ctx);
			if(!HttpJSON.isHttpJSON(body)) {
				body = new HttpJSON(body);
			}
			if(typeof doneHandler === "function") {
				try {
					body = await asyncResult(doneHandler(body));
				} catch(err) {
					return error(ctx, err as Error);
				}
			}
			send(ctx, body);
		},
		error,
	}
}) as Route.ResponderCtor;