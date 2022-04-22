import daemon from "../daemon";

export default function cmdStop(_arg: never, _prop: never, stream: NodeJS.WriteStream) {
	const dmn = daemon();
	dmn.update();

	if (!dmn.started) {
		return;
	}

	stream.write("Stopping the server...\n");
	dmn.stop();
}
