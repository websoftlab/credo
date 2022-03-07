export default function clearHeadDOMTags() {
	const ssrTags = document.head.querySelectorAll(`[data-ssr="head"]`);
	Array.prototype.forEach.call(ssrTags, (ssrTag) => {
		ssrTag.parentNode.removeChild(ssrTag)
	});
}
