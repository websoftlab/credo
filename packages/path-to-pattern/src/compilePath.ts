import type {PatternInterface, AddModifierOptions, PatternRegExArgument, PatternFormatterArgument} from "./types";
import normalize from "./normalize";
import Pattern from "./Pattern";
import {AbstractSegment} from "./segment/AbstractSegment";
import {d, date, dIn, l, n, not, dNot, r, reg, u, uuid, w, wl, wr, inModifier} from "./modifiers";
import lexer from "./lexer";

const defModifiers: string[] = [];
const mdf: Record<string, {	regExp: PatternRegExArgument, formatter?: PatternFormatterArgument }> = {};

export function addModifier(name: string, options: AddModifierOptions) {
	if(defModifiers.includes(name)) {
		throw new Error(`The \`${name}\` modifier is system modifier name`);
	}
	let {regExp, formatter} = options;
	if(!regExp) {
		regExp = ".+?";
	} else if(typeof regExp !== "string" && typeof regExp !== "function") {
		throw new Error("The `regExp` option must be a string or a function");
	}
	if(formatter && typeof formatter !== "function") {
		throw new Error("The `formatter` option must be a function");
	}
	mdf[name] = {regExp, formatter};
}

export function compilePath<R = any>(path: string): PatternInterface<R> {
	path = normalize(path);
	if(path.includes("//")) {
		throw new Error("Invalid path");
	}
	const segments = path === "/" ? [] : path.substring(1).split("/");
	const keys: string[] = [];
	const pattern = new Pattern(path, keys, segments.length);

	if(segments.length) {
		const segmentsCompile: AbstractSegment[] = [];
		let isReg = false;
		let isEnd = false;
		for(let segment of segments) {
			if(isEnd) {
				throw new Error("Key `*` must be the last segment");
			}
			const lex = lexer(segment, mdf, keys);
			segmentsCompile.push(lex);
			if(!AbstractSegment.isPlain(lex)) {
				isReg = true;
			}
			if(AbstractSegment.isList(lex)) {
				isEnd = true;
			}
		}
		if(isReg) {
			for(let segment of segmentsCompile) {
				pattern.add(segment);
			}
		}
	}

	return pattern;
}

addModifier("d", d);
addModifier("date", date);
addModifier("dIn", dIn);
addModifier("dNot", dNot);
addModifier("in", inModifier);
addModifier("l", l);
addModifier("n", n);
addModifier("not", not);
addModifier("r", r);
addModifier("reg", reg);
addModifier("u", u);
addModifier("uuid", uuid);
addModifier("w", w);
addModifier("wl", wl);
addModifier("wr", wr);

defModifiers.push(... Object.keys(mdf));
