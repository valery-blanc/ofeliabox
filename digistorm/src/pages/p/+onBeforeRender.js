import axios from 'axios'

export { onBeforeRender }

async function onBeforeRender (pageContext) {
	let pageProps, erreur
	const code = pageContext.routeParams.code
	const identifiant = pageContext.identifiant
	const reponse = await axios.post(pageContext.hote + '/api/recuperer-donnees-interaction-utilisateur', {
		code: code,
		identifiant: identifiant
	}, {
		headers: { 'Content-Type': 'application/json' }
	}).catch(() => {
		erreur = true
		pageProps = { erreur }
	})
	if (!reponse || !reponse.hasOwnProperty('data') || (reponse.data && reponse.data === 'erreur') || (reponse.data && reponse.data.type === undefined)) {
		erreur = true
		pageProps = { erreur }
	} else {
		const urlOriginal = pageContext.urlOriginal
		const params = pageContext.params
		const hote = pageContext.hote
		const langues = pageContext.langues
		const nom = pageContext.nom
		const langue = pageContext.langue
		const type = reponse.data.type
		const titre = reponse.data.titre
		const donnees = reponse.data.donnees
		const reponsesSession = reponse.data.reponsesSession
		const donneesSession = reponse.data.donneesSession
		const banni = reponse.data.banni
		const scoreTotal = reponse.data.scoreTotal
		const statut = reponse.data.statut
		const session = reponse.data.session
		const nomObligatoire = reponse.data.nomObligatoire
		const nomAleatoire = reponse.data.nomAleatoire
		const titrePage = titre + ' - Digistorm by La Digitale'
		pageProps = { urlOriginal, params, hote, langues, identifiant, nom, langue, code, type, titre, donnees, reponsesSession, donneesSession, banni, scoreTotal, statut, session, nomObligatoire, nomAleatoire, titrePage }
	}
	return {
		pageContext: {
			pageProps
		}
	}
}
