import {escapeRegExp} from "../utils";

function minMax(data: any, name: string, val: number, min: number, max: number, offset: number = 0) {
	if(val < min || val > max) {
		return false;
	}
	data[name] = val + offset;
	return true;
}

const dates: Record<string, {r: string, f?: Function, d(val: any, data: any): boolean}> = {};

// День месяца, 2 цифры с ведущим нулём от 01 до 31
dates.d = {
	r: "(\\d{2})",
	f: parseInt,
	d(val: number, data: any) { return minMax(data, "d", val, 1, 31); },
};

// День месяца без ведущего нуля от 1 до 31
dates.j = {
	r: "(\\d{1,2})",
	f: parseInt,
	d: dates.d.d,
};

// Порядковый номер месяца с ведущим нулём	от 01 до 12
dates.m = {
	r: "(\\d{2})",
	f: parseInt,
	d(val: number, data: any) { return minMax(data, "m", val, 1, 12); }
};

// Порядковый номер месяца без ведущего нуля	от 1 до 12
dates.n = {
	r: "(\\d{1,2})",
	f: parseInt,
	d: dates.m.d
};

// Порядковый номер года, 4 цифры	Примеры: 1999, 2003
dates.Y = {
	r: "(\\d{4})",
	f: parseInt,
	d(val: number, data: any) {
		data.Y = val;
		return true;
	}
};

// Номер года, 2 цифры	Примеры: 99, 03
dates.y = {
	r: "(\\d{2})",
	f: parseInt,
	d(val: number, data: any) {
		data.Y = val < 30 ? 2000 + val : 1900 + val;
		return true;
	}
};

// Ante meridiem (лат. "до полудня") или Post meridiem (лат. "после полудня") в нижнем регистре	am или pm
dates.a = {
	r: "(am|pm)",
	f: (val: string) => {
		return val === "am" ? "am" : "pm";
	},
	d(val: "am" | "pm", data: any) {
		data.a = val;
		return true;
	}
};

// Ante meridiem или Post meridiem в верхнем регистре	AM или PM
dates.A = {
	r: "(AM|PM)",
	f: (val: string) => {
		return val === "AM" ? "am" : "pm";
	},
	d: dates.a.d,
};

// Часы в 12-часовом формате без ведущего нуля	от 1 до 12
dates.g = {
	r: "(\\d{1,2})",
	f: parseInt,
	d(val: number, data: any) { return minMax(data, "g", val, 1, 12); }
};

// Часы в 24-часовом формате без ведущего нуля	от 0 до 23
dates.G = {
	r: "(\\d{1,2})",
	f: parseInt,
	d(val: number, data: any) { return minMax(data, "H", val, 0, 23); }
};

// Часы в 12-часовом формате с ведущим нулём	от 01 до 12
dates.h = {
	r: "(\\d{2})",
	f: parseInt,
	d: dates.g.d,
};

// Часы в 24-часовом формате с ведущим нулём	от 00 до 23
dates.H = {
	r: "(\\d{2})",
	f: parseInt,
	d: dates.G.d,
};

// Минуты с ведущим нулём	от 00 до 59
dates.i = {
	r: "(\\d{2})",
	f: parseInt,
	d(val: number, data: any) { return minMax(data, "i", val, 0, 59); }
};

// Секунды с ведущим нулём	от 00 до 59
dates.s = {
	r: "(\\d{2})",
	f: parseInt,
	d(val: number, data: any) { return minMax(data, "s", val, 0, 59); }
};

// Микросекунды. Учтите, что date() всегда будет возвращать 000000,
// т.к. она принимает целочисленный (int) параметр,
// тогда как DateTime::format() поддерживает микросекунды, если DateTime создан с ними.	Например: 654321
dates.u = {
	r: "(\\d{6})",
	f: parseInt,
	d(val: number, data: any) {
		data.u = val;
		return true;
	}
};

// Миллисекунды. Замечание такое же как и для u.	Пример: 654
dates.v = {
	r: "(\\d{3})",
	f: parseInt,
	d(val: number, data: any) {
		data.v = val;
		return true;
	}
};

// Разница с временем по Гринвичу без двоеточия между часами и минутами	Например: +0200
dates.O = {
	r: "(\\+\\d{4})",
	d(val: string, data: any) {
		return timeOffset(val.substring(1, 3), val.substring(3, 5), data);
	}
};

