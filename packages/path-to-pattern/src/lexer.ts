import List from "./segment/List";
import Values from "./segment/Values";
import Value from "./segment/Value";
import Plain from "./segment/Plain";
import {escapeRegExp} from "./utils";
import type {PatternFormatterArgument, PatternRegExArgument, PatternFormatter} from "./types";
import type {SegmentValue} from "./segment/Values";

type LexerSegment = List | Values | Value | Plain;

function hasKey(key: string, keys: string[], error?: string) {
	if(keys.includes(key)) {
		throw new Error(error || `Duplicate \`${key}\` key name`);
	}
	keys.push(key);
}

enum LT {
	CHAR,
	NAME,
	MODIFIER,
	MODIFIER_ARGUMENT,
	MODIFIER_END,
	GROUP_OPEN,
	GROUP_CLOSE,
}

interface LexToken {
	type: LT;
	index: number;
	value: string;
	details: any;
}

function parse(str: string) {
	const tokens: LexToken[] = [];

	const end = (): LexToken => {
		return tokens[tokens.length - 1];
	};

	const isPrev = (type: LT): boolean => {
		if(tokens.length === 0) {
			return false;
		}
		return type === end().type;
	};

	const addToken = (type: LT, index: number, value: string, details: any = {}): void => {
		tokens.push({ type, index, value, details });
	};

	let index: number = 0;
	let open = false;

	const getName = () => {
		let name = "";
		let j = index;

		while (j < str.length) {
			const code = str.charCodeAt(j);

			if (
				// `0-9`
				(code >= 48 && code <= 57) ||
				// `A-Z`
				(code >= 65 && code <= 90) ||
				// `a-z`
				(code >= 97 && code <= 122) ||
				// `_`
				code === 95
			) {
				name += str[j++];
				continue;
			}

			break;
		}

		return { name, j };
	};

	while(index < str.length) {
		let char = str[index++];

		if(char === "{") {
			if(open) {
				throw new TypeError(`The group in the segment is already open at ${index}`);
			}
			open = true;
			addToken(LT.GROUP_OPEN, index, char);
		}

		else if(char === "}") {
			if(!open) {
				throw new TypeError(`The group in the segment was not open at ${index}`);
			}
			open = false;
			addToken(LT.GROUP_CLOSE, index, char);
		}

		// modifier name
		else if(char === "|") {
			if(!isPrev(LT.NAME)) {
				throw new TypeError(`Invalid char | at ${index}`);
			}

			const {name, j} = getName();
			if (!name) {
				throw new TypeError(`Missing key name at ${index}`);
			}

			addToken(LT.MODIFIER, index, name);
			index = j;
		}

		// modifier argument
		else if(char === "(" || char === ",") {
			const test = char === "(" && isPrev(LT.MODIFIER) || char === "," && isPrev(LT.MODIFIER_ARGUMENT);
			if(!test) {
				throw new TypeError(`Invalid char ${char} at ${index}`);
			}

			let value = "";
			let j = index;
			let isEnd = false;

			while (j < str.length) {
				let char = str[j];

				if(char === ",") {
					if(!value) {
						throw new TypeError(`Missing modifier argument value at ${j}`);
					}
					break;
				}

				if(char === ")") {
					isEnd = true;
					break;
				}

				if(char === "\\") {
					char = str[j + 1];
					if(char) {
						j ++;
					} else {
						throw new TypeError(`Missing modifier argument value at ${j}`);
					}
				}

				value += char;
				j ++;
			}

			value && addToken(LT.MODIFIER_ARGUMENT, index, value);
			index = j;
			if(isEnd) {
				addToken(LT.MODIFIER_END, index ++, ")");
			}
		}

		// key name
		else if(char === ":") {
			const {name, j} = getName();
			if (!name) {
				throw new TypeError(`Missing parameter name at ${index}`);
			}

			addToken(LT.NAME, index, name, { required: true });
			index = j;

			if(str[j] === "?") {
				end().details.required = false;
				index ++;
			}
		}

		// other
		else {
			let value = "";
			index --;

			while (index < str.length) {
				let char = str[index];

				if([":", "{", "}", "?", "(", ")", ","].includes(char)) {
					break;
				}

				if(char === "\\") {
					char = str[++ index];
					if(!char) {
						throw new TypeError(`Unexpected line ending at ${index}`);
					}
				}

				value += char;
				index ++;
			}

			if(value) {
				addToken(LT.CHAR, index, value);
			} else {
				throw new TypeError(`Unexpected line ending at ${index}`);
			}
		}
	}

	return tokens;
}

