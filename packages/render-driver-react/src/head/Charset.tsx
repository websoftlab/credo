import createHeadComponent from "./createHeadComponent";
import type {HeadTagProps} from "./types";

export type CharsetProps = HeadTagProps<{
	charSet: string;
}>;

export default createHeadComponent<CharsetProps>("charset", {
	singleton: true,
	tagName: "meta",
	attributes: [
		"charSet"
	]
});