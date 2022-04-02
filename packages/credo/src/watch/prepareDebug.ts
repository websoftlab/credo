import {BuildType} from "../types";

type PrepareDebugType = {
	type: BuildType | null;
	context: string;
	text: string;
	error: boolean;
	status: string | null;
	progress: number | null;
}

const progressReg = /^\[progress (\d+)%](.*?)$/;
const statusReg = /^\[status ([a-z\-]+)](.*?)$/;
const infoReg = /^<i> \[([a-z0-9\-])+](.+?)$/i;
const debugReg = /^(?:[0-9\-:TZ.+]{18,30}\s+)?credo:([a-z\-]+) (.+?)$/i;

export default function prepareDebug(text: string, context?: BuildType | "system", error?: boolean): PrepareDebugType {
	const type: PrepareDebugType = {
		text,
		context: context || "system",
		error: error === true,
		progress: null,
		status: null,
		type: null,
	};

	if(context && ["server", "server-page", "client"].includes(context)) {
		type.type = context as BuildType;
	}

	if(type.type) {
		const m1 = text.match(progressReg);
		if(m1) {
			type.progress = parseInt(m1[1]);
			type.text = m1[2].trim();
			type.error = false;
			return type;
		}

		const m2 = text.match(statusReg);
		if(m2) {
			type.status = m2[1];
			type.text = m2[2].trim();
			type.error = false;
			return type;
		}
	}

	text = String(text).trim();
	let m: RegExpMatchArray | undefined | null;

	m = text.match(infoReg) || text.match(debugReg);
	if(m) {
		type.context = m[1];
		type.text = m[2].trim();
		type.error = false;
		return type;
	}

	return type;
}