export default function lexer(
	path: string,
	mdf: Record<string, { regExp: PatternRegExArgument, formatter?: PatternFormatterArgument }>,
	keys: string[],
): LexerSegment {

	// * key
	if(path === "*") {
		hasKey("*", keys, "Key `*` must be the last segment");
		return new List();
	}

	if(!path) {
		throw new Error("Empty segment");
	}

	const tokens = parse(path);

	if(tokens.length === 1) {
		const t = tokens[0];
		if(t.type === LT.CHAR) {
			return new Plain(t.value);
		}
		if(t.type === LT.NAME) {
			return new Value(t.value, t.details.required);
		}
	}

	const entities: Array<string | SegmentValue> = [];
	const rExp: string[] = [];
	let i = 0;

	const nxt = () => {
		return tokens[i ++];
	};

	const createSegment = (token: LexToken): SegmentValue => {
		const isGroup = token.type !== LT.NAME;

		let name = isGroup ? "" : token.value;
		let prefix = "";
		let suffix = "";
		let required = true;
		let modifier = "";
		let format: undefined | PatternFormatter = undefined;
		let reg = ".+?";

		const args: string[] = [];
		const getter = () => {
			reg = `(${reg})`;
			if(prefix || suffix) {
				if(prefix) reg = escapeRegExp(prefix) + reg;
				if(suffix) reg = reg + escapeRegExp(suffix);
				reg = `(?:${reg})`;
			}
			if(!required) {
				reg += "?";
			}
			rExp.push(reg);
			return {
				required,
				format,
				prefix,
				name,
				suffix,
			};
		};

		let val = isGroup ? nxt() : token;
		if(!val) {
			throw new Error(`Unexpected line ending at ${token.index} (open group)`);
		}

		if(isGroup) {
			if(val.type === LT.CHAR) {
				prefix = val.value;
				val = nxt();
			}
			if(!val || val.type !== LT.NAME) {
				throw new Error(`Unexpected line ending at ${token.index} (key in group)`);
			}
			name = val.value;
		}

		hasKey(name, keys);
		if(!val.details.required) {
			required = false;
		}

		val = nxt();
		if(!val) {
			if(isGroup) {
				throw new Error(`Unexpected line ending at ${token.index} (group close)`);
			} else {
				return getter();
			}
		}

		if(val.type === LT.MODIFIER) {
			modifier = val.value;
			if(!mdf.hasOwnProperty(modifier)) {
				throw new Error(`The ${modifier} modifier not found at ${token.index}`);
			}

			let j = i;

			while(j < tokens.length) {
				const t = tokens[j];
				if(t.type === LT.MODIFIER_ARGUMENT) {
					j ++;
					args.push(t.value);
				} else {
					break;
				}
			}

			i = j;
			if(args.length > 0) {
				val = nxt();
				if(!val || val.type !== LT.MODIFIER_END) {
					throw new Error(`Unexpected line ending at ${token.index} (modifier end)`);
				}
			}

			const {regExp, formatter} = mdf[modifier];
			if(regExp) {
				reg = typeof regExp === "function" ? regExp(args) : regExp;
			}

			if(formatter) {
				format = formatter(args);
			}

			val = nxt();
			if(!val) {
				if(isGroup) {
					throw new Error(`Unexpected line ending at ${token.index} (group close)`);
				}
				return getter();
			}
			if(!isGroup) {
				throw new Error(`Unexpected line ending at ${token.index} (key-name close)`);
			}
		} else if(!isGroup) {
			throw new Error(`Unexpected line ending at ${token.index} (key-name close)`);
		}

		if(val.type === LT.CHAR) {
			suffix = val.value;
			val = nxt();
			if(!val) {
				throw new Error(`Unexpected line ending at ${token.index} (group close)`);
			}
		}

		if(val.type !== LT.GROUP_CLOSE) {
			throw new Error(`Unexpected line ending at ${token.index} (group close)`);
		}

		return getter();
	};

	while(i < tokens.length) {
		const token = nxt();
		if(token.type === LT.CHAR) {
			entities.push(token.value);
			rExp.push(escapeRegExp(token.value));
		} else if(i === 1 && token.type === LT.NAME || token.type === LT.GROUP_OPEN) {
			entities.push(createSegment(token));
		} else {
			throw new Error(`Unexpected line ${token.type} -> ${token.value} at ${token.index}`);
		}
	}

	const first = entities[0];
	if(
		entities.length === 1 &&
		typeof first !== "string" &&
		! first.prefix &&
		! first.suffix &&
		(rExp.length === 0 || rExp[0] === "(.+?)")
	) {
		return new Value(first.name, first.required, first.format);
	}

	return new Values(new RegExp("^" + rExp.join("") + "$"), entities);
}