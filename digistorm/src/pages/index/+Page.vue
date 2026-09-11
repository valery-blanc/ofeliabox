<template>
	<div id="page">
		<div id="accueil" :style="{'background-image': 'url(./img/fond.png)'}">
			<div id="langues">
				<button type="button" class="bouton" :disabled="disabled" title="Français" aria-label="Français" :class="{'selectionne': langue === 'fr'}" @click="modifierLangue('fr')">FR</button>
				<button type="button" class="bouton" :disabled="disabled" title="Español" aria-label="Español" :class="{'selectionne': langue === 'es'}" @click="modifierLangue('es')">ES</button>
				<button type="button" class="bouton" :disabled="disabled" title="Italiano" aria-label="Italiano" :class="{'selectionne': langue === 'it'}" @click="modifierLangue('it')">IT</button>
				<button type="button" class="bouton" :disabled="disabled" title="Deutsch" aria-label="Deutsch" :class="{'selectionne': langue === 'de'}" @click="modifierLangue('de')">DE</button>
				<button type="button" class="bouton" :disabled="disabled" title="English" aria-label="English" :class="{'selectionne': langue === 'en'}" @click="modifierLangue('en')">EN</button>
			</div>
			<div id="conteneur">
				<div id="contenu">
					<h1>
						<span>Digistorm</span> <span>by La Digitale</span>
					</h1>
					<div>
						<p v-html="$t('slogan')" />
						<div id="actions">
							<button type="button" class="bouton" :disabled="disabled" @click="ouvrirModaleParticiper">{{ $t('participer') }}</button>
							<button type="button" class="bouton" :disabled="disabled" @click="ouvrirModaleCreer">{{ $t('creer') }}</button>
							<button type="button" class="bouton" :disabled="disabled" @click="ouvrirModaleSeConnecter">{{ $t('seConnecter') }}</button>
							<button type="button" class="bouton" :disabled="disabled" @click="ouvrirModaleSInscrire">{{ $t('sInscrire') }}</button>
						</div>
					</div>
				</div>
				<div id="credits">
					<p><a :href="mentionsLegales" target="_blank" rel="noreferrer" v-if="mentionsLegales !== ''">{{ $t('mentionsLegales') }}</a> - <a href="https://ladigitale.dev/contribuer.html" target="_blank" rel="noreferrer">{{ $t('soutien') }} ❤️.</a></p>
					<p>{{ new Date().getFullYear() }} - <a href="https://ladigitale.dev" target="_blank" rel="noreferrer">La Digitale</a> - <a href="https://codeberg.org/ladigitale/digistorm" target="_blank" rel="noreferrer">{{ $t('codeSource') }}</a> - <a href="https://codeberg.org/ladigitale/digistorm/releases" target="_blank" rel="noreferrer">v{{ version }}</a> - <button type="button" class="hub" :disabled="disabled" :title="$t('afficherHub')" :aria-label="$t('afficherHub')" @click="ouvrirHub"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#001d1d" width="36px" height="36px" aria-hidden="true"><path d="M0 0h24v24H0z" fill="none" /><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z" /></svg></button></p>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-if="modale === 'participer'">
			<div id="participer" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('participerInteraction') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleParticiper"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('participerInteraction')">
						<label for="champ-code-interaction">{{ $t('codeInteraction') }}</label>
						<input id="champ-code-interaction" type="text" v-model="code" :disabled="disabledModale" @keydown.enter="participer">
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="participer">{{ $t('valider') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'creer'">
			<div id="creer" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('creerInteraction') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleCreer"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('creerInteraction')">
						<label for="champ-titre-interaction">{{ $t('titre') }}</label>
						<input id="champ-titre-interaction" type="text" v-model="titre" :disabled="disabledModale" @keydown.enter="creer">
						<label for="champ-type-interaction">{{ $t('typeInteraction') }}</label>
						<select id="champ-type-interaction" :disabled="disabledModale" value="Sondage" @change="type = $event.target.value">
							<option value="Sondage">{{ $t('sondage') }}</option>
							<option value="Questionnaire">{{ $t('questionnaire') }}</option>
							<option value="Remue-méninges">{{ $t('remueMeninges') }}</option>
							<option value="Nuage-de-mots">{{ $t('nuageDeMots') }}</option>
						</select>
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="creer" v-if="!chargementModale">{{ $t('creer') }}</button>
							<div class="conteneur-chargement" v-else>
								<div class="chargement" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'se-connecter' || modale === 'mot-de-passe-oublie' || modale === 'se-connecter-interaction'">
			<div id="se-connecter" class="modale" role="dialog" v-if="modale === 'se-connecter'">
				<header>
					<span class="titre">{{ $t('seConnecter') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleSeConnecter"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('seConnecter')">
						<label for="champ-identifiant">{{ $t('identifiant') }}</label>
						<input id="champ-identifiant" type="text" maxlength="48" v-model="identifiant" :disabled="disabledModale" @keydown.enter="seConnecter">
						<label for="champ-motdepasse">{{ $t('motDePasse') }}</label>
						<div class="conteneur-motdepasse">
							<input id="champ-motdepasse" type="password" maxlength="48" v-model="motDePasse" :disabled="disabledModale" @keydown.enter="seConnecter" v-if="!motDePasseVisible">
							<input id="champ-motdepasse" type="text" maxlength="48" v-model="motDePasse" :disabled="disabledModale" @keydown.enter="seConnecter" v-else>
							<button type="button" class="icone" :disabled="disabledModale" :title="$t('cacherMotDePasse')" :aria-label="$t('cacherMotDePasse')" @click="modifierMotDePasseVisible(false)" v-if="motDePasseVisible"><i class="material-icons" aria-hidden="true">visibility_off</i></button>
							<button type="button" class="icone" :disabled="disabledModale" :title="$t('afficherMotDePasse')" :aria-label="$t('afficherMotDePasse')" @click="modifierMotDePasseVisible(true)" v-else><i class="material-icons" aria-hidden="true">visibility</i></button>
						</div>
						<button type="button" class="mot-de-passe-oublie" :disabled="disabledModale" @click="ouvrirModaleMotDePasseOublie" v-html="$t('motDePasseOublie')" />
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="seConnecter" v-if="!chargementModale">{{ $t('valider') }}</button>
							<div class="conteneur-chargement" v-else>
								<div class="chargement" />
							</div>
						</div>
						<button type="button" class="connexion" :disabled="disabledModale" @click="ouvrirModaleSeConnecterInteraction" v-if="!chargementModale">{{ $t('cliquezConnexionInteraction') }}</button>
					</div>
				</div>
			</div>

			<div class="modale" role="dialog" v-else-if="modale === 'mot-de-passe-oublie'">
				<header>
					<span class="titre">{{ $t('motDePasseOublie') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleMotDePasseOublie"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('motDePasseOublie')">
						<label for="champ-identifiant">{{ $t('identifiant') }}</label>
						<input id="champ-identifiant" type="text" maxlength="48" v-model="identifiant" :disabled="disabledModale">
						<label for="champ-email">{{ $t('email') }}</label>
						<input id="champ-email" type="email" v-model="email" @keydown.enter="envoyerMotDePasse" :disabled="disabledModale">
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="envoyerMotDePasse" v-if="!chargementModale">{{ $t('valider') }}</button>
							<div class="conteneur-chargement" v-else>
								<div class="chargement" />
							</div>
						</div>
					</div>
				</div>
			</div>

			<div id="se-connecter" class="modale" role="dialog" v-else-if="modale === 'se-connecter-interaction'">
				<header>
					<span class="titre">{{ $t('consulterInteraction') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleSeConnecterInteraction"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('consulterInteraction')">
						<label for="champ-code-interaction">{{ $t('codeInteraction') }}</label>
						<input id="champ-code-interaction" type="text" v-model="code" @keydown.enter="seConnecterInteraction" :disabled="disabledModale">
						<label for="champ-motdepasse">{{ $t('motDePasseAdministration') }}</label>
						<div class="conteneur-motdepasse">
							<input id="champ-motdepasse" type="password" maxlength="48" v-model="motDePasseInteraction" :disabled="disabledModale" @keydown.enter="seConnecterInteraction" v-if="!motDePasseVisible">
							<input id="champ-motdepasse" type="text" maxlength="48" v-model="motDePasseInteraction" :disabled="disabledModale" @keydown.enter="seConnecterInteraction" v-else>
							<button type="button" class="icone" :disabled="disabledModale" :title="$t('cacherMotDePasse')" :aria-label="$t('cacherMotDePasse')" @click="modifierMotDePasseVisible(false)" v-if="motDePasseVisible"><i class="material-icons" aria-hidden="true">visibility_off</i></button>
							<button type="button" class="icone" :disabled="disabledModale" :title="$t('afficherMotDePasse')" :aria-label="$t('afficherMotDePasse')" @click="modifierMotDePasseVisible(true)" v-else><i class="material-icons" aria-hidden="true">visibility</i></button>
						</div>
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="seConnecterInteraction" v-if="!chargementModale">{{ $t('valider') }}</button>
							<div class="conteneur-chargement" v-else>
								<div class="chargement" />
							</div>
						</div>
						<button type="button" class="connexion" :disabled="disabledModale" @click="ouvrirModaleSeConnecter">{{ $t('cliquezConnexionCompte') }}</button>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 's-inscrire'">
			<div id="s-inscrire" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('sInscrire') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleSInscrire"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('sInscrire')">
						<label for="champ-identifiant">{{ $t('identifiant') }}</label>
						<p class="information">{{ $t('infoIdentifiant') }}</p>
						<input id="champ-identifiant" type="text" maxlength="48" v-model="identifiant" :disabled="disabledModale">
						<label for="champ-email">{{ $t('email') }}</label>
						<input id="champ-email" type="email" v-model="email" :disabled="disabledModale">
						<label for="champ-motdepasse">{{ $t('motDePasse') }}</label>
						<p class="information">{{ $t('infoMotDePasse') }}</p>
						<input id="champ-motdepasse" type="password" maxlength="48" v-model="motDePasse" :disabled="disabledModale">
						<label for="champ-confirmation-motdepasse">{{ $t('confirmationMotDePasse') }}</label>
						<input id="champ-confirmation-motdepasse" type="password" maxlength="48" v-model="confirmationMotDePasse" :disabled="disabledModale" @keydown.enter="sInscrire">
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="sInscrire" v-if="!chargementModale">{{ $t('valider') }}</button>
							<div class="conteneur-chargement" v-else>
								<div class="chargement" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div id="hub" :class="{'ouvert': hub}" role="dialog" aria-modal="true" aria-label="Le Hub by La Digitale" :aria-hidden="!hub">
			<button type="button" :disabled="!hub" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerHub"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff" width="36px" height="36px" aria-hidden="true"><path d="M0 0h24v24H0z" fill="none"/><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
			<iframe src="https://ladigitale.dev/hub.html" title="Le Hub by La Digitale"></iframe>
		</div>

		<Notification :notification="notification" @fermer="notification = ''" />

		<Message :message="message" @elementPrecedent="definirElementPrecedent" @fermer="fermerMessage" v-if="message !== ''" />

		<Chargement v-if="chargement" />

		<ChargementPage v-if="chargementPage" />
	</div>
</template>

<script>
import axios from 'axios'
import ChargementPage from '#root/components/chargement-page.vue'
import Chargement from '#root/components/chargement.vue'
import Message from '#root/components/message.vue'
import Notification from '#root/components/notification.vue'

export default {
	name: 'DigistormAccueil',
	components: {
		ChargementPage,
		Chargement,
		Message,
		Notification
	},
	data () {
		return {
			chargementPage: true,
			chargement: false,
			message: '',
			notification: '',
			modale: '',
			titre: '',
			type: 'Sondage',
			code: '',
			motDePasseInteraction: '',
			identifiant: '',
			motDePasse: '',
			confirmationMotDePasse: '',
			motDePasseVisible: false,
			email: '',
			chargementModale: false,
			elementPrecedent: null,
			hub: false,
			hote: this.$pageContext.pageProps.hote,
			langues: this.$pageContext.pageProps.langues,
			langue: this.$pageContext.pageProps.langue,
			version: app_version,
			mentionsLegales: import.meta.env.VITE_LEGAL_TERMS_LINK || ''
		}
	},
	computed: {
		disabled () {
			return this.modale === '' && this.message === '' && !this.hub ? false : true
		},
		disabledModale () {
			return this.message === '' ? false : true
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
	},
	mounted () {
		document.getElementsByTagName('html')[0].setAttribute('lang', this.langue)
		this.chargementPage = false
		document.addEventListener('keydown', this.gererClavier, false)
		window.addEventListener('message', this.gererMessageHub, false)
	},
	beforeUnmount () {
		document.removeEventListener('keydown', this.gererClavier, false)
		window.removeEventListener('message', this.gererMessageHub, false)
	},
	methods: {
		modifierMotDePasseVisible (valeur) {
			this.motDePasseVisible = valeur
			this.$nextTick(() => {
				document.querySelector('.conteneur-motdepasse .icone')?.focus()
			})
		},
		ouvrirModaleCreer () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'creer'
			this.$nextTick(() => {
				document.querySelector('#creer input')?.focus()
			})
		},
		fermerModaleCreer () {
			this.modale = ''
			this.titre = ''
			this.type = 'Sondage'
			this.gererFocus()
		},
		creer () {
			if (this.titre.trim() !== '' && this.type !== '') {
				this.chargementModale = true
				axios.post(this.hote + '/api/creer-interaction-sans-compte', {
					titre: this.titre.trim(),
					type: this.type
				}).then((reponse) => {
					window.location.href = '/c/' + reponse.data
				}).catch((err) => {
					this.chargementModale = false
					this.fermerModaleCreer()
					if (err.response?.data === 'existe_deja') {
						this.message = this.$t('interactionExisteDeja')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			} else if (this.titre.trim() === '') {
				this.message = this.$t('completerChampTitre')
			} else if (this.type === '') {
				this.message = this.$t('selectionnerTypeInteraction')
			}
		},
		ouvrirModaleParticiper () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'participer'
			this.$nextTick(() => {
				document.querySelector('#participer input')?.focus()
			})
		},
		fermerModaleParticiper () {
			this.modale = ''
			this.code = ''
			this.gererFocus()
		},
		participer () {
			if (this.code !== '') {
				this.chargement = true
				axios.post(this.hote + '/api/rejoindre-interaction', {
					code: this.code
				}).then((reponse) => {
					window.location.href = '/p/' + reponse.data
				}).catch((err) => {
					this.chargement = false
					this.fermerModaleParticiper()
					if (err.response?.data === 'erreur_code') {
						this.message = this.$t('codeNonValide')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			} else {
				this.message = this.$t('indiquerCodeInteraction')
			}
		},
		ouvrirModaleSeConnecter () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.motDePasseInteraction = ''
			this.motDePasseVisible = false
			this.modale = 'se-connecter'
			this.$nextTick(() => {
				document.querySelector('#se-connecter input')?.focus()
			})
		},
		fermerModaleSeConnecter () {
			this.modale = ''
			this.identifiant = ''
			this.motDePasse = ''
			this.motDePasseVisible = false
			this.code = ''
			this.motDePasseInteraction = ''
			this.gererFocus()
		},
		seConnecter () {
			if (this.identifiant !== '' && this.motDePasse !== '') {
				this.chargementModale = true
				axios.post(this.hote + '/api/se-connecter', {
					identifiant: this.identifiant,
					motdepasse: this.motDePasse
				}).then((reponse) => {
					window.location.href = '/u/' + reponse.data
				}).catch((err) => {
					this.chargementModale = false
					if (err.response?.data === 'erreur_connexion') {
						this.message = this.$t('informationsConnexionIncorrectes')
					} else if (err.response?.status === 429) {
						this.message = this.$t('erreurTentativesNombreuses')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			} else {
				this.message = this.$t('remplirChamps')
			}
		},
		ouvrirModaleSInscrire () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 's-inscrire'
			this.$nextTick(() => {
				document.querySelector('#s-inscrire input')?.focus()
			})
		},
		sInscrire () {
			const identifiant = this.identifiant.trim()
			const motdepasse = this.motDePasse.trim()
			const email = this.email.trim()
			if (identifiant !== '' && this.verifierIdentifant(identifiant) === true && motdepasse !== '' && motdepasse === this.confirmationMotDePasse.trim() && email !== '' && this.$verifierEmail(email) === true) {
				this.chargementModale = true
				axios.post(this.hote + '/api/s-inscrire', {
					identifiant: identifiant,
					motdepasse: motdepasse,
					email: email
				}).then((reponse) => {
					if (reponse.data === 'activation_demandee') {
						this.chargementModale = false
						this.fermerModaleSInscrire()
						setTimeout(() => {
							this.message = this.$t('activationEnvoyee')
						}, 100)
					} else {
						window.location.href = '/u/' + identifiant
					}
				}).catch((err) => {
					this.chargementModale = false
					if (err.response?.data === 'utilisateur_existe_deja') {
						this.message = this.$t('identifiantExisteDeja', { identifiant: identifiant })
					} else if (err.response?.data === 'email_existe_deja') {
						this.message = this.$t('emailExisteDeja', { email: email })
					} else if (err.response?.data === 'identifiant_invalide') {
						this.message = this.$t('identifiantNonConforme')
					} else if (err.response?.data === 'erreur_email') {
						this.message = this.$t('erreurEnvoiEmail')
					} else if (err.response?.status === 429) {
						this.message = this.$t('erreurTentativesNombreuses')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			} else if (identifiant === '' || motdepasse === '' || this.confirmationMotDePasse.trim() === '' || email === '') {
				this.message = this.$t('remplirChamps')
			} else if (this.verifierIdentifant(identifiant) === false) {
				this.message = this.$t('identifiantNonConforme')
			} else if (motdepasse !== this.confirmationMotDePasse.trim()) {
				this.message = this.$t('motsDePassePasIdentiques')
			} else if (this.$verifierEmail(email) === false) {
				this.message = this.$t('erreurEmail')
			}
		},
		fermerModaleSInscrire () {
			this.modale = ''
			this.identifiant = ''
			this.email = ''
			this.motDePasse = ''
			this.confirmationMotDePasse = ''
			this.gererFocus()
		},
		verifierIdentifant (identifiant) {
			let conforme = false
			if (identifiant.match(/^[\w-]+$/)) {
				conforme = true
			}
			if (identifiant.length < 3) {
				conforme = false
			}
			return conforme
		},
		ouvrirModaleSeConnecterInteraction () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.motDePasse = ''
			this.motDePasseVisible = false
			this.modale = 'se-connecter-interaction'
			this.$nextTick(() => {
				document.querySelector('#se-connecter input')?.focus()
			})
		},
		fermerModaleSeConnecterInteraction () {
			this.modale = ''
			this.code = ''
			this.motDePasseInteraction = ''
			this.identifiant = ''
			this.motDePasse = ''
			this.motDePasseVisible = false
			this.gererFocus()
		},
		seConnecterInteraction () {
			if (this.code !== '' && this.motDePasseInteraction !== '') {
				this.chargementModale = true
				axios.post(this.hote + '/api/se-connecter-interaction', {
					code: this.code,
					motdepasse: this.motDePasseInteraction
				}).then((reponse) => {
					window.location.href = '/c/' + reponse.data.code
				}).catch((err) => {
					this.chargementModale = false
					this.fermerModaleSeConnecter()
					if (err.response?.data === 'erreur_code') {
						this.message = this.$t('codeNonValide')
					} else if (err.response?.data === 'non_autorise') {
						this.message = this.$t('pasAutoriseModifierInteraction')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			} else if (this.code === '') {
				this.message = this.$t('indiquerCodeInteraction')
			} else if (this.motDePasseInteraction === '') {
				this.message = this.$t('indiquerMotDePasse')
			}
		},
		ouvrirModaleMotDePasseOublie () {
			this.motDePasse = ''
			this.motDePasseVisible = false
			this.code = ''
			this.motDePasseInteraction = ''
			this.modale = 'mot-de-passe-oublie'
			this.$nextTick(() => {
				document.querySelector('.modale input')?.focus()
			})
		},
		envoyerMotDePasse () {
			if (this.identifiant.trim() !== '' && this.email.trim() !== '' && this.$verifierEmail(this.email.trim()) === true) {
				this.chargementModale = true
				axios.post(this.hote + '/api/mot-de-passe-oublie', {
					identifiant: this.identifiant.trim(),
					email: this.email.trim()
				}).then((reponse) => {
					this.chargementModale = false
					this.fermerModaleMotDePasseOublie()
					this.notification = this.$t('emailEnvoye')
				}).catch((err) => {
					this.chargementModale = false
					if (err.response?.data === 'identifiant_invalide') {
						this.message = this.$t('identifiantNonValide')
					} else if (err.response?.data === 'email_invalide') {
						this.message = this.$t('emailNonValide')
					} else if (err.response?.data === 'erreur_email') {
						this.message = this.$t('erreurEnvoiEmail')
					} else if (err.response?.status === 429) {
						this.fermerModaleMotDePasseOublie()
						this.message = this.$t('erreurTentativesNombreuses')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			} else if (this.identifiant.trim() === '' || this.email.trim() === '') {
				this.message = this.$t('remplirChamps')
			} else if (this.$verifierEmail(this.email.trim()) === false) {
				this.message = this.$t('erreurEmail')
			}
		},
		fermerModaleMotDePasseOublie () {
			this.modale = ''
			this.identifiant = ''
			this.email = ''
			this.gererFocus()
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
		fermerMessage () {
			this.message = ''
			this.gererFocus()
		},
		definirElementPrecedent (element) {
			this.elementPrecedent = element
		},
		ouvrirHub () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.hub = true
			this.$nextTick(() => {
				document.querySelector('#hub button')?.focus()
			})
		},
		gererMessageHub (event) {
			if (event.origin !== 'https://ladigitale.dev') return
			if (typeof event.data !== 'object' || event.data === null) return
			if (event.data.message === 'fermer-hub') {
				this.fermerHub()
			}
		},
		fermerHub () {
			this.hub = false
			this.gererFocus()
		},
		gererClavier (event) {
			if (event.key === 'Escape' && this.message !== '') {
				this.message = ''
			} else if (event.key === 'Escape' && this.modale === 'participer') {
				this.fermerModaleParticiper()
			} else if (event.key === 'Escape' && this.modale === 'creer') {
				this.fermerModaleCreer()
			} else if (event.key === 'Escape' && this.modale === 'se-connecter') {
				this.fermerModaleSeConnecter()
			} else if (event.key === 'Escape' && this.modale === 'mot-de-passe-oublie') {
				this.fermerModaleMotDePasseOublie()
			} else if (event.key === 'Escape' && this.modale === 'se-connecter-interaction') {
				this.fermerModaleSeConnecterInteraction()
			} else if (event.key === 'Escape' && this.modale === 's-inscrire') {
				this.fermerModaleSInscrire()
			} else if (event.key === 'Escape' && this.hub) {
				this.hub = false
				this.gererFocus()
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
		}
	}
}
</script>

<style scoped>
#page,
#accueil {
	width: 100%;
	height: 100%;
}

#accueil {
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
}

#langues {
	position: fixed;
	display: flex;
	top: 1rem;
	right: 0.5rem;
	z-index: 10;
}

#langues span,
#langues button {
    display: flex;
    justify-content: center;
	align-items: center;
	font-size: 1.4rem;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    border: 1px solid #ddd;
	background: #fff;
    margin-right: 1rem;
	cursor: pointer;
}

#langues span.selectionne,
#langues button.selectionne {
    background: #242f3d;
    color: #fff;
    border: 1px solid #222;
    cursor: default;
}

#conteneur {
	position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
	flex-wrap: wrap;
	overflow: auto;
}

#contenu {
	max-width: 76em;
	text-align: center;
	padding: 12em 1em 6em;
	margin: auto;
}

#conteneur h1 {
    font-family: 'Mona Sans Expanded', sans-serif;
    font-size: 3em;
    margin-bottom: 0.85em;
    line-height: 1.4;
}

#conteneur p {
    font-size: 1.25em;
    line-height: 1.4;
    margin-bottom: 1.5em;
}

#actions {
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
}

#actions .bouton {
	display: inline-block;
	width: 180px;
    line-height: 1;
    font-size: 1em;
    font-weight: 700;
    text-transform: uppercase;
	padding: 1em 1.5em;
	margin-right: 1em;
    border: 2px solid #00ced1;
	border-radius: 2em;
    background: #46fbff;
    cursor: pointer;
    transition: all ease-in 0.1s;
}

#actions .bouton:hover {
	text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);
	background: #fff;
}

#actions .bouton:last-child {
	margin-right: 0;
}

#credits {
	width: 100%;
	margin: 0 auto 0.75em;
}

#credits p {
    font-size: 1em;
    line-height: 1.2;
    margin-bottom: 1em;
	text-align: center;
}

#credits p:last-child {
	display: flex;
	justify-content: center;
	align-items: center;
}

#credits p:last-child a {
	margin: 0 5px;
}

#credits .hub {
	font-size: 0;
	cursor: pointer;
}

#hub {
	position: fixed;
	visibility: hidden;
	opacity: 0;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
	z-index: -1;
}

#hub.ouvert {
	visibility: visible;
	opacity: 1;
    animation: fonduEntrant linear 0.1s;
	z-index: 100000;
}

#hub iframe {
	width: 100%;
    height: 100%;
}

#hub span,
#hub button {
	font-size: 0;
	color: #fff;
	position: absolute;
	top: 15px;
	right: 15px;
	cursor: pointer;
}

