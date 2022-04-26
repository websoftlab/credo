import daemon from "../daemon";

type StartParam = { host?: string; port?: number; background: boolean };

export default function cmdStart(_arg: never, params: StartParam, stream: NodeJS.WriteStream) {
	const { host, port, background } = params;
	const env: Record<string, string> = {};
	if (host) {
		env.PHRAGON_HOST = host;
	}
	if (port != null) {
		env.PHRAGON_PORT = String(port);
	}
	stream.write(`Running the server${background ? " in the background" : ""}...\n`);
	daemon().start([], env, background);
	return -1;
}
