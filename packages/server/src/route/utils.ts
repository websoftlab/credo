import type { RouteConfig } from "../types";
import type { Nullable } from "../helpTypes";

const regUpperTest = /[^A-Z]/;

class NameGen {
	private iter: number = 1;
	gen() {
		return `route-key-${this.iter++}`;
	}
}

export const nameGen = new NameGen();

export function trimLeftSegment(segment: string) {
	segment = segment.trim();
	while (segment.startsWith("/")) {
		segment = segment.substring(1);
	}
	return segment;
}

export function trimRightSegment(segment: string) {
	segment = segment.trim();
	while (segment.endsWith("/")) {
		segment = segment.slice(0, -1);
	}
	return segment;
}

export function trimSegment(segment: string) {
	return trimLeftSegment(trimRightSegment(segment));
}

export function createMethods(method: Nullable<RouteConfig.Method>): string[] {
	if (!method) {
		return ["GET"];
	}
	if (!Array.isArray(method)) {
		method = [method];
	}
	const support: string[] = [];
	method.forEach((val) => {
		val = String(val).trim().toUpperCase();
		if (val.length > 0 && !regUpperTest.test(val) && !support.includes(val)) {
			support.push(val);
		}
	});
	return support;
}
