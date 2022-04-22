import createHeadComponent from "./createHeadComponent";
import type { HeadTagProps } from "./types";

export type MetaProps = HeadTagProps<{
	name?: string;
	property?: string;
	httpEquiv?: string;
	content: string;
}>;

export default createHeadComponent<MetaProps>("meta", {
	attributes: ["name", "property", "httpEquiv", "content"],
});
