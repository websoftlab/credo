import type { ElementType, ReactElement } from "react";
import type { Options } from "@phragon/loadable";
import type { ReactFallbackProps } from "@phragon/render-driver-react";
import { loader } from "@phragon/render-driver-react";

const baseLoadableOptions: Partial<Options<ReactElement, ReactFallbackProps>> = {
	throwable: true,
};

const pages: Record<string, () => Promise<{ default: ElementType }>> = {
	"page": () => import("./page"),
};

Object.keys(pages).forEach((name) => {
	loader.loadable({
		name,
		loader: pages[name],
		...baseLoadableOptions,
	});
});

export {};
