import React from "react";
import { __isDev__ } from "@phragon-util/global-var";
import type { ElementType } from "react";

const components: Map<string, ElementType> = new Map();
const errorComponentProps = { style: { background: "darkred", borderRadius: 10, padding: 12, color: "white" } };
const fallback: Map<string, Set<Function>> = new Map();

function createFallback(name: string) {
	const Fallback: ElementType = () =>
		React.createElement("div", errorComponentProps, `The "${name}" component not found.`);
	const Component: ElementType = (props: {}) => {
		const [El, setEl] = React.useState<ElementType>(Fallback);
		React.useEffect(() => {
			if (!fallback.has(name)) {
				fallback.set(name, new Set());
			}
			const fb = fallback.get(name)!;
			fb.add(setEl);
			return () => {
				fb.delete(setEl);
				if (fb.size === 0) {
					fallback.delete(name);
				}
			};
		}, []);
		return React.createElement(El, props);
	};
	if (__isDev__()) {
		Component.displayName = `Fallback(${name})`;
	}
	return Component;
}

export function component<T extends ElementType = ElementType>(name: string): T {
	if (!components.has(name)) {
		components.set(name, createFallback(name));
	}
	return components.get(name) as T;
}

export function componentObject<T extends Record<string, ElementType>>(names: (keyof T)[]): T {
	const object: Record<string, ElementType> = {};
	for (const name of names as string[]) {
		object[name] = component(name);
	}
	return object as T;
}

export function define(name: string, component: ElementType, override = true) {
	const fb = fallback.get(name);
	if (fb) {
		fallback.delete(name);
	}
	if (!components.has(name) || override) {
		components.set(name, component);
	}
	if (fb) {
		component = components.get(name)!;
		for (const fn of fb) {
			fn(component);
		}
	}
}

export function defineObject<T extends Record<string, ElementType>>(object: T) {
	for (const name of Object.keys(object)) {
		define(name, object[name]);
	}
}

export function defined(name: string) {
	return components.has(name);
}
