import type {ElementType} from "react";
import type {HeadTagName} from "../types";
import {createElement} from "react";
import HeadTagComponent from "./HeadTagComponent";

const defaultAttributes: string[] = [
	"id",
	"key",
	"accessKey",
	"className",
	"contentEditable",
	"dir",
	"draggable",
	"hidden",
	"lang",
	"spellCheck",
	"style",
	"tabIndex",
	"title",
	"translate",
];

const renameAttributes: Record<string, string> = {
	"class": "className",
	"contenteditable": "contentEditable",
	"spellcheck": "spellCheck",
	"tabindex": "tabIndex",
	"accesskey": "accessKey",
	"crossorigin": "crossOrigin",
	"hreflang": "hrefLang",
	"referrerpolicy": "referrerPolicy",
	"httpequiv": "httpEquiv",
	"http-equiv": "httpEquiv",
	"charset": "charSet",
};

function filterAttributes(props: any, attributes: string[], child: boolean) {
	const rest: any = {};

	if(child && typeof props.children === "string") {
		rest.children = props.children;
	}

	Object.keys(props).forEach((name: string) => {

		// normalize attribute name
		if(renameAttributes[name]) {
			name = renameAttributes[name];
		}

		const pref = name.substring(0, 5);
		if(
			pref === "data-" ||
			pref === "aria-" ||
			attributes.indexOf(name) !== -1 ||
			defaultAttributes.indexOf(name) !== -1
		) {
			rest[name] = props[name];
		}
	});

	return rest;
}

export default function createHeadComponent<T = {}>(
	name: HeadTagName,
	options: {
		tagName?: string;
		singleton?: boolean;
		child?: boolean;
		attributes?: string[];
		requiredProps?: any;
	}
): ElementType<T> {

	const {
		tagName = name,
		singleton = false,
		child = false,
		attributes = [],
		requiredProps = null
	} = options;

	class HeadElm extends HeadTagComponent {
		typeName: HeadTagName = name;
		tagName: string = tagName;
		singleton: boolean = singleton;
	}

	const Elm = function(props: any) {
		if(requiredProps != null) {
			Object.assign(props, requiredProps);
		}
		return createElement(HeadElm, filterAttributes(props, attributes, child));
	};

	Elm.displayName = `Head${name[0].toUpperCase()}${name.substr(1)}`;
	return Elm;
}