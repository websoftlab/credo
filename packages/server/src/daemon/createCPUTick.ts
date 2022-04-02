import type {DaemonCPUValue} from "./types";

export default function createCPUTick(
	delay: number,
	callback: (value: DaemonCPUValue) => void,
	onExit?: Function,
	stopListeners: Function[] = []
) {
	let mid: NodeJS.Timeout | null = null;
	let err: Error;
	let cpuUsage: NodeJS.CpuUsage;
	let hrTime: [number, number];
	let abort = false;

	calc();

	function calc() {
		cpuUsage = process.cpuUsage();
		hrTime = process.hrtime();
	}

	function tick() {
		const c = process.cpuUsage(cpuUsage);
		const h = process.hrtime(hrTime);
		callback({
			t: Date.now(),
			u: c.user,
			s: c.system,
			c: h[0],
			n: h[1],
		});
		calc();
	}

	function stop(code: number) {
		if(abort) {
			return;
		}
		abort = true;
		if(mid) {
			clearInterval(mid);
			mid = null;
		}
		if(typeof onExit === "function") {
			onExit(code !== 0 && err ? err.message : null);
		}
	}

	function stopExit() {
		stop(0);
		process.exit();
	}

	function setError(error: Error) {
		err = error;
	}

	mid = setInterval(tick, delay);

	process.on("exit", stop);
	process.on("SIGINT", stopExit);
	process.on("uncaughtExceptionMonitor", setError);

	return (msg?: string) => {
		let code = 0;
		if(msg) {
			err = new Error(msg);
			code = 1;
		}

		stop(code);

		process.off("exit", stop);
		process.off("SIGINT", stopExit);
		process.off("uncaughtExceptionMonitor", setError);

		for(const stopListener of stopListeners) {
			stopListener();
		}
	};
}