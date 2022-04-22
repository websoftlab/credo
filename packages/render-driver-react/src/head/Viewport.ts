import createHeadComponent from "./createHeadComponent";
import type { HeadTagProps } from "./types";

export type ViewportProps = HeadTagProps<{
	content: string;
}>;

export default createHeadComponent<ViewportProps>("viewport", {
	singleton: true,
	tagName: "meta",
	requiredProps: {
		name: "viewport",
	},
	attributes: ["name", "content"],
});
