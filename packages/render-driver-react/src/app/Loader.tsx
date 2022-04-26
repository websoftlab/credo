import React from "react";
import { useLocation } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { component, defined } from "../component";
import type { Page } from "@phragon/app";
import type { CSSProperties, ElementType, ReactNode } from "react";

const errorStyle: CSSProperties = {
	padding: 15,
	margin: 30,
	backgroundColor: "darkred",
	color: "white",
	borderRadius: 4,
};

const PageLayout = (props: { children: ReactNode }) => props.children as JSX.Element;
const PageSpinner = () => null;
const PageError = (props: { message: string }) => <div style={errorStyle}>{props.message}</div>;

function Loader(props: { page: Page.StoreInterface<ElementType>; onMount: () => void }) {
	const { page, onMount } = props;
	const location = useLocation();
	const { key = "", pathname, search } = location;
	const url = pathname + search;
	const { response: Rs } = page;

	if (__WEB__) {
		React.useEffect(() => {
			if (page.url !== url || page.key !== key) {
				page.load(url, key);
			}
		}, [key, url]);

		React.useEffect(onMount);
	}

	const Layout: ElementType = defined("layout") ? component("layout") : PageLayout;
	const Spinner: ElementType = defined("spinner") ? component("spinner") : PageSpinner;
	const Error: ElementType = defined("error") ? component("error") : PageError;

	return (
		<Layout page={page}>
			<Spinner spin={page.loading} />
			{!page.loading && page.error && <Error message={page.errorMessage} />}
			{Rs && <Rs.Component {...Rs.props} pageData={Rs.data} />}
		</Layout>
	);
}

export default observer(Loader);
