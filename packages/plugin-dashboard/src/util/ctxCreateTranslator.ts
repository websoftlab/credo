import type { Context } from "koa";
import type { Lexicon } from "@phragon/lexicon";

export default function ctxCreateTranslator(ctx: Context) {
	return function translator(id: Lexicon.TranslateOptions) {
		return ctx.store.translator(id);
	};
}
