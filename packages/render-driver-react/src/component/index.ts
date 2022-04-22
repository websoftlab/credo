import React from "react";
import type { ElementType } from "react";

const components: Record<string, ElementType> = {};
const errorComponentProps = { style: { background: "darkred", padding: 10, color: "white" } };

export function component(name: string) {
	return defined(name)
		? components[name]
		: () => React.createElement("div", errorComponentProps, `The "${name}" component not found.`);
}

export function define(name: string, component: ElementType, override = true) {
	if (!defined(name) || override) {
		components[name] = component;
	}
}

export function defined(name: string) {
	return components.hasOwnProperty(name);
}
