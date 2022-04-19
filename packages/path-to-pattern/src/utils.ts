
const isNumReg =/^[1-9]\d*$/;

export function isNum(value: string): boolean {
	return value === "0" || isNumReg.test(value);
}

export function noArgs(name: string, args: string[]) {
	if(args.length) {
		throw new Error(`The \`${name}\` modifier must not have arguments`);
	}
}

export function unique(name: string, value: string[]): string[] {
	const ids: string[] = [];
	value.forEach(val => {
		if(!ids.includes(val)) {
			ids.push(val);
		}
	});
	if(ids.length < 1) {
		throw new Error(`The \`${name}\` modifier must have at least one argument`);
	}
	return ids;
}

export function uniqueNum(name: string, value: string[]): number[] {
	return unique(name, value).map(arg => {
		if(!isNum(arg)) {
			throw new Error(`The \`${name}\` modifier must have only numeric arguments`);
		}
		return parseInt(arg);
	});
}