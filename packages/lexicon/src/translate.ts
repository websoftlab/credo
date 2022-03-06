import {replace} from "./replace";
import type {Lexicon} from "./types";

export default function translate(store: Lexicon.StoreInterface, text: string, replacement?: any) {
	return replacement && text.indexOf('{') !== -1 ? replace(store, text, replacement) : text;
}
