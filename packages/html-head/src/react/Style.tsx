import createHeadComponent from "./createHeadComponent";
import type {HeadTagProps} from "./types";

export type StyleProps = HeadTagProps<{
    media?: string;
	type?: string;
	children?: string;
}>;

export default createHeadComponent<StyleProps>("style", {
	singleton: false,
	child: true,
	attributes: [
		"media",
		"type",
	]
});