import type { ModifierColorName } from "@credo-js/cli-color";
import { color, format } from "@credo-js/cli-color";
import daemon from "../daemon";

type RowOutType = {
	text: string;
	length: number;
	color?: ModifierColorName;
};

export default function CmdStat(_args: never, _option: never, stream: NodeJS.WriteStream) {
	const dmn = daemon();
	dmn.update();

	writeln(format(dmn.started ? "Server {cyan [online]}" : "Server {red [offline]}"));

	const cpuStat = dmn.cpu;
	const keys = Object.keys(cpuStat);
	if (!keys.length) {
		return writeln("No CPU data");
	}

	const names = ["ID", "PID", "Part", "Type", "Restart", "Mode", "Host", "Port", "CPU", "CPU min", "CPU max"];

	const calc: number[] = names.map((n) => n.length);
	const data: RowOutType[][] = [];
	const colorType: Record<string, ModifierColorName> = {
		main: "yellow",
		cluster: "yellow",
		fork: "cyan",
		worker: "green",
		error: "red",
	};

	for (const key of keys) {
		const row: RowOutType[] = [];
		const item = cpuStat[key];
		const { id, part, type, cpu, mode, port, restarted, host, pid } = item;

		// ID
		row.push(outRow(id));

		// PID
		row.push(outRow(pid));

		// Part
		row.push(outRow(part));

		// Type
		row.push(outRow(type, colorType[type]));

		// Restart
		row.push(outRow(restarted === 0 ? "-" : restarted, restarted === 0 ? undefined : "red"));

		// Mode
		row.push(outRow(mode || "-"));

		// Host
		row.push(outRow(host || "-"));

		// Port
		row.push(outRow(port || "-"));

		// CPU, min, max ...
		if (cpu.length < 1) {
			row.push(outRow("-"));
			row.push(outRow("-"));
			row.push(outRow("-"));
		} else {
			function secNSec2ms(sec: number, nano: number) {
				return sec * 1000 + nano / 1000000;
			}
			function secMs(sec: number) {
				return sec / 1000;
			}
			function getPrc(value: number) {
				let color: ModifierColorName = "white";
				if (value > 75) color = "red";
				else if (value > 50) color = "yellow";
				else if (value > 25) color = "green";

				value = Math.round(value * 100) / 100;
				return outRow(`${value}%`, color);
			}

			// calculate CPU ...
			let min = 0,
				max = 0,
				calc = 0,
				count = 0;

			for (const info of cpu) {
				// u - user time
				// s - system time
				// c - second (hrtime)
				// n - nano seconds (hrtime)

				const elapTimeMS = secNSec2ms(info.c, info.n);
				const elapUserMS = secMs(info.u);
				const elapSystMS = secMs(info.s);
				const cpuPercent = (100 * (elapUserMS + elapSystMS)) / elapTimeMS;

				if (min > cpuPercent) {
					min = cpuPercent;
				}
				if (max < cpuPercent) {
					max = cpuPercent;
				}
				if (count === 0) {
					calc = cpuPercent;
				} else {
					calc = (calc * count + cpuPercent) / (count + 1);
				}
				count++;
			}

			row.push(getPrc(calc));
			row.push(getPrc(min));
			row.push(getPrc(max));
		}

		// Add row
		data.push(row);

		// recalculate
		for (let i = 0; i < row.length; i++) {
			const line = row[i];
			if (calc[i] < line.length) {
				calc[i] = line.length;
			}
		}
	}

	const calcLength = calc.reduce((prev, cur) => prev + cur + 3, 1);
	const columns = stream.columns || 80;

	if (calcLength > columns) {
		// plain format
		for (const row of data) {
			writeln();
			writePlainRow(row);
		}
	} else {
		// table format
		writeBorder("┌", "┬", "┐");
		writeRow(names.map((name) => outRow(name)));
		writeBorder("├", "┼", "┤");
		for (const row of data) {
			writeRow(row);
		}
		writeBorder("└", "┴", "┘");
	}

	// -----------

	function outRow(text: string | number | boolean, colorName?: ModifierColorName): RowOutType {
		if (!colorName) {
			if (typeof text === "number") {
				colorName = "yellow";
			} else if (typeof text === "boolean") {
				colorName = text ? "green" : "red";
			}
		}

		if (typeof text === "boolean") {
			text = text ? "yes" : "no";
		}

		text = String(text).trim();
		return {
			text,
			length: text.length,
			color: colorName,
		};
	}

	function writeln(text: string = "") {
		text && stream.write(text);
		stream.write("\n");
	}

	function writeBorder(left: string, br: string, right: string) {
		let txt = left;
		for (let i = 0; i < calc.length; i++) {
			txt += "".padEnd(calc[i] + 2, "─");
			txt += i + 1 === calc.length ? right : br;
		}
		writeln(txt);
	}

	function writeRow(row: RowOutType[]) {
		let txt = "│";
		for (let i = 0; i < calc.length; i++) {
			const cell = row[i];
			let text = cell.text;
			if (cell.color) {
				text = color(cell.color, text);
			}
			txt += " ";
			txt += text;
			txt += "".padEnd(calc[i] - cell.length, " ");
			txt += " │";
		}
		writeln(txt);
	}

	function writePlainRow(row: RowOutType[]) {
		writeln("- ID: " + color.white(row[0].text));
		for (let i = 1; i < row.length; i++) {
			const cell = row[i];
			let text = cell.text;
			if (cell.color) {
				text = color(cell.color, text);
			}
			writeln("  " + names[i] + ": " + text);
		}
	}
}
