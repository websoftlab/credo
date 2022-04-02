const ansiRegex = new RegExp([
	'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
	'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
].join('|'), 'g');

export default function ansiClean(text: string) {
	if(!text || typeof text !== "string") {
		return "";
	} else {
		return text.replace(ansiRegex, "");
	}
}
