import eastAsianWidth from "eastasianwidth";
import createEmojiRegex from "emoji-regex";
import ansiClean from "./ansiClean";

const emojiRegex = createEmojiRegex();

export default function stringWidth(string: string) {
	if(typeof string !== 'string' || string.length === 0) {
		return 0;
	}

	string = ansiClean(string);

	if(string.length === 0) {
		return 0;
	}

	string = string.replace(emojiRegex, '  ');

	let width = 0;

	for(const character of string) {
		const codePoint = character.codePointAt(0) as number;

		// Ignore control characters
		if(codePoint <= 0x1F || (codePoint >= 0x7F && codePoint <= 0x9F)) {
			continue;
		}

		// Ignore combining characters
		if(codePoint >= 0x300 && codePoint <= 0x36F) {
			continue;
		}

		const code = eastAsianWidth.eastAsianWidth(character);
		switch(code) {
			case 'F':
			case 'W':
				width += 2;
				break;
			case 'A':
				width += 1; // maybe 2 ?..
				break;
			default:
				width += 1;
		}
	}

	return width;
}
