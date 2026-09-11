export { onBeforeRender }

async function onBeforeRender (pageContext) {
	let pageProps, erreur
	if (pageContext.hasOwnProperty('erreur')) {
		erreur = true
		pageProps = { erreur }
	} else {
		const urlOriginal = pageContext.urlOriginal
		const params = pageContext.params
		const hote = pageContext.hote
		const langues = pageContext.langues
		const identifiant = pageContext.identifiant
		const nom = pageContext.nom
		const langue = pageContext.langue
		const role = pageContext.role
		const interactions = pageContext.interactions
		const code = pageContext.routeParams.code
		const type = pageContext.type
		const titre = pageContext.titre
		const motdepasse = pageContext.motdepasse
		const proprietaire = pageContext.proprietaire
		const donnees = pageContext.donnees
		const reponses = pageContext.reponses
		const sessions = pageContext.sessions
		const bannis = pageContext.bannis
		const statut = pageContext.statut
		const session = pageContext.session
		const digidrive = pageContext.digidrive
		const titrePage = titre + ' - Digistorm by La Digitale'
		pageProps = { urlOriginal, params, hote, langues, identifiant, nom, langue, role, interactions, code, type, titre, motdepasse, proprietaire, donnees, reponses, sessions, bannis, statut, session, digidrive, titrePage }
	}
	return {
		pageContext: {
			pageProps
		}
	}
}
