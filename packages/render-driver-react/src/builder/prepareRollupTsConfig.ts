export default function prepareRollupTsConfig(option: any) {
	if (!option.jsx) {
		option.jsx = "react-jsx";
	}
}
