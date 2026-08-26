<template>
	<div id="page" v-if="!utilisateurBanni">
		<div id="interaction">
			<header>
				<div id="conteneur-header">
					<a id="logo" :href="hote" />

					<div id="titre">
						<span>{{ titre }}</span>
					</div>

					<div id="parametres">
						<button type="button" :disabled="disabled" :title="$t('rechargerDonnees')" :aria-label="$t('rechargerDonnees')" @click="rechargerDonnees('notification')"><i class="material-icons" aria-hidden="true">sync</i></button>
						<button type="button" :disabled="disabled" :title="$t('afficherParametres')" :aria-label="$t('afficherParametres')" @click="afficherModaleParametres"><i class="material-icons" aria-hidden="true">settings</i></button>
					</div>
				</div>
			</header>

			<TransitionGroup name="fondu">
				<div id="conteneur" class="ascenseur" :class="{'avec-footer': (statut === 'ouvert' || statut === 'verrouille') && (donnees.options.progression === 'libre' && ((donnees.description !== '' || Object.keys(donnees.support).length > 0) || (donnees.description === '' && Object.keys(donnees.support).length === 0 && donnees.questions.length > 1))) || (donnees.options.progression === 'animateur' && indexQuestion > -1)}" v-if="(statut === 'ouvert' || statut === 'verrouille') && (type === 'Sondage' || type === 'Questionnaire')" key="conteneur-ouvert-multi">
					<SondageParticiper :identifiant="identifiant" :nom="nom" :code="code" :donnees="donnees" :reponses="reponsesSession" :statut="statut" :session="session" :index-question="indexQuestion" :validation="validation" :reponse-envoyee="reponseEnvoyee" :rechargement="rechargementDonnees" @validation="envoyerReponse" @index="modifierIndexQuestion('suivante')" @image="afficherImage" @support="afficherSupport" v-if="type === 'Sondage'" />

					<QuestionnaireParticiper :identifiant="identifiant" :nom="nom" :code="code" :donnees="donnees" :reponses="reponsesSession" :donneesSession="donneesSession" :statut="statut" :session="session" :index-question="indexQuestion" :date="date" :validation="validation" :reponse-envoyee="reponseEnvoyee" :temps-ecoule="tempsEcoule" :rechargement="rechargementDonnees" @validation="envoyerReponse" @index="modifierIndexQuestion('suivante')" @image="afficherImage" @support="afficherSupport" v-else-if="type === 'Questionnaire'" />
				</div>

				<div id="conteneur" class="ascenseur" v-else-if="(statut === 'ouvert' || statut === 'verrouille' || statut === 'nuage-affiche') && (type === 'Remue-méninges' || type === 'Nuage-de-mots')" key="conteneur-ouvert">
					<RemueMeningesParticiper :identifiant="identifiant" :nom="nom" :code="code" :donnees="donnees" :reponses="reponsesSession" :statut="statut" :session="session" @image="afficherImage" @media="afficherMedia" v-if="type === 'Remue-méninges'" />

					<NuageMotsParticiper :identifiant="identifiant" :nom="nom" :code="code" :donnees="donnees" :reponses="reponsesSession" :statut="statut" :session="session" @image="afficherImage" @media="afficherMedia" v-if="type === 'Nuage-de-mots'" />
				</div>

				<div id="conteneur" class="interaction-fermee" v-else key="conteneur-ferme">
					<div class="section">
						<div class="information" v-if="type === 'Sondage'">
							{{ $t('sondagePasOuvert') }}
						</div>
						<div class="information" v-else-if="type === 'Questionnaire' && statut !== 'attente'">
							{{ $t('questionnairePasOuvert') }}
						</div>
						<div class="information" v-else-if="type === 'Questionnaire' && statut === 'attente'">
							{{ $t('questionnaireAttenteOuverture') }}
						</div>
						<div class="information" v-else-if="type === 'Remue-méninges'">
							{{ $t('remueMeningesPasOuvert') }}
						</div>
						<div class="information" v-else-if="type === 'Nuage-de-mots'">
							{{ $t('nuageDeMotsPasOuvert') }}
						</div>
						<div class="points">
							<span class="point" />
							<span class="point" />
							<span class="point" />
						</div>
					</div>
				</div>

				<footer v-if="statut === 'ouvert' && (type === 'Sondage' || type === 'Questionnaire') && donnees.options.progression === 'animateur' && indexQuestion > -1" key="footer_animateur">
					<div class="section">
						<button type="button" class="bouton" :disabled="disabled" @click="valider" v-if="reponseEnvoyee[indexQuestion] !== 'reponse-envoyee' && tempsEcoule === false">{{ $t('valider') }}</button>
						<span class="reponse" v-else-if="reponseEnvoyee[indexQuestion] === 'reponse-envoyee'">{{ $t('reponseEnvoyee') }}</span>
						<Rebours :date="date" :temps="parseInt(donnees.questions[indexQuestion].temps)" :indexQuestion="indexQuestion" @tempsEcoule="tempsEcoule = true" v-if="donnees.options.hasOwnProperty('tempsReponse') && donnees.options.tempsReponse === true && indexQuestion > -1 && date > 0 && reponseEnvoyee[indexQuestion] !== 'reponse-envoyee'" />
					</div>
				</footer>
				<footer v-else-if="statut === 'ouvert' && (type === 'Sondage' || type === 'Questionnaire') && donnees.options.progression === 'libre' && ((donnees.description !== '' || Object.keys(donnees.support).length > 0) || (donnees.description === '' && Object.keys(donnees.support).length === 0 && donnees.questions.length > 1))" key="footer_libre">
					<div class="section boutons">
						<button type="button" class="bouton icone" :disabled="disabled" :title="$t('questionPrecedente')" :aria-label="$t('questionPrecedente')" :class="{'visible': (donnees.description === '' && Object.keys(donnees.support).length === 0 && indexQuestion > 0) || ((donnees.description !== '' || Object.keys(donnees.support).length > 0) && indexQuestion > -1 )}" @click="modifierIndexQuestion('precedente')"><i class="material-icons" aria-hidden="true">arrow_back</i></button>

						<button type="button" class="bouton icone visible" :disabled="disabled" :title="$t('monScore')" :aria-label="$t('monScore')" @click="afficherModaleScore" v-if="type === 'Questionnaire'"><i class="material-icons" aria-hidden="true">emoji_events</i></button>

						<button type="button" class="bouton icone" :disabled="disabled" :title="$t('questionSuivante')" :aria-label="$t('questionSuivante')" :class="{'visible': indexQuestion < donnees.questions.length - 1}" @click="modifierIndexQuestion('suivante')"><i class="material-icons" aria-hidden="true">arrow_forward</i></button>
					</div>
				</footer>
			</TransitionGroup>
		</div>

		<div class="conteneur-modale" v-if="modale === 'parametres'">
			<div id="modale-parametres" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('parametres') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModale"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('parametres')">
						<label>{{ $t('langue') }}</label>
						<div class="langue">
							<button type="button" :disabled="disabledModale" title="Français" aria-label="Français" :class="{'selectionne': langue === 'fr'}" @click="modifierLangue('fr')">FR</button>
							<button type="button" :disabled="disabledModale" title="Español" aria-label="Español" :class="{'selectionne': langue === 'es'}" @click="modifierLangue('es')">ES</button>
							<button type="button" :disabled="disabledModale" title="Italiano" aria-label="Italiano" :class="{'selectionne': langue === 'it'}" @click="modifierLangue('it')">IT</button>
							<button type="button" :disabled="disabledModale" title="Deutsch" aria-label="Deutsch" :class="{'selectionne': langue === 'de'}" @click="modifierLangue('de')">DE</button>
							<button type="button" :disabled="disabledModale" title="English" aria-label="English" :class="{'selectionne': langue === 'en'}" @click="modifierLangue('en')">EN</button>
						</div>
						<label for="nom-ou-pseudo" v-if="nombreReponsesEnvoyees === 0 || nom !== ''">{{ $t('nomOuPseudo') }}</label>
						<div class="nom" v-if="((donnees.hasOwnProperty('options') && donnees.options.nom === 'aleatoire') || $pageContext.pageProps.nomAleatoire) && (nombreReponsesEnvoyees === 0 || nom !== '')">
							<input id="nom-ou-pseudo" type="text" :value="nom" disabled>
							<button type="button" :disabled="disabledModale" :title="$t('genererPseudo')" :aria-label="$t('genererPseudo')" @click="genererNom" v-if="nombreReponsesEnvoyees === 0"><i class="material-icons" aria-hidden="true">sync</i></button>
						</div>
						<template v-else-if="nombreReponsesEnvoyees === 0 || nom !== ''">
							<input id="nom-ou-pseudo" type="text" :value="nom" :disabled="disabledModale || nombreReponsesEnvoyees > 0" @keydown.enter.prevent.stop="modifierNom">
							<div class="actions" v-if="nombreReponsesEnvoyees === 0">
								<button type="button" class="bouton" :disabled="disabledModale" @click="modifierNom">{{ $t('enregistrer') }}</button>
							</div>
						</template>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'nom'">
			<div id="modale-nom" class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('modifierNom')">
						<label for="nom-ou-pseudo">{{ $t('nomOuPseudo') }}</label>
						<input id="nom-ou-pseudo" type="text" :value="nom" :disabled="disabledModale" @keydown.enter="modifierNom">
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="modifierNom">{{ $t('valider') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'score'">
			<div id="modale-score" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('monScore') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModale"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu">
						<p v-html="formaterHTML(donnees.messageFin)" />
						<div class="etoiles" aria-hidden="true" v-if="etoilesScore">
							<span v-for="etoile in (parseInt(10 * (scoreTotal / pointsTotal)))" :key="etoile"><i class="material-icons">star_rate</i></span>
						</div>
						<span class="score">{{ scoreTotal }}</span>
						<span class="sur">{{ $t('sur') }}</span>
						<span class="total">{{ pointsTotal }}</span>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'message-fin'">
			<div id="modale-message-fin" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('finSondage') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModale"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu">
						<p v-html="formaterHTML(donnees.messageFin)" />
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'classement'">
			<div id="modale-classement" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('classement') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModale"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu">
						<ul class="classement">
							<li v-for="(utilisateur, index) in classement" :key="'utilisateur_' + index">
								<div class="utilisateur">
									<span class="index">{{ index + 1 }}</span>
									<span class="nom">{{ utilisateur.nom }}</span>
								</div>
								<div class="score">{{ (Math.round(utilisateur.score * 10) / 10) }}</div>
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'image'">
			<div id="modale-image" class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<img :src="image" :alt="alt">
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleImage">{{ $t('fermer') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'support'">
			<div id="modale-media" class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<img v-if="donnees.support.type === 'image'" :src="definirCheminFichier(donnees.support.fichier)" :alt="donnees.support.alt">
						<audio v-else-if="donnees.support.type === 'audio'" controls :src="definirCheminFichier(donnees.support.fichier)" />
						<div class="video" v-else-if="donnees.support.type === 'video'">
							<iframe :src="donnees.support.lien" allow="autoplay; fullscreen" />
						</div>
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModale">{{ $t('fermer') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'media'">
			<div id="modale-media" class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<img v-if="media.type === 'image'" :src="media.fichier" :alt="media.alt">
						<audio v-else-if="media.type === 'audio'" controls :src="media.fichier" />
						<div class="video" v-else-if="media.type === 'video'">
							<iframe :src="media.lien" allow="autoplay; fullscreen" />
						</div>
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleMedia">{{ $t('fermer') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<Notification :notification="notification" @fermer="notification = ''" />

		<Message :message="message" @elementPrecedent="definirElementPrecedent" @fermer="fermerMessage" v-if="message !== ''" />

		<Chargement v-if="chargement" />

		<ChargementPage v-if="chargementPage" />
	</div>
	<div id="page" v-else>
		<div id="conteneur" class="interaction-fermee banni">
			<div class="section">
				<div class="information">
					{{ $t('utilisateurBanni') }}
				</div>
				<div class="points">
					<span class="point" />
					<span class="point" />
					<span class="point" />
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import axios from 'axios'
import linkifyHtml from 'linkify-html'
import DOMPurify from 'dompurify'
import ChargementPage from '#root/components/chargement-page.vue'
import Chargement from '#root/components/chargement.vue'
import Message from '#root/components/message.vue'
import Rebours from '#root/components/rebours.vue'
import Notification from '#root/components/notification.vue'
import SondageParticiper from '#root/components/sondageParticiper.vue'
import QuestionnaireParticiper from '#root/components/questionnaireParticiper.vue'
import RemueMeningesParticiper from '#root/components/remueMeningesParticiper.vue'
import NuageMotsParticiper from '#root/components/nuageMotsParticiper.vue'

export default {
	name: 'DigistormParticiper',
	provide () {
		return {
			parent: this
		}
	},
	components: {
		ChargementPage,
		Chargement,
		Message,
		Rebours,
		Notification,
		SondageParticiper,
		QuestionnaireParticiper,
		RemueMeningesParticiper,
		NuageMotsParticiper
	},
	data () {
		return {
			chargementPage: true,
			chargement: false,
			message: '',
			notification: '',
			mobile: false,
			modale: '',
			validation: '',
			reponseEnvoyee: [],
			indexQuestion: -1,
			nombreReponsesEnvoyees: 0,
			date: 0,
			classement: [],
			etoilesScore: false,
			image: '',
			alt: '',
			media: {},
			tempsEcoule: false,
			verrouVeilleAPI: false,
			verrouVeille: '',
			rechargementDonnees: false,
			elementPrecedent: null,
			hote: this.$pageContext.pageProps.hote,
			langues: this.$pageContext.pageProps.langues,
			identifiant: this.$pageContext.pageProps.identifiant,
			nom: this.$pageContext.pageProps.nom,
			langue: this.$pageContext.pageProps.langue,
			code: this.$pageContext.pageProps.code,
			type: this.$pageContext.pageProps.type,
			titre: this.$pageContext.pageProps.titre,
			donnees: this.$pageContext.pageProps.donnees,
			reponsesSession: this.$pageContext.pageProps.reponsesSession,
			donneesSession: this.$pageContext.pageProps.donneesSession,
			utilisateurBanni: this.$pageContext.pageProps.banni,
			scoreTotal: this.$pageContext.pageProps.scoreTotal,
			statut: this.$pageContext.pageProps.statut,
			session: this.$pageContext.pageProps.session,
			stockage: import.meta.env.VITE_STORAGE,
			lienPublicS3: import.meta.env.VITE_S3_PUBLIC_LINK
		}
	},
	computed: {
		disabled () {
			return this.modale === '' && this.message === '' ? false : true
		},
		disabledModale () {
			return this.message === '' ? false : true
		},
		pointsTotal () {
			let points = 0
			this.donnees.questions.forEach((question) => {
				if (question.hasOwnProperty('points')) {
					points = points + question.points
				} else {
					points = points + 1000
				}
			})
			return points
		}
	},
	watch: {
		reponsesSession (reponses) {
			if (reponses.length === 0) {
				this.nombreReponsesEnvoyees = 0
			} else if (this.type === 'Questionnaire' || this.type === 'Sondage') {
				let nombreReponsesEnvoyees = 0
				const nombreQuestions = this.donnees.questions.length
				reponses.forEach((item) => {
					if (item.identifiant === this.identifiant) {
						item.reponse.forEach((reponse) => {
							if (reponse.length > 0) {
								nombreReponsesEnvoyees++
							}
						})
					}
				})
				this.nombreReponsesEnvoyees = nombreReponsesEnvoyees
				this.etoilesScore = false
				if (this.type === 'Questionnaire' && nombreReponsesEnvoyees === nombreQuestions && this.donnees.options.classement === false && !this.rechargementDonnees) {
					this.etoilesScore = true
					this.modale = 'score'
					this.$nextTick(() => {
						document.querySelector('.modale .fermer')?.focus()
					})
				} else if (this.type === 'Sondage' && nombreReponsesEnvoyees === nombreQuestions) {
					this.modale = 'message-fin'
					this.$nextTick(() => {
						document.querySelector('.modale .fermer')?.focus()
					})
				}
			} else if (this.type === 'Remue-méninges' || this.type === 'Nuage-de-mots') {
				let nombreReponsesEnvoyees = 0
				reponses.forEach((item) => {
					if (item.identifiant === this.identifiant) {
						nombreReponsesEnvoyees++
					}
				})
				this.nombreReponsesEnvoyees = nombreReponsesEnvoyees
			}
		},
		classement (classement) {
			if (classement.length === 0 && this.modale === 'classement') {
				this.fermerModale()
			} else if (classement.length > 0) {
				this.modale = 'classement'
				this.$nextTick(() => {
					document.querySelector('.modale .fermer')?.focus()
				})
			}
		}
	},
	created () {
		const params = this.$pageContext.pageProps.params
		const langueNav = navigator.language.substring(0, 2)
		const langueParam = params.lang
		if (langueParam && langueParam !== '' && this.langues.includes(langueParam) === true) {
			this.langue = langueParam
			localStorage.setItem('digistorm_lang', langueParam)
		} else if (!langueParam && langueNav !== '' && this.langues.includes(langueNav) === true) {
			this.langue = langueNav
		} 
		if (localStorage.getItem('digistorm_lang')) {
			this.langue = localStorage.getItem('digistorm_lang')
		}
		this.$i18n.locale = this.langue
		if (this.langue !== this.$pageContext.pageProps.langue) {
			this.$socket.emit('modifierlangue', this.langue)
		}

		this.ecouterSocket()

		this.$socket.emit('connexion', { code: this.code, identifiant: this.identifiant, nom: this.nom, nomAleatoire: this.$pageContext.pageProps.nomAleatoire })

		let nombreReponsesEnvoyees = 0
		if ((this.type === 'Sondage' || this.type === 'Questionnaire') && Object.keys(this.donnees).length > 0) {
			this.indexQuestion = parseInt(this.donnees.indexQuestion)
			const reponseEnvoyee = []
			this.donnees.questions.forEach(() => {
				reponseEnvoyee.push('')
			})
			this.reponsesSession.forEach((item) => {
				if (item.identifiant === this.identifiant) {
					item.reponse.forEach((reponse, index) => {
						if (reponse.length > 0) {
							reponseEnvoyee.splice(index, 1, 'reponse-envoyee')
							nombreReponsesEnvoyees++
						}
					})
				}
			})
			this.reponseEnvoyee = reponseEnvoyee
			if (this.donnees.hasOwnProperty('options') && this.donnees.options.nom === 'obligatoire' && nombreReponsesEnvoyees === 0) {
				this.afficherModaleNom()
			}
			if (this.type === 'Questionnaire' && !this.donnees.options.hasOwnProperty('retroaction')) {
				this.donnees.options.retroaction = false
			}
			if (!this.donnees.hasOwnProperty('messageFin')) {
				this.donnees.messageFin = this.$t('messageFin' + this.type)
			}
		} else if ((this.type === 'Remue-méninges' || this.type === 'Nuage-de-mots') && Object.keys(this.donnees).length > 0) {
			this.reponsesSession.forEach((item) => {
				if (item.identifiant === this.identifiant) {
					nombreReponsesEnvoyees++
				}
			})
			if (this.donnees.hasOwnProperty('options') && this.donnees.options.nom === 'obligatoire' && nombreReponsesEnvoyees === 0) {
				this.afficherModaleNom()
			}
		} else if (Object.keys(this.donnees).length === 0 && this.$pageContext.pageProps.nomObligatoire === true) {
			this.afficherModaleNom()
		} else if (this.statut !== 'attente' && this.statut !== 'verrouille' && this.statut !== 'nuage-affiche') {
			this.statut = 'ferme'
		}
		this.nombreReponsesEnvoyees = nombreReponsesEnvoyees
	},
	async mounted () {
		document.getElementsByTagName('html')[0].setAttribute('lang', this.langue)

		if (this.type === 'Questionnaire' && this.statut === 'ouvert' && this.donnees.options.progression === 'animateur' && ((this.donnees.options.hasOwnProperty('points') && (this.donnees.options.points === 'vitesse')) || (this.donnees.options.hasOwnProperty('tempsReponse') && this.donnees.options.tempsReponse === true)) && localStorage.getItem('date')) {
			this.date = parseInt(localStorage.getItem('date'))
		}

		if ('wakeLock' in navigator) {
			this.verrouVeilleAPI = true
		}

		this.chargementPage = false
		this.$nextTick(() => {
			window.typesetMathJax()
		})

		this.mobile = (window.navigator.maxTouchPoints || 'ontouchstart' in document)

		document.addEventListener('keydown', this.gererClavier, false)
		document.body.addEventListener('touchstart', this.demanderVerrouVeille, false)
		document.body.addEventListener('click', this.demanderVerrouVeille, false)
		window.addEventListener('beforeunload', this.quitterPage, false)
		document.addEventListener('visibilitychange', this.gererVisibilite, false)
	},
	beforeUnmount () {
		document.removeEventListener('keydown', this.gererClavier, false)
		document.body.removeEventListener('touchstart', this.demanderVerrouVeille, false)
		document.body.removeEventListener('click', this.demanderVerrouVeille, false)
		window.removeEventListener('beforeunload', this.quitterPage, false)
		document.removeEventListener('visibilitychange', this.gererVisibilite, false)
	},
	methods: {
		definirCheminFichier (fichier) {
			if (this.stockage === 's3' && this.lienPublicS3 && this.lienPublicS3 !== '') {
				return this.lienPublicS3 + '/' + this.code + '/' + fichier
			} else {
				return '/fichiers/' + this.code + '/' + fichier
			}
		},
		modifierLangue (langue) {
			if (this.langue !== langue) {
				this.chargement = true
				axios.post(this.hote + '/api/modifier-langue', {
					langue: langue
				}).then(() => {
					this.chargement = false
					this.$i18n.locale = langue
					document.getElementsByTagName('html')[0].setAttribute('lang', langue)
					this.langue = langue
					this.notification = this.$t('langueModifiee')
					localStorage.setItem('digistorm_lang', langue)
				}).catch((err) => {
					this.chargement = false
					if (err.response?.data === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		afficherModaleParametres () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'parametres'
			this.$nextTick(() => {
				if (document.querySelector('#modale-parametres input[disabled]')) {
					document.querySelector('#modale-parametres .fermer')?.focus()
				} else if (document.querySelector('#modale-parametres input')) {
					document.querySelector('#modale-parametres input').focus()
				} else {
					document.querySelector('#modale-parametres .fermer')?.focus()
				}
			})
		},
		fermerModale () {
			this.modale = ''
			this.gererFocus()
		},
		afficherImage (event, image, alt) {
			event.preventDefault()
			event.stopPropagation()
			this.image = image
			this.alt = alt
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'image'
			this.$nextTick(() => {
				document.querySelector('#modale-image .bouton')?.focus()
			})
		},
		fermerModaleImage () {
			this.modale = ''
			this.image = ''
			this.alt = ''
			this.gererFocus()
		},
		afficherSupport () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'support'
			this.$nextTick(() => {
				document.querySelector('.modale .bouton')?.focus()
			})
		},
		afficherMedia (event, media, alt, type) {
			event.preventDefault()
			event.stopPropagation()
			if (type === 'video') {
				this.media = { lien: media, type: type }
			} else if (type === 'image') {
				this.media = { fichier: media, type: type, alt: alt }
			} else {
				this.media = { fichier: media, type: type }
			}
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'media'
			this.$nextTick(() => {
				document.querySelector('.modale .bouton')?.focus()
			})
		},
		fermerModaleMedia () {
			this.modale = ''
			this.media = {}
			this.gererFocus()
		},
		afficherModaleNom () {
			if (!this.utilisateurBanni) {
				this.modale = 'nom'
				this.$nextTick(() => {
					document.querySelector('#modale-nom input')?.focus()
				})
			}
		},
		modifierNom () {
			let nom = ''
			if (this.modale === 'nom') {
				nom = document.querySelector('#modale-nom input').value
			} else if (this.modale === 'parametres') {
				nom = document.querySelector('#modale-parametres input').value
			}
			if (this.$pageContext.pageProps.nomObligatoire === true && nom === '') {
				return
			}
			if (this.modale !== 'nom' && this.nom !== '' && this.nom === nom) {
				this.fermerModale()
				return
			}
			if (this.modale === 'nom') {
				this.fermerModale()
			}
			this.chargement = true
			axios.post(this.hote + '/api/modifier-nom', {
				nom: nom
			}).then(() => {
				this.chargement = false
				this.nom = nom
				this.notification = this.$t('nomModifie')
				this.$socket.emit('modifiernom', { code: this.code, session: this.session, identifiant: this.identifiant, nom: nom })
				this.$socket.emit('connexion', { code: this.code, identifiant: this.identifiant, nom: nom, nomAleatoire: false })
			}).catch(() => {
				this.chargement = false
				this.message = this.$t('erreurCommunicationServeur')
			})
		},
		genererNom () {
			this.chargement = true
			axios.post(this.hote + '/api/generer-nom').then((reponse) => {
				const nom = reponse.data
				this.chargement = false
				if (nom !== '') {
					this.nom = nom
					this.notification = this.$t('nomModifie')
					this.$socket.emit('modifiernom', { code: this.code, session: this.session, identifiant: this.identifiant, nom: nom })
					this.$socket.emit('connexion', { code: this.code, identifiant: this.identifiant, nom: nom, nomAleatoire: false })
				}
			}).catch(() => {
				this.chargement = false
				this.message = this.$t('erreurCommunicationServeur')
			})
		},
		afficherModaleScore () {
			this.elementPrecedent = (document.activeElement || document.body)
			let nombreReponses = 0
			const nombreQuestions = this.donnees.questions.length
			this.reponsesSession.forEach((item) => {
				if (item.identifiant === this.identifiant) {
					item.reponse.forEach((reponse) => {
						if (reponse.length > 0) {
							nombreReponses++
						}
					})
				}
			})
			if (nombreReponses === nombreQuestions) {
				this.etoilesScore = true
			}
			this.modale = 'score'
			this.$nextTick(() => {
				document.querySelector('.modale .fermer')?.focus()
			})
		},
		modifierIndexQuestion (direction) {
			if (direction === 'precedente' && ((this.donnees.description === '' && Object.keys(this.donnees.support).length === 0 && this.indexQuestion > 0) || ((this.donnees.description !== '' || Object.keys(this.donnees.support).length > 0) && this.indexQuestion > -1))) {
				this.indexQuestion--
			} else if (direction === 'suivante' && this.indexQuestion < this.donnees.questions.length - 1) {
				this.indexQuestion++
			}
		},
		valider () {
			this.validation = 'validation'
		},
		envoyerReponse (donnees) {
			if (donnees.reponse.length > 0) {
				this.chargement = true
				const indexQuestion = donnees.indexQuestion
				delete donnees.indexQuestion
				this.$socket.emit('reponse', { code: this.code, session: this.session, donnees: donnees, indexQuestion: indexQuestion })
			} else {
				this.validation = ''
			}
		},
		rechargerDonnees (notification) {
			this.chargement = true
			axios.post(this.hote + '/api/recuperer-donnees-interaction-utilisateur', {
				code: this.code,
				identifiant: this.identifiant
			}).then((reponse) => {
				this.chargement = false
				this.rechargementDonnees = true
				this.modale = ''
				this.type = reponse.data.type
				this.titre = reponse.data.titre
				this.statut = reponse.data.statut
				this.session = reponse.data.session
				this.donnees = reponse.data.donnees
				this.reponsesSession = reponse.data.reponsesSession
				this.donneesSession = reponse.data.donneesSession
				this.scoreTotal = reponse.data.scoreTotal
				const nomObligatoire = reponse.data.nomObligatoire
				if ((this.type === 'Sondage' || this.type === 'Questionnaire') && Object.keys(this.donnees).length > 0) {
					if (this.donnees.options.progression === 'animateur') {
						this.indexQuestion = parseInt(this.donnees.indexQuestion)
					}
					const reponseEnvoyee = []
					this.donnees.questions.forEach(() => {
						reponseEnvoyee.push('')
					})
					this.reponsesSession.forEach((item) => {
						if (item.identifiant === this.identifiant) {
							item.reponse.forEach((reponse, index) => {
								if (reponse.length > 0) {
									reponseEnvoyee.splice(index, 1, 'reponse-envoyee')
								}
							})
						}
					})
					this.reponseEnvoyee = reponseEnvoyee
					if (this.donnees.hasOwnProperty('options') && this.donnees.options.nom === 'obligatoire' && this.nom === '') {
						this.afficherModaleNom()
					}
					if (this.type === 'Questionnaire' && !this.donnees.options.hasOwnProperty('retroaction')) {
						this.donnees.options.retroaction = false
					}
					if (this.type === 'Questionnaire' && this.statut === 'ouvert' && this.donnees.options.progression === 'animateur' && ((this.donnees.options.hasOwnProperty('points') && (this.donnees.options.points === 'vitesse')) || (this.donnees.options.hasOwnProperty('tempsReponse') && this.donnees.options.tempsReponse === true)) && localStorage.getItem('date')) {
						this.date = parseInt(localStorage.getItem('date'))
					}
				} else if ((this.type === 'Remue-méninges' || this.type === 'Nuage-de-mots') && Object.keys(this.donnees).length > 0) {
					if (this.donnees.hasOwnProperty('options') && this.donnees.options.hasOwnProperty('nom') && this.donnees.options.nom === 'obligatoire' && this.nom === '') {
						this.afficherModaleNom()
					} else if (this.type === 'Nuage-de-mots' && this.statut === 'nuage-affiche') {
						this.$socket.emit('recupererdonneesnuage', { code: this.code, session: this.session })
					}
				} else if (Object.keys(this.donnees).length === 0 && nomObligatoire === true) {
					this.afficherModaleNom()
				}
				if (notification !== '') {
					this.notification = this.$t('donneesRechargees')
				}
				let nomAleatoire = this.$pageContext.pageProps.nomAleatoire
				if (this.nom !== '') {
					nomAleatoire = false
				}
				this.$nextTick(() => {
					this.rechargementDonnees = false
				})
				this.$socket.emit('connexion', { code: this.code, identifiant: this.identifiant, nom: this.nom, nomAleatoire: nomAleatoire })
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'interaction_inexistante') {
					window.location.replace('/')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		async demanderVerrouVeille () {
			if (this.verrouVeilleAPI && this.verrouVeille === '') {
				try {
					this.verrouVeille = await navigator.wakeLock.request('screen')
				} catch (err) {
					this.verrouVeille = ''
				}
			}
		},
		async gererVisibilite () {
			if (this.mobile && !this.chargement && document.visibilityState === 'visible' && this.identifiant !== '') {
				setTimeout(() => {
					this.rechargerDonnees('')
				}, 200)
			} else if (!this.mobile && !this.chargement && document.visibilityState === 'visible' && this.identifiant !== '') {
				this.rechargerDonnees('')
			}
			if (this.verrouVeilleAPI && this.verrouVeille !== '' && document.visibilityState === 'visible') {
				try {
					this.verrouVeille = await navigator.wakeLock.request('screen')
				} catch (err) {
					this.verrouVeille = ''
				}
			}
		},
		quitterPage () {
			this.$socket.emit('deconnexion', this.code)
		},
		fermerMessage () {
			this.message = ''
			this.gererFocus()
		},
		formaterHTML (html) {
			html = linkifyHtml(html, {
				defaultProtocol: 'https',
				truncate: 50,
				rel: 'noreferrer',
				target: '_blank'
			})
			html = DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] })
			return html
		},
		definirElementPrecedent (element) {
			this.elementPrecedent = element
		},
		gererClavier (event) {
			if (event.key === 'Escape' && this.message !== '') {
				this.fermerMessage()
			} else if (event.key === 'Escape' && this.modale === 'image') {
				this.fermerModaleImage()
			} else if (event.key === 'Escape' && this.modale === 'media') {
				this.fermerModaleMedia()
			} else if (event.key === 'Escape' && this.modale !== '') {
				if (this.modale === 'nom' && ((this.donnees.hasOwnProperty('options') && this.donnees.options.nom === 'obligatoire') || this.$pageContext.pageProps.nomObligatoire === true) && this.nom === '' && this.nombreReponsesEnvoyees === 0) {
					return
				} else {
					this.fermerModale()
				}
			} else if (event.key === 'ArrowLeft' && this.modale === '' && event.target.tagName !== 'TEXTAREA' && (this.type === 'Questionnaire' || this.type === 'Sondage')) {
				this.modifierIndexQuestion('precedente')
			} else if (event.key === 'ArrowRight' && this.modale === '' && event.target.tagName !== 'TEXTAREA' && (this.type === 'Questionnaire' || this.type === 'Sondage')) {
				this.modifierIndexQuestion('suivante')
			} else if (event.key === 'Tab') {
				if (this.message !== '') {
					const modale = document.querySelector('#message')
					this.piegerFocus(event, modale)
				} else if (this.modale !== '') {
					const modale = document.querySelector('.modale')
					this.piegerFocus(event, modale)
				}
			}
		},
		gererFocus () {
			this.$nextTick(() => {
				if (this.elementPrecedent) {
					this.elementPrecedent.focus()
					this.elementPrecedent = null
				}
			})
		},
		piegerFocus (event, conteneur) {
			if (!conteneur) return
			const isVisible = el => el.offsetWidth || el.offsetHeight || el.getClientRects().length
			const focusables = Array.from(conteneur.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled && el.tabIndex >= 0 && isVisible(el))
			if (focusables.length === 0) return
			const premier = focusables[0]
			const dernier = focusables[focusables.length - 1]
			if (event.shiftKey) {
				if (document.activeElement === premier) {
					event.preventDefault()
					dernier.focus()
				}
			} else {
				if (document.activeElement === dernier) {
					event.preventDefault()
					premier.focus()
				}
			}
		},
		ecouterSocket () {
			this.$socket.on('interactionouverte', (interaction) => {
				this.statut = 'ouvert'
				this.titre = interaction.titre
				this.donnees = interaction.donnees
				this.session = interaction.session
				this.validation = ''
				this.reponsesSession = []
				this.scoreTotal = 0
				if (interaction.nomAleatoire === true && this.nom === '') {
					this.genererNom()
					this.donnees.options.nom = 'aleatoire'
				}
				if (this.type === 'Sondage' || this.type === 'Questionnaire') {
					this.indexQuestion = this.donnees.copieIndexQuestion
					const reponseEnvoyee = []
					this.donnees.questions.forEach(() => {
						reponseEnvoyee.push('')
					})
					this.reponseEnvoyee = reponseEnvoyee
					if (this.type === 'Questionnaire' && this.donnees.options.progression === 'animateur' && ((this.donnees.options.hasOwnProperty('points') && (this.donnees.options.points === 'vitesse')) || (this.donnees.options.hasOwnProperty('tempsReponse') && this.donnees.options.tempsReponse === true))) {
						const date = new Date().getTime()
						this.date = date
						localStorage.setItem('date', date)
					}
					if (this.donnees.hasOwnProperty('options') && this.donnees.options.nom !== 'obligatoire' && this.modale === 'nom') {
						this.modale = ''
					} else if (this.donnees.hasOwnProperty('options') && this.donnees.options.nom === 'obligatoire' && this.donnees.options.progression === 'libre') {
						this.afficherModaleNom()
					}
				} else {
					if (this.donnees.hasOwnProperty('options') && this.donnees.options.nom !== 'obligatoire' && this.modale === 'nom') {
						this.modale = ''
					} else if (this.donnees.hasOwnProperty('options') && this.donnees.options.nom === 'obligatoire') {
						this.afficherModaleNom()
					}
				}
				this.$nextTick(() => {
					window.typesetMathJax()
				})
			})

			this.$socket.on('interactionenattente', (interaction) => {
				this.statut = 'attente'
				if (interaction.donnees.hasOwnProperty('options') && interaction.donnees.options.nom === 'obligatoire') {
					this.afficherModaleNom()
				} else {
					this.modale = ''
				}
				if (interaction.nomAleatoire === true && this.nom === '') {
					this.genererNom()
					this.donnees = { options: { nom: 'aleatoire' } }
				}
			})

			this.$socket.on('interactionverrouillee', () => {
				this.statut = 'verrouille'
			})

			this.$socket.on('interactiondeverrouillee', () => {
				this.statut = 'ouvert'
				this.$nextTick(() => {
					window.typesetMathJax()
				})
			})

			this.$socket.on('interactionfermee', () => {
				if (this.modale === 'nom' || this.modale === 'parametres' || this.modale === 'score' || this.modale === 'message-fin') {
					this.modale = ''
				}
				this.statut = 'termine'
				this.validation = ''
				this.donnees = {}
				this.reponsesSession = []
				this.reponseEnvoyee = []
				this.indexQuestion = -1
				this.nombreReponsesEnvoyees = 0
				this.date = 0
				this.tempsEcoule = false
				this.classement = []
				this.scoreTotal = 0
				this.nom = ''
				this.utilisateurBanni = false
				this.$socket.emit('modifiernom', { code: this.code, session: this.session, identifiant: this.identifiant, nom: '' })
				this.$pageContext.pageProps.nomAleatoire = false
				if (localStorage.getItem('date')) {
					localStorage.removeItem('date')
				}
			})

			this.$socket.on('questionsuivante', (donnees) => {
				const date = new Date().getTime()
				this.date = date
				localStorage.setItem('date', date)
				this.indexQuestion = donnees.index
				this.tempsEcoule = false
				this.classement = []
				this.$nextTick(() => {
					window.typesetMathJax()
				})
			})

			this.$socket.on('classement', (donnees) => {
				this.classement = donnees
			})

			this.$socket.on('reponseenvoyee', (res) => {
				if (this.type === 'Sondage' || this.type === 'Questionnaire') {
					this.chargement = false
					this.validation = ''
					res.donnees.reponse.forEach((reponse, index) => {
						if (reponse.length > 0) {
							this.reponseEnvoyee.splice(index, 1, 'reponse-envoyee')
						}
					})
					this.$nextTick(() => {
						if (res.hasOwnProperty('indexQuestion')) {
							document.querySelector('#actions' + res.indexQuestion + ' button')?.focus()
						}
					})
				}
			})

			this.$socket.on('reponses', (donnees) => {
				if (donnees.code === this.code && donnees.session === this.session) {
					this.reponsesSession = donnees.reponsesSession
					this.donneesSession = donnees.donneesSession
					this.scoreTotal = donnees.scoreTotal
				}
			})

			this.$socket.on('utilisateurbanni', (identifiant) => {
				if (this.identifiant === identifiant) {
					this.utilisateurBanni = true
				}
			})

			this.$socket.on('utilisateurautorise', (identifiant) => {
				if (this.identifiant === identifiant) {
					this.utilisateurBanni = false
					let nombreReponsesEnvoyees = 0
					if ((this.type === 'Sondage' || this.type === 'Questionnaire') && Object.keys(this.donnees).length > 0) {
						this.reponsesSession.forEach((item) => {
							if (item.identifiant === this.identifiant) {
								item.reponse.forEach((reponse) => {
									if (reponse.length > 0) {
										nombreReponsesEnvoyees++
									}
								})
							}
						})
						if (this.donnees.hasOwnProperty('options') && this.donnees.options.nom === 'obligatoire' && nombreReponsesEnvoyees === 0) {
							this.afficherModaleNom()
						}
					} else if ((this.type === 'Remue-méninges' || this.type === 'Nuage-de-mots') && Object.keys(this.donnees).length > 0) {
						this.reponsesSession.forEach((item) => {
							if (item.identifiant === this.identifiant) {
								nombreReponsesEnvoyees++
							}
						})
						if (this.donnees.hasOwnProperty('options') && this.donnees.options.nom === 'obligatoire' && nombreReponsesEnvoyees === 0) {
							this.afficherModaleNom()
						}
					} else if (Object.keys(this.donnees).length === 0 && this.$pageContext.pageProps.nomObligatoire === true) {
						this.afficherModaleNom()
					}
					this.$nextTick(() => {
						window.typesetMathJax()
					})
				}
			})

			this.$socket.on('erreur', () => {
				this.message = this.$t('erreurCommunicationServeur')
			})

			this.$socket.on('erreurcode', () => {
				this.message = this.$t('codeNonValide')
			})
		}
	}
}
</script>

<style scoped>
#titre {
	width: calc(100% - 132px)!important;
}

#titre span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

#parametres {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	font-size: 24px;
	margin-left: 20px;
	line-height: 1;
}

#parametres span,
#parametres button {
	line-height: 1;
	cursor: pointer;
}

#parametres span:first-child,
#parametres button:first-child {
	margin-right: 20px;
}

#conteneur {
	height: calc(100% - 40px)!important;
	margin-bottom: 0!important;
}

