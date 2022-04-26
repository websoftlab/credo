import daemon from "../daemon";
import prettyMs from "pretty-ms";
import { format } from "@phragon/cli-color";

export default function cmdStatus(_arg: never, _prop: never, stream: NodeJS.WriteStream) {
	const dmn = daemon();
	dmn.update();

	function write(text: string, ...args: any[]) {
		stream.write(format(text, ...args));
		stream.write("\n");
	}

	function date(timestamp: number) {
		const time = new Date();
		time.setTime(timestamp);
		return time;
	}

	if (dmn.started) {
		write("Server {cyan [online]}");
		write("Started at {green %s}", date(dmn.startTime).toISOString());
		write("Work time {green %s}", prettyMs(dmn.delta));
	} else {
		write("Server {red [offline]}");
		const { endTime, lastError } = dmn;
		if (endTime) {
			write("Stopped at {green %s}", date(endTime).toISOString());
		}
		if (lastError) {
			write("Last error: {darkRed %s}", lastError);
		}
	}
}
