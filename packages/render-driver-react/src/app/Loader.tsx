import React from "react";
import { useLocation } from "./route";
import { observer } from "mobx-react-lite";
import { component, defined } from "../component";
import { __isWeb__ } from "@phragon/utils";
import type { Page } from "@phragon/app";
import type { CSSProperties, ElementType } from "react";
import type { ComponentLayout, ComponentPageSpin, ComponentPageError } from "./types";

const errorStyle: CSSProperties = {
	padding: 15,
	margin: 30,
	backgroundColor: "darkred",
	color: "white",
	borderRadius: 4,
};

const PageLayout: ComponentLayout = ({ children }) => React.createElement(React.Fragment, { children });
const PageSpinner: ComponentPageSpin = () => null;
const PageError: ComponentPageError = ({ message }) => <div style={errorStyle}>{message}</div>;

function Loader(props: { page: Page.StoreInterface<ElementType>; onMount: () => void }) {
	const { page, onMount } = props;
	const location = useLocation();
	const { key = "", pathname, search } = location;
	const url = pathname + search;
	const { response: Rs } = page;

	if (__isWeb__()) {
		React.useEffect(() => {
			if (page.url !== url || page.key !== key) {
				page.load(url, key);
			}
		}, [key, url]);

		React.useEffect(onMount);
	}

	const Layout = defined("layout") ? component("layout") : PageLayout;
	const Spinner = defined("spinner") ? component("spinner") : PageSpinner;
	const Error = defined("error") ? component("error") : PageError;

	return (
		<>
			<Spinner spin={page.loading} />
			<Layout page={page}>
				{!page.loading && page.error && <Error code={page.code} message={page.errorMessage} />}
				{Rs && <Rs.Component {...Rs.props} pageData={Rs.data} />}
			</Layout>
		</>
	);
}

export default observer(Loader);
