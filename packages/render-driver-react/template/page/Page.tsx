import { PageProps } from "@phragon/render-driver-react";

export interface Props {
	title: string;
	text: string;
}

export default function Page({ pageData: { title, text } }: PageProps<Props>) {
	return (
		<>
			<h1>{title}</h1>
			<p>{text}</p>
		</>
	);
}
