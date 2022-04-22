import koaSession from "koa-session";
import { store, RedisStore } from "../redis";
import type { CredoJS } from "../types";

export function middleware(credo: CredoJS) {
	const options = credo.config("koa/session");
	const { enabled = true, redis, ...session } = options;

	if (!enabled) {
		return;
	}

	if (redis) {
		session.store =
			redis === true
				? store
				: new RedisStore({
						unique: true,
						name: "session",
						clientOptions: redis,
				  });
	}

	const { secret = [] } = credo.config("config");
	const keys = (Array.isArray(secret) ? secret : [secret])
		.map((item) => String(item).trim())
		.filter((item) => item.length > 0);

	if (!keys.length) {
		throw new Error("Config secret key(s) is empty!");
	}

	const app = credo.app;
	app.keys = keys;

	app.use(koaSession(session, app));
}