.modale button.connexion {
	display: block;
	width: 100%;
	font-size: 14px;
	text-decoration: underline;
	text-align: center;
	margin-top: 20px;
	margin-bottom: 0;
	background: none;
	border: none;
	padding: 0;
	cursor: pointer;
}

#se-connecter .conteneur-motdepasse {
	margin-bottom: 10px;
}

.modale .contenu .mot-de-passe-oublie {
	font-size: 12px;
    margin-bottom: 20px;
	background: none;
	border: none;
	padding: 0;
	cursor: pointer;
}

@media screen and (orientation: landscape) and (max-height: 359px) {
	#creer {
		height: 90%;
	}
}

@media screen and (orientation: landscape) and (max-height: 399px) {
	#se-connecter {
		height: 90%;
	}
}

@media screen and (orientation: landscape) and (max-height: 479px) {
	#s-inscrire {
		height: 90%;
	}
}

@media screen and (max-width: 359px) {
	#contenu {
		padding: 4em 1em 2em;
	}

	#actions .bouton {
		font-size: 0.75em!important;
		width: 130px;
		padding: 1em 0.5em;
	}
}

@media screen and (min-width: 360px) and (max-width: 599px) {
	#contenu {
		padding: 5em 1em 2.5em;
	}

	#actions .bouton {
		width: 145px;
	}
}

