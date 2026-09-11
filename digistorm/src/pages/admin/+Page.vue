<template>
	<main id="page" v-if="acces">
		<div id="accueil">
			<div id="langues">
				<button type="button" class="bouton" :disabled="disabled" title="Français" aria-label="Français" :class="{'selectionne': langue === 'fr'}" @click="modifierLangue('fr')">FR</button>
				<button type="button" class="bouton" :disabled="disabled" title="Español" aria-label="Español" :class="{'selectionne': langue === 'es'}" @click="modifierLangue('es')">ES</button>
				<button type="button" class="bouton" :disabled="disabled" title="Italiano" aria-label="Italiano" :class="{'selectionne': langue === 'it'}" @click="modifierLangue('it')">IT</button>
				<button type="button" class="bouton" :disabled="disabled" title="Deutsch" aria-label="Deutsch" :class="{'selectionne': langue === 'de'}" @click="modifierLangue('de')">DE</button>
				<button type="button" class="bouton" :disabled="disabled" title="English" aria-label="English" :class="{'selectionne': langue === 'en'}" @click="modifierLangue('en')">EN</button>
			</div>
			<div id="conteneur">
				<h1>
					<span>{{ $t('modifierMotDePasseUtilisateur') }}</span>
				</h1>
				<div class="conteneur">
					<label for="identifiant">{{ $t('identifiant') }}</label>
					<input id="identifiant" type="text" v-model="identifiant" :disabled="disabled">
				</div>
				<div class="conteneur">
					<label for="email">{{ $t('email') }}</label>
					<input id="email" type="text" v-model="email" :disabled="disabled">
				</div>
				<div class="conteneur">
					<label for="mot-de-passe">{{ $t('motDePasse') }}</label>
					<input id="mot-de-passe" type="text" maxlength="48" v-model="motdepasse" :disabled="disabled">
				</div>
				<div class="actions">
					<button type="button" class="bouton" :disabled="disabled" @click="modifierMotDePasse">{{ $t('valider') }}</button>
				</div>
				<h1>
					<span>{{ $t('recupererDonneesInteraction') }}</span>
				</h1>
				<div class="conteneur">
					<label for="code-interaction">{{ $t('codeInteraction') }}</label>
					<input id="code-interaction" type="number" v-model="code" :disabled="disabled">
				</div>
				<div class="conteneur" v-if="donneesInteraction !== ''">
					<span class="donnees">{{ donneesInteraction }}</span>
				</div>
				<div class="actions">
					<button type="button" class="bouton" :disabled="disabled" @click="recupererDonneesInteraction">{{ $t('valider') }}</button>
				</div>
				<h1>
					<span>{{ $t('modifierDonneesInteraction') }}</span>
				</h1>
				<div class="conteneur">
					<label for="code-interaction-m">{{ $t('codeInteraction') }}</label>
					<input id="code-interaction-m" type="number" v-model="codeM" :disabled="disabled">
				</div>
				<div class="conteneur">
					<label for="champ">{{ $t('champ') }}</label>
					<select id="champ" :disabled="disabled" @change="champ = $event.target.value">
						<option value="" :selected="champ === ''">-</option>
						<option value="motdepasse" :selected="champ === 'motdepasse'">{{ $t('motDePasse') }}</option>
						<option value="titre" :selected="champ === 'titre'">{{ $t('titre') }}</option>
					</select>
				</div>
				<div class="conteneur">
					<label for="valeur">{{ $t('valeur') }}</label>
					<input id="valeur" type="text" v-model="valeur" :disabled="disabled" :maxlength="4" v-if="champ === 'motdepasse'">
					<input id="valeur" type="text" v-model="valeur" :disabled="disabled" v-else>
				</div>
				<div class="actions">
					<button type="button" class="bouton" :disabled="disabled" @click="modifierDonneesInteraction">{{ $t('valider') }}</button>
				</div>
				<h1>
					<span>{{ $t('exporterInteraction') }}</span>
				</h1>
				<div class="conteneur">
					<label for="code-interaction-e">{{ $t('codeInteraction') }}</label>
					<input id="code-interaction-e" type="number" v-model="codeE" :disabled="disabled">
				</div>
				<div class="actions">
					<button type="button" class="bouton" :disabled="disabled" @click="exporterInteraction">{{ $t('valider') }}</button>
				</div>
				<h1>
					<span>{{ $t('exporterResultats') }}</span>
				</h1>
				<div class="conteneur">
					<label for="code-interaction-r">{{ $t('codeInteraction') }}</label>
					<input id="code-interaction-r" type="number" v-model="codeR" :disabled="disabled">
				</div>
				<div class="actions">
					<button type="button" class="bouton" :disabled="disabled" @click="exporterResultats">{{ $t('valider') }}</button>
				</div>
				<h1>
					<span>{{ $t('supprimerInteraction') }}</span>
				</h1>
				<div class="conteneur">
					<label for="code-interaction-s">{{ $t('codeInteraction') }}</label>
					<input id="code-interaction-s" type="number" v-model="codeS" :disabled="disabled">
				</div>
				<div class="conteneur">
					<div class="conteneur-interrupteur">
						<span>{{ $t('supprimerFichiersServeur') }}</span>
						<label class="bouton-interrupteur" :tabindex="tabIndex" :aria-disabled="disabled" @keydown.enter.space.prevent="activerInput('suppression-fichier')">
							<input id="suppression-fichier" type="checkbox" :checked="suppressionFichiers" :disabled="disabled" @change="modifierSuppressionFichiers">
							<span class="barre" />
						</label>
					</div>
				</div>
				<div class="actions">
					<button type="button" class="bouton" :disabled="disabled" @click="ouvrirModale('supprimer-interaction')">{{ $t('valider') }}</button>
				</div>
				<h1>
					<span>{{ $t('supprimerCompte') }}</span>
				</h1>
				<div class="conteneur">
					<label for="identifiant-s">{{ $t('identifiant') }}</label>
					<input id="identifiant-s" type="text" v-model="identifiantS" :disabled="disabled">
				</div>
				<div class="actions">
					<button type="button" class="bouton" :disabled="disabled" @click="ouvrirModale('supprimer-compte')">{{ $t('valider') }}</button>
				</div>
			</div>
		</div>

		<div class="conteneur-modale alerte" v-if="modale !== ''">
			<div class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<div class="message" v-html="$t('confirmationSupprimerInteraction')" v-if="modale === 'supprimer-interaction'" />
						<div class="message" v-html="$t('confirmationSupprimerCompteAdmin')" v-else-if="modale === 'supprimer-compte'" />
						<div class="actions">
							<button type="button" :disabled="disabledModale" class="bouton" @click="fermerModale">{{ $t('non') }}</button>
							<button type="button" :disabled="disabledModale" class="bouton" @click="supprimerInteraction" v-if="modale === 'supprimer-interaction'">{{ $t('oui') }}</button>
							<button type="button" :disabled="disabledModale" class="bouton" @click="supprimerCompte" v-else-if="modale === 'supprimer-compte'">{{ $t('oui') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<Notification :notification="notification" @fermer="notification = ''" />

		<Message :message="message" @elementPrecedent="definirElementPrecedent" @fermer="fermerMessage" v-if="message !== ''" />

		<Chargement v-if="chargement" />
	</main>
</template>

<script>
import axios from 'axios'
import fileSaver from 'file-saver'
const { saveAs } = fileSaver
import JSZip from 'jszip'
import Chargement from '#root/components/chargement.vue'
import Message from '#root/components/message.vue'
import Notification from '#root/components/notification.vue'

export default {
	name: 'DigistormAdmin',
	components: {
		Chargement,
		Message,
		Notification
	},
	data () {
		return {
			chargement: false,
			message: '',
			notification: '',
			acces: false,
			admin: '',
			modale: '',
			identifiant: '',
			email: '',
			motdepasse: '',
			code: '',
			codeS: '',
			codeM: '',
			codeE: '',
			codeR: '',
			donneesInteraction: '',
			identifiantS: '',
			champ: '',
			valeur: '',
			suppressionFichiers: true,
			elementPrecedent: null,
			hote: this.$pageContext.pageProps.hote,
			langues: this.$pageContext.pageProps.langues,
			langue: this.$pageContext.pageProps.langue
		}
	},
	computed: {
		tabIndex () {
			return this.modale === '' && this.message === '' ? 0 : -1
		},
		disabled () {
			return this.modale === '' && this.message === '' ? false : true
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
		const motdepasse = prompt(this.$t('motDePasse'), '')
		if (motdepasse) {
			axios.post(this.hote + '/api/verifier-mot-de-passe-admin', {
				admin: motdepasse
			}).then((reponse) => {
				const donnees = reponse.data
				if (donnees === 'acces_verifie') {
					this.acces = true
					this.admin = motdepasse
					document.addEventListener('keydown', this.gererClavier, false)
				}
			})
		}
	},
	beforeUnmount () {
		document.removeEventListener('keydown', this.gererClavier, false)
	},
	methods: {
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
		modifierMotDePasse () {
			if (this.motdepasse.trim() !== '' && (this.identifiant !== '' || this.email !== '')) {
				this.chargement = true
				axios.post(this.hote + '/api/modifier-mot-de-passe-admin', {
					admin: this.admin,
					identifiant: this.identifiant,
					email: this.email,
					motdepasse: this.motdepasse
				}).then((reponse) => {
					this.chargement = false
					const donnees = reponse.data
					this.notification = this.$t('motDePasseModifie')
					if (donnees !== 'motdepasse_modifie') {
						this.message = this.$t('identifiant') + ' : ' + donnees
					}
					this.identifiant = ''
					this.motdepasse = ''
					this.email = ''
				}).catch((err) => {
					this.chargement = false
					if (err.response?.data === 'identifiant_non_valide') {
						this.message = this.$t('identifiantNonValide')
					} else if (err.response?.data === 'email_non_valide') {
						this.message = this.$t('erreurEmail')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		recupererDonneesInteraction () {
			if (this.code !== '') {
				this.chargement = true
				axios.post(this.hote + '/api/recuperer-donnees-interaction-admin', {
					admin: this.admin,
					code: this.code
				}).then((reponse) => {
					this.chargement = false
					this.donneesInteraction = reponse.data
					this.code = ''
				}).catch((err) => {
					this.chargement = false
					if (err.response?.data === 'interaction_inexistante') {
						this.message = this.$t('interactionInexistante')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		modifierDonneesInteraction () {
			if (this.codeM !== '' && this.champ !== '' && this.valeur !== '') {
				this.chargement = true
				axios.post(this.hote + '/api/modifier-donnees-interaction-admin', {
					admin: this.admin,
					code: this.codeM,
					champ: this.champ,
					valeur: this.valeur
				}).then(() => {
					this.chargement = false
					this.message = this.$t('donneesModifiees')
					this.codeM = ''
					this.champ = ''
					this.valeur = ''
				}).catch((err) => {
					this.chargement = false
					if (err.response?.data === 'interaction_inexistante') {
						this.message = this.$t('interactionInexistante')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		modifierSuppressionFichiers (event) {
			if (event.target.checked === true) {
				this.suppressionFichiers = true
			} else {
				this.suppressionFichiers = false
			}
		},
		exporterInteraction () {
			if (this.codeE !== '') {
				this.chargement = true
				axios.post(this.hote + '/api/exporter-interaction', {
					code: this.codeE,
					identifiant: '',
					admin: this.admin
				}).then((reponse) => {
					saveAs('/temp/' + reponse.data, this.codeE + '.zip')
					this.chargement = false
					this.codeE = ''
				}).catch((err) => {
					this.chargement = false
					this.codeE = ''
					if (err.response?.data === 'erreur_donnees') {
						this.message = this.$t('aucuneDonneesExport')
					} else if (err.response?.data === 'erreur_code') {
						this.message = this.$t('codeNonValide')
					} else if (err.response?.data === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		exporterResultats () {
			if (this.codeR !== '') {
				this.chargement = true
				axios.post(this.hote + '/api/recuperer-donnees-interaction-admin', {
					admin: this.admin,
					code: this.codeR
				}).then((reponse) => {
					const zip = new JSZip()
					const type = reponse.data.type
					const sessions = JSON.parse(reponse.data.sessions)
					for (let session in sessions) {
						let texte = ''
						const reponses = JSON.parse(reponse.data.reponses)[session]
						if (reponses && reponses !== null) {
							let donneesSession = JSON.parse(reponse.data.donnees)
							if (sessions[session] && sessions[session].hasOwnProperty('donnees')) {
								donneesSession = sessions[session].donnees
							}
							let bannis = []
							if (sessions[session] && sessions[session].hasOwnProperty('bannis')) {
								bannis = sessions[session].bannis
							}
							const utilisateurs = []
							reponses.forEach((item) => {
								let banni = false
								if (bannis.includes(item.identifiant)) {
									banni = true
								}
								if (type === 'Questionnaire') {
									const score = this.definirScores(item, donneesSession)
									utilisateurs.push({ identifiant: item.identifiant, nom: item.nom, reponse: item.reponse, score: score, banni: banni })
								} else if (type === 'Remue-méninges' || type === 'Nuage-de-mots') {
									if (utilisateurs.map((e) => { return e.identifiant }).includes(item.identifiant) === false) {
										utilisateurs.push({ identifiant: item.identifiant, nom: item.nom, reponse: [item.reponse], banni: banni })
									} else {
										utilisateurs.forEach((utilisateur) => {
											if (utilisateur.identifiant === item.identifiant) {
												utilisateur.reponse.push(item.reponse)
												utilisateur.banni = banni
											}
										})
									}
								} else {
									utilisateurs.push({ identifiant: item.identifiant, nom: item.nom, reponse: item.reponse, banni: banni })
								}
							})
							if (utilisateurs.length > 0) {
								const totalQuestions = utilisateurs[0].reponse.length
								if (type === 'Sondage') {
									texte += this.$t('identifiant') + ',' + this.$t('nom') + ','
									for (let i = 0; i < totalQuestions; i++) {
										if (i < (totalQuestions - 1)) {
											texte += this.$t('reponse') + ' ' + (i + 1) + ','
										} else {
											texte += this.$t('reponse') + ' ' + (i + 1) + '\n'
										}
									}
									utilisateurs.forEach((utilisateur) => {
										if (utilisateur.banni) {
											texte += utilisateur.identifiant + ',' + utilisateur.nom + ' (' + this.$t('banni') + ') ' + ','
										} else {
											texte += utilisateur.identifiant + ',' + utilisateur.nom + ','
										}
										utilisateur.reponse.forEach((item, indexItem) => {
											item.forEach((reponse, indexReponse) => {
												if ((indexReponse + 1) === item.length) {
													if (typeof reponse === 'string' || reponse instanceof String) {
														texte += reponse.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ')
													} else {
														texte += reponse + '/' + donnees.questions[indexItem].etoiles
													}
												} else {
													texte += reponse.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' | '
												}
											})
											if (indexItem < (totalQuestions - 1)) {
												texte += ','
											} else {
												texte += '\n'
											}
										})
									})
								} else if (type === 'Questionnaire') {
									utilisateurs.forEach((utilisateur, index) => {
										let score = 0
										utilisateur.score.forEach((points) => {
											score = score + points
										})
										utilisateurs[index].total = score
									})
									texte += this.$t('identifiant') + ',' + this.$t('nom') + ',' + this.$t('scoreTotal') + ','
									for (let i = 0; i < totalQuestions; i++) {
										if (i < (totalQuestions - 1)) {
											texte += this.$t('reponse') + ' ' + (i + 1) + ','
											texte += this.$t('score') + ' ' + (i + 1) + ','
										} else {
											texte += this.$t('reponse') + ' ' + (i + 1) + ','
											texte += this.$t('score') + ' ' + (i + 1) + '\n'
										}
									}
									utilisateurs.forEach((utilisateur) => {
										if (utilisateur.banni) {
											texte += utilisateur.identifiant + ',' + utilisateur.nom + ' (' + this.$t('banni') + ') ' + ',' + utilisateur.total + ','
										} else {
											texte += utilisateur.identifiant + ',' + utilisateur.nom + ',' + utilisateur.total + ','
										}
										utilisateur.reponse.forEach((item, indexItem) => {
											item.forEach((reponse, indexReponse) => {
												if ((indexReponse + 1) === item.length) {
													texte += reponse.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ')
												} else {
													texte += reponse.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' | '
												}
											})
											texte += ',' + utilisateur.score[indexItem]
											if (indexItem < (totalQuestions - 1)) {
												texte += ','
											} else {
												texte += '\n'
											}
										})
									})
								} else if (type === 'Remue-méninges') {
									texte += this.$t('identifiant') + ',' + this.$t('nom') + ','
									const categories = []
									if (donneesSession.hasOwnProperty('categories')) {
										donneesSession.categories.forEach((categorie) => {
											if (categorie.texte !== '') {
												categories.push(categorie.texte)
											} else if (categorie.image !== '') {
												categories.push(categorie.image)
											}
										})
									}
									if (categories.length > 0) {
										categories.forEach((categorie, indexCategorie) => {
											if (indexCategorie < (categories.length - 1)) {
												texte += this.$t('categorie') + ' ' + (indexCategorie + 1) + ' - ' + categorie.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ','
											} else {
												texte += this.$t('categorie') + ' ' + (indexCategorie + 1) + ' - ' + categorie.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + '\n'
											}
										})
									} else {
										texte += this.$t('messages') + '\n'
									}
									utilisateurs.forEach((utilisateur) => {
										if (utilisateur.banni) {
											texte += utilisateur.identifiant + ',' + utilisateur.nom + ' (' + this.$t('banni') + ') ' + ','
										} else {
											texte += utilisateur.identifiant + ',' + utilisateur.nom + ','
										}
										if (categories.length > 0) {
											categories.forEach((categorie, indexCategorie) => {
												let messages = ''
												utilisateur.reponse.forEach((item) => {
													if (categorie === item.categorie) {
														if (!item.visible) {
															messages += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('supprime') + ')' + ' | '
														} else if (item.hasOwnProperty('texteoriginal')) {
															messages += item.texteoriginal.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('modifie') + ' : ' + item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ')' + ' | '
														} else {
															messages += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' | '
														}
													}
												})
												if (indexCategorie < (categories.length - 1)) {
													texte += messages.substring(0, messages.length - 3) + ','
												} else {
													texte += messages.substring(0, messages.length - 3) + '\n'
												}
											})
										} else {
											utilisateur.reponse.forEach((item, indexItem) => {
												if ((indexItem + 1) === utilisateur.reponse.length) {
													if (!item.visible) {
														texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('supprime') + ')' + '\n'
													} else if (item.hasOwnProperty('texteoriginal')) {
														texte += item.texteoriginal.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('modifie') + ' : ' + item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ')' + '\n'
													} else {
														texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + '\n'
													}
												} else {
													if (!item.visible) {
														texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('supprime') + ')' + ' | '
													} else if (item.hasOwnProperty('texteoriginal')) {
														texte += item.texteoriginal.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('modifie') + ' : ' + item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ')' + ' | '
													} else {
														texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' | '
													}
												}
											})
										}
									})
								} else if (type === 'Nuage-de-mots') {
									texte += this.$t('identifiant') + ',' + this.$t('nom') + ',' + this.$t('mots') + '\n'
									utilisateurs.forEach((utilisateur) => {
										if (utilisateur.banni) {
											texte += utilisateur.identifiant + ',' + utilisateur.nom + ' (' + this.$t('banni') + ') ' + ','
										} else {
											texte += utilisateur.identifiant + ',' + utilisateur.nom + ','
										}
										utilisateur.reponse.forEach((item, indexItem) => {
											if ((indexItem + 1) === utilisateur.reponse.length) {
												if (!item.visible) {
													texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '') + ' (' + this.$t('supprime') + ')' + '\n'
												} else if (item.hasOwnProperty('texteoriginal')) {
													texte += item.texteoriginal.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('modifie') + ' : ' + item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ')' + '\n'
												} else {
													texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '') + '\n'
												}
											} else {
												if (!item.visible) {
													texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '') + ' (' + this.$t('supprime') + ')' + ' | '
												} else if (item.hasOwnProperty('texteoriginal')) {
													texte += item.texteoriginal.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('modifie') + ' : ' + item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ')' + ' | '
												} else {
													texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '') + ' | '
												}
											}
										})
									})
								}
								const blob = new Blob([texte], { type: 'text/csv;charset=utf-8' })
								const fichier = this.codeR + '_' + session + '.csv'
								zip.file(fichier, blob)
							} else {
								this.message = this.$t('erreurExportResultat')
							}
						}
					}
					zip.generateAsync({ type: 'blob' }).then((archive) => {
						this.chargement = false
						saveAs(archive, this.codeR + '.zip')
						this.codeR = ''
					})
				}).catch((err) => {
					this.chargement = false
					this.codeR = ''
					if (err.response?.data === 'interaction_inexistante') {
						this.message = this.$t('interactionInexistante')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		definirScores (item, donnees) {
			let scoreTotal = []
			if (item.hasOwnProperty('score') && donnees.options.points !== 'classique') {
				scoreTotal = item.score
			} else if (item && item.hasOwnProperty('reponse') && item.reponse.length > 0) {
				donnees.questions.forEach((question, indexQuestion) => {
					if (item.reponse[indexQuestion]) {
						let score
						const reponseCorrecte = []
						const bonnesReponses = []
						const mauvaisesReponses = []
						if (question.option !== 'texte-court') {
							question.items.forEach((i) => {
								if (i.reponse === true && i.texte !== '') {
									reponseCorrecte.push(i.texte)
								} else if (i.reponse === true && i.image && i.image !== '') {
									reponseCorrecte.push(i.image)
								} else if (i.reponse === true && i.audio && i.audio !== '') {
									reponseCorrecte.push(i.audio)
								}
							})
							question.items.forEach((i) => {
								if (i.reponse === true && (item.reponse[indexQuestion].includes(i.texte) || (i.hasOwnProperty('image') && item.reponse[indexQuestion].includes(i.image)) || (i.hasOwnProperty('audio') && item.reponse[indexQuestion].includes(i.audio)))) {
									bonnesReponses.push(i)
								} else if (i.reponse === false && (item.reponse[indexQuestion].includes(i.texte) || (i.hasOwnProperty('image') && item.reponse[indexQuestion].includes(i.image)) || (i.hasOwnProperty('audio') && item.reponse[indexQuestion].includes(i.audio)))) {
									mauvaisesReponses.push(i)
								}
							})
						} else {
							const reponsesTexte = question.reponses.split('|')
							reponsesTexte.forEach((item, index) => {
								reponsesTexte[index] = item.trim()
							})
							reponseCorrecte.push(...reponsesTexte)
							if (reponsesTexte.includes(item.reponse[indexQuestion].toString().trim()) === true) {
								bonnesReponses.push(item.reponse[indexQuestion].toString())
							}
						}
						let multiplicateurSecondes = 10
						if (donnees.options.hasOwnProperty('multiplicateur') && donnees.options.multiplicateur > 0) {
							multiplicateurSecondes = donnees.options.multiplicateur
						}
						if (((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => item.reponse[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)) && donnees.options.points === 'classique' && question.hasOwnProperty('points')) {
							scoreTotal.push(question.points)
						} else if (((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => item.reponse[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)) && donnees.options.points === 'classique' && !question.hasOwnProperty('points')) {
							scoreTotal.push(1000)
						} else if (((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => item.reponse[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)) && donnees.options.points !== 'classique' && question.hasOwnProperty('points')) {
							score = Math.round(question.points - (item.temps[indexQuestion] * multiplicateurSecondes))
							if (score < (question.points / 10)) {
								score = Math.round(question.points / 10)
							}
							scoreTotal.push(score)
						} else if (((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => item.reponse[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)) && donnees.options.points !== 'classique' && !question.hasOwnProperty('points')) {
							score = Math.round(1000 - (item.temps[indexQuestion] * multiplicateurSecondes))
							if (score < 100) {
								score = 100
							}
							scoreTotal.push(score)
						} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0 && donnees.options.points === 'classique' && question.hasOwnProperty('points')) {
							scoreTotal.push((question.points / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
						} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0 && donnees.options.points === 'classique' && !question.hasOwnProperty('points')) {
							scoreTotal.push((1000 / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
						} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0 && donnees.options.points !== 'classique' && question.hasOwnProperty('points')) {
							let points = Math.round(question.points - (item.temps[indexQuestion] * multiplicateurSecondes))
							if (points < (question.points / 10)) {
								points = Math.round(question.points / 10)
							}
							score = ((points / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
							scoreTotal.push(score)
						} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0 && donnees.options.points !== 'classique' && !question.hasOwnProperty('points')) {
							let points = Math.round(1000 - (item.temps[indexQuestion] * multiplicateurSecondes))
							if (points < 100) {
								points = 100
							}
							score = ((points / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
							scoreTotal.push(score)
						} else {
							scoreTotal.push(0)
						}
					}
				})
			}
			return scoreTotal
		},
		ouvrirModale (type) {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = type
			this.$nextTick(() => {
				document.querySelector('.modale .bouton')?.focus()
			})
		},
		supprimerInteraction () {
			if (this.codeS !== '') {
				this.modale = ''
				this.chargement = true
				axios.post(this.hote + '/api/recuperer-donnees-interaction-admin', {
					admin: this.admin,
					code: this.codeS
				}).then((reponse) => {
					this.chargement = false
					const donnees = reponse.data
					const identifiant = donnees.identifiant
					axios.post(this.hote + '/api/supprimer-interaction', {
						code: parseInt(this.codeS),
						identifiant: identifiant,
						admin: this.admin,
						suppressionFichiers: this.suppressionFichiers
					}).then(() => {
						this.chargement = false
						this.notification = this.$t('interactionSupprimee')
						this.codeS = ''
						this.suppressionFichiers = true
						this.gererFocus()
					}).catch((err) => {
						this.chargement = false
						this.codeS = ''
						this.suppressionFichiers = true
						if (err.response?.data === 'erreur_suppression') {
							this.message = this.$t('erreurSuppressionInteraction')
						} else {
							this.message = this.$t('erreurCommunicationServeur')
						}
					})
				}).catch((err) => {
					this.chargement = false
					this.codeS = ''
					this.suppressionFichiers = true
					if (err.response?.data === 'interaction_inexistante') {
						this.message = this.$t('interactionInexistante')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		supprimerCompte () {
			if (this.identifiantS !== '') {
				this.modale = ''
				this.chargement = true
				axios.post(this.hote + '/api/supprimer-compte', {
					identifiant: this.identifiantS,
					admin: this.admin
				}).then(() => {
					this.chargement = false
					this.notification = this.$t('compteSupprime')
					this.identifiantS = ''
					this.gererFocus()
				}).catch((err) => {
					this.chargement = false
					if (donnees === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} 
					this.message = this.$t('erreurCommunicationServeur')
				})
			}
		},
		fermerModale () {
			this.modale = ''
			this.gererFocus()
		},
		fermerMessage () {
			this.message = ''
			this.gererFocus()
		},
		definirElementPrecedent (element) {
			this.elementPrecedent = element
		},
		activerInput (id) {
			document.querySelector('#' + id)?.click()
		},
		gererClavier (event) {
			if (event.key === 'Escape' && this.message !== '') {
				this.fermerMessage()
			} else if (event.key === 'Escape' && this.modale !== '') {
				this.fermerModale()
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

#page {
	overflow: auto;
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
	background: #fff;
    border-radius: 50%;
    border: 1px solid #ddd;
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
    width: 100%;
	max-width: 500px;
	margin: auto;
	padding-top: 5em;
	padding-bottom: 5em;
}

#conteneur h1 {
    font-family: 'Mona Sans Expanded', sans-serif;
    font-size: 2rem;
	margin: 0 1.5rem 0.85em;
    line-height: 1.4;
}

#conteneur .conteneur {
    margin: 2rem 1.5rem;
}

#conteneur .conteneur-bouton {
	font-size: 0;
}

#conteneur .conteneur label {
    font-size: 14px;
    display: block;
	margin-bottom: 10px;
	line-height: 1.15;
	font-weight: 700;
}

#conteneur .conteneur select,
#conteneur .conteneur input {
	display: block;
    width: 100%;
    font-size: 16px;
    border: 1px solid #ddd;
    border-radius: 4px;
	padding: 7px 15px;
	line-height: 1.5;
}

#conteneur .conteneur select {
	background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 0 29 14" width="29"><path fill="%23000000" d="M9.37727 3.625l5.08154 6.93523L19.54036 3.625" /></svg>') center right no-repeat;
	padding-right: 30px;
}

#conteneur .conteneur div {
    margin-bottom: 10px;
}

#conteneur .conteneur div:not(.conteneur-interrupteur):last-child {
    margin-bottom: 3rem;
}

#conteneur .conteneur .donnees {
	user-select: text!important;
	-webkit-user-select: text!important;
	-webkit-touch-callout: default!important;
}

#conteneur .actions {
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
	margin-bottom: 4rem;
}

#conteneur .actions .bouton {
	display: inline-block;
	width: 180px;
    line-height: 1;
    font-size: 1em;
    font-weight: 700;
    text-transform: uppercase;
	text-align: center;
	padding: 1em 1.5em;
	margin-right: 1em;
    border: 2px solid #00ced1;
	border-radius: 2em;
    background: #46fbff;
	cursor: pointer;
    transition: all 0.1s ease-in;
}

#conteneur .actions .bouton.maintenance {
	width: 100%;
}

#conteneur .actions .bouton.maintenance:first-child {
	margin-right: 0;
	margin-bottom: 2rem;
}

#conteneur .actions .bouton:hover {
    color: #fff;
	text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.3);
	background: #00ced1;
}

#conteneur .actions .bouton:last-child {
	margin-right: 0;
}

#conteneur .conteneur-interrupteur {
	display: flex;
	justify-content: space-between;
	margin-bottom: 1rem;
	line-height: 2.2rem;
}

#conteneur .conteneur-interrupteur > span {
	font-size: 16px;
}

#conteneur .bouton-interrupteur {
	position: relative;
	display: inline-block!important;
	width: 3.8rem!important;
	height: 2.2rem;
	margin: 0!important;
}

#conteneur .bouton-interrupteur input {
	opacity: 0;
	width: 0;
	height: 0;
}

#conteneur .bouton-interrupteur .barre {
	position: absolute;
	cursor: pointer;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: #ccc;
	transition: 0.2s;
	border-radius: 3rem;
}

#conteneur .bouton-interrupteur .barre:before {
	position: absolute;
	content: '';
	height: 1.6rem;
	width: 1.6rem;
	left: 0.3rem;
	bottom: 0.3rem;
	background-color: #fff;
	transition: 0.2s;
	border-radius: 50%;
}

#conteneur .bouton-interrupteur input:checked + .barre {
	background-color: #00ced1;
}

#conteneur .bouton-interrupteur input:focus + .barre {
	box-shadow: 0 0 1px #00ced1;
}

#conteneur .bouton-interrupteur input:checked + .barre:before {
	transform: translateX(1.6rem);
}

.alerte .modale .conteneur {
	padding: 30px 25px;
	text-align: center;
	max-width: 500px;
}

.alerte .message {
	font-size: 18px;
	line-height: 1.5;
}

.alerte .bouton {
	margin-top: 20px;
}

.alerte .modale .actions {
	font-size: 0;
}

.alerte .modale .actions span,
.alerte .modale .actions button {
	min-width: 70px;
}

@media screen and (max-width: 359px) {
	#conteneur .actions .bouton {
		font-size: 0.75em!important;
		width: 130px;
		padding: 1em 0.5em;
	}
}

@media screen and (min-width: 360px) and (max-width: 599px) {
	#conteneur .actions .bouton {
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

	#conteneur .actions .bouton {
		font-size: 0.85em;
		margin-bottom: 1em;
	}
}

@media screen and (max-width: 850px) and (max-height: 500px) {
	#conteneur h1 {
		font-size: 2em;
		margin-bottom: 1em;
	}

	#conteneur .actions .bouton {
		font-size: 0.85em!important;
	}
}
</style>

<style>
#message .message {
	user-select: text!important;
}
</style>
