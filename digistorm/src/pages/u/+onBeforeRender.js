export { onBeforeRender }

async function onBeforeRender (pageContext) {
	let pageProps, erreur
	if (pageContext.role === 'utilisateur') {
		const urlOriginal = pageContext.urlOriginal
		const params = pageContext.params
		const hote = pageContext.hote
		const langues = pageContext.langues
		const identifiant = pageContext.identifiant
		const nom = pageContext.nom
		const email = pageContext.email
		const langue = pageContext.langue
		const role = pageContext.role
		const interactions = pageContext.interactions
		const favoris = pageContext.favoris
		const corbeille = pageContext.corbeille
		const dossiers = pageContext.dossiers
		const filtre = pageContext.filtre
		const titrePage = identifiant + ' - Digistorm by La Digitale'
		pageProps = { urlOriginal, params, hote, langues, identifiant, nom, email, langue, role, interactions, favoris, corbeille, dossiers, filtre, titrePage }
	} else {
		erreur = true
		pageProps = { erreur }
	}
	return {
		pageContext: {
			pageProps
		}
	}
}