@media screen and (max-width: 399px) {
	#conteneur h1 span {
		display: block;
	}
}

@media screen and (max-width: 599px) {
	#conteneur h1 {
		font-size: 2em;
		margin-bottom: 1em;
	}

	#conteneur p {
		font-size: 1em;
		margin-bottom: 1.2em;
	}

	#actions .bouton {
		font-size: 0.85em;
	}

	#credits p {
		font-size: 0.85em;
	}

	#hub span,
	#hub button {
		top: 5px;
		right: 5px;
	}

	#hub span svg,
	#hub button svg {
		width: 24px;
		height: 24px;
	}
}

@media screen and (max-width: 599px) and (orientation: landscape) {
	#contenu {
		padding: 2em 1em 1.5em!important;
	}
}

@media screen and (min-width: 600px) and (max-width: 820px) and (orientation: landscape) {
	#contenu {
		padding: 3em 1em 1.5em!important;
	}
}

@media screen and (max-width: 820px) and (orientation: landscape) {
	#conteneur p {
		font-size: 1em!important;
	}

	#credits p {
		font-size: 0.85em!important;
		margin-bottom: 0.85em!important;
	}
}

@media screen and (max-width: 1023px) {
	#actions .bouton {
		width: 45%;
		margin-bottom: 1em;
	}

	#actions .bouton:nth-child(2n) {
		margin-right: 0;
	}
}

@media screen and (max-width: 1023px) and (orientation: landscape) {
	#contenu {
		padding: 7em 1em 3.5em;
	}
}

@media screen and (max-width: 850px) and (max-height: 500px) {
	#conteneur h1 {
		font-size: 2em;
		margin-bottom: 1em;
	}

	#conteneur p {
		font-size: 1em;
		margin-bottom: 1.2em;
	}

	#credits p {
		font-size: 0.85em;
	}

	#actions .bouton {
		font-size: 0.85em!important;
	}
}
</style>
