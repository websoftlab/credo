import type {RouteVariant} from "./types";
import {default as RouteEntity} from "./RouteEntity";

// type 1: pattern
// type 2: group
// type 3: dynamic

export function sortPattern(a: RouteVariant, b: RouteVariant) {

	// group to top
	if(RouteEntity.isRouteGroup(b)) {
		if(RouteEntity.isRouteGroup(a)) {
			return b.length - a.length;
		}
		return 1;
	}

	if(RouteEntity.isRouteGroup(a)) {
		return -1;
	}

	if(RouteEntity.isRoutePattern(b)) {

		// pattern vs pattern
		if(RouteEntity.isRoutePattern(a)) {
			let bl = b.pattern ? b.pattern.length : -1;
			let al = a.pattern ? a.pattern.length : -1;
			if(b.pattern && a.pattern) {
				if(al !== bl) {
					return bl - al;
				}
				let aNoKeys = a.pattern.keys.length === 0;
				if(b.pattern.keys.length === 0) {
					if(aNoKeys) {
						return 1;
					}
				} else if(aNoKeys) {
					return - 1;
				}
				return b.priority - a.priority;
			}
			if(bl === al) {
				return b.priority - a.priority;
			} else {
				return bl - al;
			}
		}

		// dynamic vs pattern
		const al = a.length;
		if(al == null) {
			return 1;
		}
		if(b.pattern) {
			const bl =  b.pattern.length;
			if(al !== bl) {
				return bl - al;
			}
		}
		return b.priority - a.priority;
	}

	// pattern vs dynamic
	if(RouteEntity.isRoutePattern(a)) {
		const bl = b.length;
		if(bl == null) {
			return -1;
		}
		if(a.pattern) {
			const al =  a.pattern.length;
			if(al !== bl) {
				return bl - al;
			}
		}
		return b.priority - a.priority;
	}

	// dynamic vs dynamic
	const al = a.length;
	const bl = b.length;

	if(al != null) {
		if(bl != null) {
			if(al !== bl) {
				return bl - al;
			}
		} else {
			return -1;
		}
	} else if(bl != null) {
		return 1;
	}

	return b.priority - a.priority;
}

export function sortNative(a: RouteVariant, b: RouteVariant) {
	return b.priority - a.priority;
}