#conteneur.avec-footer {
	height: calc(100% - 100px)!important;
	margin-bottom: 60px!important;
}

#conteneur.interaction-fermee {
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
	align-items: center;
}

#conteneur.interaction-fermee .information {
	display: block;
	width: 100%;
	font-size: 25px;
	font-weight: 700;
	line-height: 1.4;
	margin-bottom: 40px;
	text-align: center;
}

#conteneur.interaction-fermee .points {
	display: flex;
	justify-content: center;
	width: 100%;
}

#conteneur.interaction-fermee .point {
	display: inline-block;
	width: 50px;
	height: 50px;
	border-radius: 50%;
	margin-right: 15px;
	background: #00ced1;
	animation: vague 1.5s linear infinite;
}

#conteneur.interaction-fermee .point:nth-child(2) {
	animation-delay: -1.1s;
}

#conteneur.interaction-fermee .point:nth-child(3) {
	animation-delay: -0.7s;
}

#interaction footer .section {
	justify-content: center;
}

#interaction footer .section.boutons {
	justify-content: space-between;
}

#interaction footer .bouton:not(.icone) {
	font-size: 18px;
	padding: 0 50px;
	background: #009688;
}

#interaction footer .bouton:not(.icone):hover {
	background: #00a695;
}

#interaction footer .bouton.icone {
	visibility: hidden;
	font-size: 48px;
	border: none;
	border-radius: 0;
	transition: none;
}

