import { addColors, createLogger, format as winstonFormat, transports as winstonTransports } from "winston";
import type { Logger, LoggerOptions } from "winston";
import type { Format } from "logform";

let winstonLogger: Logger | null = null;

const transportTypes = ["file", "console", "http", "stream"];

const formatTypes = [
	"json",
	"colorize",
	"simple",
	"splat",
	"logstash",
	"label",
	"timestamp",
	"prettyPrint",
	"pretty-print",
	"uncolorize",
	"metadata",
	"errors",
];

function createTransport(transport: any) {
	if (typeof transport === "string") {
		transport = {
			type: transport,
		};
	}

	if (transportTypes.includes(transport.type)) {
		const { type, options = {} } = transport;

		if (options.format) {
			options.format = createFormat(options.format);
		} else if (type === "console") {
			options.format = createFormat("simple");
		} else {
			options.format = createFormat(["uncolorize", "json"]);
		}

		// prettier-ignore
		switch(type) {
			case "file": return new winstonTransports.File(options);
			case "console": return new winstonTransports.Console(options);
			case "http": return new winstonTransports.Http(options);
			case "stream": return new winstonTransports.Stream(options);
			default: throw new Error(`Invalid transport type ${type}`);
		}
	}

	return transport;
}

function createFormat(format: any): Format {
	if (Array.isArray(format)) {
		return winstonFormat.combine(...format.map(createFormat));
	}

	if (typeof format === "string") {
		format = {
			type: format,
		};
	}

	if (format.type && formatTypes.includes(format.type)) {
		// prettier-ignore
		switch(format.type) {
			case "json": return winstonFormat.json(format.options);
			case "colorize": return winstonFormat.colorize(format.options);
			case "simple": return winstonFormat.simple();
			case "splat": return winstonFormat.splat();
			case "logstash": return winstonFormat.logstash();
			case "label": return winstonFormat.label(format.options);
			case "timestamp": return winstonFormat.timestamp(format.options);
			case "prettyPrint": case "pretty-print": return winstonFormat.prettyPrint(format.options);
			case "uncolorize": return winstonFormat.uncolorize(format.options);
			case "metadata": return winstonFormat.metadata(format.options);
			case "errors": return winstonFormat.errors(format.options);
		}
	}

	return format;
}

export function getLogger() {
	return winstonLogger;
}

export function createWinstonLogger(options: any) {
	if (winstonLogger) {
		throw new Error("Winston is already configured, use the winston() function to add more options");
	}

	const transports: LoggerOptions["transports"] = [];
	let {
		level = "info",
		defaultMeta = {},
		levels,
		colors,
		silent = false,
		format: formatOption,
		transports: transportsOption = [],
	} = options;

	if (transportsOption) {
		if (!Array.isArray(transportsOption)) {
			transportsOption = [transportsOption];
		}
		for (const transport of transportsOption) {
			transports.push(createTransport(transport));
		}
	} else {
		transports.push(createTransport("console"));
	}

	winstonLogger = createLogger({
		level,
		levels,
		defaultMeta,
		silent,
		transports,
		format: formatOption ? createFormat(formatOption) : undefined,
	});

	if (colors) {
		addColors(colors);
	}

	return winstonLogger;
}
