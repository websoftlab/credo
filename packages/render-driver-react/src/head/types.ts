import type { CSSProperties } from "react";

type Booleanish = boolean | "true" | "false";

export type HeadTagProps<Props = {}> = Props & {
	key?: string;

	// Standard HTML Attributes
	accessKey?: string | undefined;
	className?: string | undefined;
	contentEditable?: Booleanish | "inherit" | undefined;
	dir?: string | undefined;
	draggable?: Booleanish | undefined;
	hidden?: boolean | undefined;
	id?: string | undefined;
	lang?: string | undefined;
	spellCheck?: Booleanish | undefined;
	style?: CSSProperties | undefined;
	tabIndex?: number | undefined;
	title?: string | undefined;
	translate?: "yes" | "no" | undefined;
};