#interaction footer .bouton.icone.visible {
	visibility: visible;
}

#interaction footer .reponse {
	font-size: 2rem;
	font-weight: 700;
	color: #009688;
	line-height: 1;
}

#interaction footer .bouton + #rebours {
	margin-left: 15px;
}

#modale-parametres input {
	margin-bottom: 10px;
}

#modale-parametres span.bouton,
#modale-parametres button.bouton {
	width: 100%;
	text-align: center;
}

#modale-parametres .nom {
	display: flex;
	justify-content: center;
	align-items: center;
}

#modale-parametres .nom input {
	margin-bottom: 0;
}

#modale-parametres .nom span,
#modale-parametres .nom button {
	font-size: 24px;
	margin-left: 10px;
	cursor: pointer;
}

#modale-parametres .nom + .actions {
	margin-top: 20px;
}

#modale-parametres .langue:last-of-type {
	margin-bottom: 0;
}

#modale-parametres .langue + label {
	margin-top: 20px;
}

#modale-score,
#modale-message-fin {
	max-width: 520px;
}

#modale-score .etoiles {
	display: flex;
	justify-content: center;
	width: 100%;
}

#modale-score .etoiles span {
	font-size: 48px;
	color: #ffe900;
}

#modale-score span.total,
#modale-score span.sur,
#modale-score span.score {
	display: block;
	width: 100%;
	text-align: center;
}

#modale-score span.score {
	font-size: 5rem;
	font-weight: 700;
}

#modale-score span.total {
	font-size: 3rem;
}

#modale-media img,
#modale-image img {
	max-height: calc(90vh - 190px);
}

#modale-message-fin p {
	margin-bottom: 0;
}

@keyframes vague {
	0%, 60%, 100% {
		transform: initial;
	}
	30% {
		transform: translateY(-30px);
	}
}

@media screen and (max-width: 359px) {
	#modale-score .etoiles span {
		font-size: 24px;
	}
}

@media screen and (min-width: 360px) and (max-width: 599px) {
	#modale-score .etoiles span {
		font-size: 30px;
	}
}

@media screen and (orientation: landscape) and (max-height: 399px) {
	#modale-parametres {
		height: 90%;
	}
}
</style>

<style>
	#modale-score a,
	#modale-message-fin a {
		text-decoration: underline;
	}
</style>
