import type { ElementType, ReactElement } from "react";
import type { Options } from "@phragon/loadable";
import type { ReactFallbackProps } from "@phragon/render-driver-react/loadable";
import { loadable } from "@phragon/render-driver-react/loadable";

import "./index.scss";

const baseLoadableOptions: Partial<Options<ReactElement, ReactFallbackProps>> = {
	throwable: true,
};

const pages: Record<string, () => Promise<{ default: ElementType }>> = {
	"page": () => import("./Page"),
};

Object.keys(pages).forEach((name) => {
	loadable({
		name,
		loader: pages[name],
		...baseLoadableOptions,
	});
});

export {};
