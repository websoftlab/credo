import React from "react";
import ReactDOM from "react-dom";
import { useHeadContext } from "./context";
import { __isWeb__ } from "@phragon-util/global-var";
import type { HeadTagName } from "@phragon/html-head";

export default function HeadTagComponent(props: {
	singleton: boolean;
	name: HeadTagName;
	tagName: string;
	tagProps: any;
}) {
	const manager = useHeadContext();
	if (!manager) {
		throw Error("HeadManager is not initialized.");
	}

	const { name, tagName: Tag, singleton, tagProps } = props;
	const [init, setInit] = React.useState(false);
	const lastKey = React.useRef<string | null>(null);
	const key = React.useMemo(() => {
		const tag = {
			type: name,
			tagName: Tag,
			singleton,
			props: tagProps,
		};
		return manager.server ? manager.addServerTag(tag) : manager.addClientTag(tag);
	}, [name, singleton, Tag, manager]);

	if (key != lastKey.current) {
		if (lastKey.current != null) {
			manager.removeClientTag(lastKey.current);
		}
		lastKey.current = key;
	}

	if (__isWeb__()) {
		React.useLayoutEffect(() => {
			if (key) {
				setInit(manager.shouldRenderTag(key));
				return () => {
					manager.removeClientTag(key);
				};
			}
		}, [key]);
	}

	if (init) {
		return <>{ReactDOM.createPortal(<Tag {...tagProps} />, document.head)}</>;
	}

	return null;
}
