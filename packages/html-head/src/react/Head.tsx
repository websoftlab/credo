import type {ReactNode} from "react";
import type {HeadTag} from "../types";
import {useLayoutEffect} from "react";
import {Provider, useHeadContext} from "./context";
import HeadManager from "../HeadManager";
import clearHeadDOMTags from "../clearHeadDOMTags";

export interface HeadProps {
	children: ReactNode | ReactNode[];
	headTags?: HeadTag[];
}

export default function Head(props: HeadProps) {
	const {children, headTags = []} = props;
	const parent = useHeadContext();
	const ctx: HeadManager = parent || new HeadManager(headTags);

	if(!__SSR__) {
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