import Daemon from "./Daemon";

let dmn: Daemon;

export default function daemon() {
	if (!dmn) {
		dmn = new Daemon();
	}
	return dmn;
}
