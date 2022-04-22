import createHeadComponent from "./createHeadComponent";
import type { HeadTagProps } from "./types";

export type TitleProps = HeadTagProps<{
	children?: string;
}>;

export default createHeadComponent<TitleProps>("title", {
	singleton: true,
	child: true,
});