// Разница с временем по Гринвичу с двоеточием между часами и минутами	Например: +02:00
dates.P = { // +12:12
	r: "(Z|\\+\\d{2}:\\d{2})",
	d(val: string, data: any) {
		if(val === "Z") {
			data.z1 = 0;
			data.z2 = 0;
		}
		return timeOffset(val.substring(1, 3), val.substring(4, 6), data);
	}
};

const dKey: string[] = Object.keys(dates);
const ISOReg = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+\d{2}:\d{2})$/;
const UnixReg = /^(-?)(0|[1-9]\d*)$/;

function createISO() {
	return function (val: string) {
		if(!ISOReg.test(val)) {
			return false;
		}
		return getDateValue(new Date(val));
	}
}

function createUnix() {
	return function (val: string) {
		const m = val.match(UnixReg);
		if(!m) {
			return false;
		}
		let time = parseInt(m[2]);
		if(time > 0 && m[1] === "-") {
			time *= -1;
		}
		const value = new Date();
		value.setTime(time * 1000);
		return getDateValue(value);
	}
}

function timeOffset(z1: string, z2: string, data: any) {
	return minMax(data, "z1", parseInt(z1), 0, 23) && minMax(data, "z2", parseInt(z2), 0, 59);
}

function zeroYearPad(val: number) {
	return val < 10 ? `000${val}` : (val < 100 ? `00${val}` : (val < 1000 ? `0${val}` : String(val)));
}

function zeroPad(val: number) {
	return val < 10 ? `0${val}` : String(val);
}

const separators = "-:";
function parse(str: string): {
	regExp: RegExp,
	func: Array<{ f?: Function, d(val: any, data: any): boolean }>,
} {
	const func: Array<{ f?: Function, d(val: any, data: any): boolean }> = [];
	let reg = "";
	let i = 0;

	while(i < str.length) {
		let char = str[i++];
		if(char === "\\") {
			char = str[i++];
			if(!char) {
				throw new Error("Unexpected end of line");
			}
			reg += escapeRegExp(char);
		} else if(separators.includes(char)) {
			reg += escapeRegExp(char);
		} else if(dKey.includes(char)) {
			const {d, r, f} = dates[char];
			reg += r;
			func.push({d, f});
		} else {
			throw new Error(`Invalid character ${char}`);
		}
	}

	return {
		regExp: new RegExp("^" + reg + "$"),
		func,
	};
}

function createDate(data: any, tm: {z1: number, z2: number}) {

	let time = "";
	time += zeroYearPad(data.Y == null ? (new Date()).getFullYear() : data.Y);
	time += "-" + zeroPad(data.m == null ? 1 : data.m);
	time += "-" + zeroPad(data.d == null ? 1 : data.d);
	time += "T";

	if(data.g != null) {
		let val: number = data.g;
		if(data.a === "pm") {
			if(val < 12) val += 12;
		} else {
			if(val === 12) val = 0;
		}
		time += zeroPad(val);
	} else {
		time += zeroPad(data.H == null ? 0 : data.H);
	}

	time += ":" + zeroPad(data.i == null ? 0 : data.i);
	time += ":" + zeroPad(data.s == null ? 0 : data.s);

	if(data.u != null && data.u > 0) {
		time += `.${data.u}`;
	} else if(data.v != null && data.v > 0) {
		time += `.${data.v}`;
	}

	time += "+" + zeroPad(data.z1 == null ? tm.z1 : data.z1);
	time += ":" + zeroPad(data.z2 == null ? tm.z2 : data.z2);

	return new Date(time);
}

function getDateValue(value: Date) {
	return isNaN(value as never) ? false : {value};
}

export default {
	regExp: ".+?",
	formatter(args: string[]) {
		if(args.length > 2) {
			throw new Error("The `date` modifier must have no more than 2 arguments");
		}
		const first = args[0] || "dmYHi";
		if(args.length === 1) {
			if(first === "c") return createISO();
			if(first === "U") return createUnix();
		}
		const tm = {z1: 0, z2: 0};
		if(args[1]) {
			const t = args[1].match(/^+(\d{2}):?(\d{2})$/);
			if(!t || !timeOffset(t[1], t[2], tm)) {
				throw new Error("Invalid time zone offset argument");
			}
		}
		const {regExp, func} = parse(first);
		return (val: string) => {
			const m = val.match(regExp);
			if(!m) {
				return false;
			}
			const data: any = {};
			for(let i = 0; i < func.length; i++) {
				let val = m[i + 1];
				const {f, d} = func[i];
				if(f) {
					val = f(val);
				}
				if(!d(val, data)) {
					return false;
				}
			}
			return getDateValue(createDate(data, tm));
		};
	}
}