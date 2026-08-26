export { onBeforeRender }

function onBeforeRender (pageContext) {
	const params = pageContext.params
	const hote = pageContext.hote
	const langues = pageContext.langues
	const langue = pageContext.langue
	const titrePage = 'Digistorm by La Digitale'
	const pageProps = { params, hote, langues, langue, titrePage }
	return {
		pageContext: {
			pageProps
		}
	}
}
