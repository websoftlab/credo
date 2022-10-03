import { useEffect, useLayoutEffect } from "react";

export const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function createEvent<T extends object>(
	event: T
): T & { readonly defaultPrevented: boolean; preventDefault(): void } {
	let prevented = false;
	return {
		...event,
		get defaultPrevented() {
			return prevented;
		},
		preventDefault() {
			prevented = true;
		},
	};
}
