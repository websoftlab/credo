import type Group from "./Group";
import type { ModifierColorName } from "@phragon/cli-color";
import type { HelpOptions } from "./types";
import { color } from "@phragon/cli-color";

type PropType = {
	name: string;
	required: boolean;
	multiple: boolean;
	color?: ModifierColorName;
};

function getProp(prop: PropType) {
	let text = prop.name;
	if (prop.multiple) {
		text = `... ${text}[]`;
	}
	if (!prop.required) {
		text = `? ${text}`;
	}
	text = `[${text}]`;
	const length = text.length;
	if (prop.color) {
		text = color(prop.color, text);
	}
	return {
		text,
		length,
	};
}

export default class Help {
	groups: Group[] = [];
	props: PropType[] = [];
	name: string = "";
	description: string = "";
	version: string = "";
	prompt: string = "bin";
	stream: NodeJS.WriteStream;

	constructor(options: HelpOptions) {
		this.name = typeof options.name === "string" ? options.name : "";
		this.description = typeof options.description === "string" ? options.description : "";
		this.version = typeof options.version === "string" ? options.version : "";
		this.prompt = typeof options.prompt === "string" ? options.prompt : "bin";
		this.stream = options.stream || process.stdout;
	}

	get delta() {
		let calc = 0;
		this.groups.forEach((item) => {
			const delta = item.delta;
			if (delta > calc) {
				calc = delta;
			}
		});
		return calc;
	}

	addProp(name: string, required: boolean, multiple: boolean, color?: ModifierColorName) {
		this.props.push({
			name,
			required,
			multiple,
			color,
		});
	}

	addGroup(group: Group) {
		this.groups.push(group);
	}

	print() {
		const { stream, delta } = this;

		let max = (stream.columns || 85) - 5;
		if (max > 140) {
			max = 140;
		}

		const noBr = delta + 30 > max;

		function writeLimitNl(text: string, start: number = 0, delta: number = 0) {
			if (noBr) {
				return stream.write(text + "\n");
			}

			while (text.length) {
				let len = max - start;
				if (text.length <= len) {
					stream.write(text);
					break;
				}

				let chunk = text.substring(0, len);
				if (text[len] !== " ") {
					const index = chunk.lastIndexOf(" ");
					if (index > 0) {
						chunk = text.substring(0, index);
						len = index;
					}
				}

				text = text.substring(len).trimLeft();

				stream.write(chunk);
				stream.write("\n");

				if (delta > 0) {
					stream.write("".padStart(delta, " "));
					start = delta;
				} else {
					delta = 0;
				}
			}

			return stream.write("\n");
		}

		stream.write(`Usage: ${this.prompt}`);
		if (this.name) {
			stream.write(" ");
			stream.write(color.white(this.name));
		}
		for (const prop of this.props) {
			stream.write(` ${getProp(prop).text}`);
		}
		stream.write("\n\n");

		if (this.version) {
			stream.write(`Ver. ${color.lightYellow(this.version)}\n`);
		}
		if (this.description) {
			writeLimitNl(this.description);
			stream.write("\n");
		}

		for (const group of this.groups) {
			stream.write(group.name + ":\n");
			for (const item of group.items) {
				let len = 2;
				stream.write("  ");
				const { name, property, description, multiple, required, br } = item;
				if (name) {
					len += name.length + 2;
					stream.write(color.white(name) + "  ");
				}
				if (property) {
					const frm = getProp({
						name: property,
						required,
						multiple,
						color: "yellow",
					});
					len += frm.length + 2;
					stream.write(frm.text + "  ");
				}
				if (description) {
					if (noBr) {
						writeLimitNl(description);
					} else {
						if (len < delta) {
							stream.write("".padEnd(delta - len));
						}
						writeLimitNl(description, delta, delta);
					}
				} else {
					stream.write("\n");
				}
				if (br) {
					stream.write("\n");
				}
			}
			stream.write("\n");
		}
	}
}
