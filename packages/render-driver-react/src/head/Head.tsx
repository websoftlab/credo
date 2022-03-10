import type {ReactNode} from "react";
import type {HeadTag} from "@credo-js/html-head";
import {useLayoutEffect} from "react";
import {Provider, useHeadContext} from "./context";
import {HeadManager, clearHeadDOMTags} from "@credo-js/html-head";

export interface HeadProps {
	children: ReactNode | ReactNode[];
	headTags?: HeadTag[];
}

export default function Head(props: HeadProps) {
	const {children, headTags = []} = props;
	const parent = useHeadContext();
	const ctx: HeadManager = parent || new HeadManager(headTags);

	if(__WEB__) {
		useLayoutEffect(() => {
			if(!parent) {
				clearHeadDOMTags();
			}
		}, []);
	}

	if(parent) {
		return (
			<>
				children
			</>
		);
	}

	return (
		<Provider value={ctx}>
			{children}
		</Provider>
	)
}