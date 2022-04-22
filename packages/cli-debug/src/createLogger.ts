import type { DebugLogger } from "./types";
import type { Debugger } from "debug";
import util from "util";
import { format } from "@credo-js/cli-color";
import createDebug from "debug";
import { getNamespace, onRename } from "./namespace";
import { isAccessible, saveAccess } from "./accessibility";
import { getFormat } from "./formatters";
import { getLogger } from "./winstonLogger";
import { emitListener } from "./listeners";
import { renameKeysWithPrefix, renamePrefix } from "./util";

const loggers: Record<string, DebugLogger> = {};
const debuggers: Record<string, Debugger> = {};
const loggerNames: string[] = [];

onRename((newPrefix: string, oldPrefix: string) => {
	renameKeysWithPrefix(loggers, newPrefix, oldPrefix);
	renameKeysWithPrefix(debuggers, newPrefix, oldPrefix);
	loggerNames.forEach((name, index) => {
		loggerNames[index] = renamePrefix(name, newPrefix, oldPrefix);
	});
});

export default function createLogger(namespace: string): DebugLogger {
	namespace = getNamespace(namespace);
	if (loggers.hasOwnProperty(namespace)) {
		return loggers[namespace];
	}

	saveAccess(namespace);

	const index = loggerNames.length;
	loggerNames[index] = namespace;

	const logger: DebugLogger = function (text: any, ...args: any[]) {
		if (text == null) {
			return;
		}

		const namespace = loggerNames[index];
		if (!isAccessible(namespace)) {
			return;
		}

		if (text instanceof Error) {
			text = {
				namespace,
				level: "error",
				message: text.stack || text.message,
			};
		} else {
			switch (typeof text) {
				case "string":
				case "number":
				case "bigint":
				case "boolean":
				case "undefined":
					text = {
						namespace,
						level: "info",
						message: text,
					};
					break;
				default:
					text = {
						level: "info",
						...text,
						namespace,
					};
					break;
			}
		}

		const frm = getFormat(namespace);
		if (frm) {
			const { formatter, details } = frm;
			text = formatter(text, args);
			if (!text) {
				return;
			}
			if (details) {
				text = {
					...details,
					...text,
				};
			}
		} else if (typeof text.message === "string") {
			text.message = format(text.message);
			if (args.length) {
				text.message = util.format(text.message, ...args);
			}
		} else if (args.length) {
			text.args = args;
		}

		const wl = getLogger();
		if (wl) {
			wl.log(text);
			emitListener(text);
		} else {
			const { message, namespace, ...rest } = text;
			if (!debuggers.hasOwnProperty(namespace)) {
				debuggers[namespace] = createDebug(namespace);
			}
			debuggers[namespace](message, rest);
		}
	};

	loggers[namespace] = logger;
	return logger;
}
