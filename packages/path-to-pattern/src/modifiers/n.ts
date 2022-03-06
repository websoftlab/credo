import {escapeRegExp, isNum} from "../utils";

const notDReg = /[^0-9]+/g;
const dgt = "0123456789";

function lr(args: string[]) {
	if(!isNum(args[0]) || !isNum(args[1])) {
		throw new Error("The `n` modifier must have first and second numeric arguments");
	}
	const l = parseInt(args[0]);
	const r = parseInt(args[1]);
	if(l < 1 || r < l) {
		throw new Error("For the `n` modifier, the value of the first argument must be less than or equal to the second");
	}
	return {l, r};
}

export default {
	regExp(args: string[]) {
		if(!args.length || args.length === 3) {
			if(args.length === 3) {
				let symbol = "";
				let dash = false;
				const all = args[2];
				for(let i = 0; i < all.length; i++) {
					const n = all[i];
					if(n === "-") {
						dash = true;
					} else if(!dgt.includes(n) && !symbol.includes(n)) {
						symbol += n;
					}
				}
				if(symbol.length || dash) {
					return `[0-9${dash ? "\\-" : ""}${symbol ? escapeRegExp(symbol) : ""}]+`;
				}
			}
			return "\\d+";
		}
		if(args.length === 1) {
			if(!isNum(args[0])) {
				throw new Error("The `n` modifier must have 1 or 2 numeric arguments");
			}
			let val = parseInt(args[0]);
			if(val < 1) {
				val = 1;
			}
			return `\\d{${val}}`;
		}
		if(args.length === 2) {
			const {l, r} = lr(args);
			return l === r ? `\\d{${l}}` : `\\d{${l},${r}}`;
		}
		throw new Error("The `n` modifier must have no more than 3 arguments");
	},
	formatter(args: string[]) {
		if(args.length !== 3) {
			return undefined;
		}
		const {l, r} = lr(args);
		return (value: string) => {
			value = value.replace(notDReg, '');
			return l <= value.length && r >= value.length ? { value } : false;
		}
	}
};