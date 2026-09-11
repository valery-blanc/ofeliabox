<template>
	<div id="nuage-de-mots">
		<div id="question">
			<div class="question-et-image" v-if="question !== '' && Object.keys(support).length > 0">
				<span class="question" v-html="formaterHTML(question)" />

				<button type="button" class="support" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-if="support.lien && support.lien !== ''" @click="afficherMedia($event, support.lien, '', 'video')"><img :src="support.vignette" :alt="support.vignette"></button>
				<button type="button" class="support" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="support.fichier && support.fichier !== '' && support.type === 'image'" @click="afficherMedia($event, definirCheminFichier(support.fichier), support.alt, 'image')"><img :src="definirCheminFichier(support.fichier)" :alt="support.alt"></button>
				<button type="button" class="support" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="support.fichier && support.fichier !== '' && support.type === 'audio'" @click="afficherMedia($event, definirCheminFichier(support.fichier), '', 'audio')"><span aria-hidden="true"><i class="material-icons">graphic_eq</i></span></button>
			</div>
			<div class="question" v-else-if="question !== ''" v-html="formaterHTML(question)" />
			<div class="support seul" v-else-if="Object.keys(support).length > 0">
				<button type="button" class="support" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-if="support.lien && support.lien !== ''" @click="afficherMedia($event, support.lien, '', 'video')"><img :src="support.vignette" :alt="support.vignette"></button>
				<button type="button" class="support" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="support.fichier && support.fichier !== '' && support.type === 'image'" @click="afficherMedia($event, definirCheminFichier(support.fichier), support.alt, 'image')"><img :src="definirCheminFichier(support.fichier)" :alt="support.alt"></button>
				<audio v-else-if="support.fichier && support.fichier !== '' && support.type === 'audio'" controls :src="definirCheminFichier(support.fichier)" />
			</div>
		</div>

		<div id="conteneur-nuage" aria-live="polite" :style="{'top': hauteurQuestion + 'px', 'height': hauteurConteneur + 'px'}">
			<VueWordCloud :animation-duration="350" animation-easing="ease-in-out" :animation-overlap="1" color="#00ced1" font-family="HKGrotesk-Black" :spacing="1/2" :words="mots" @update:progress="modifierProgression">
				<template v-slot="{text, weight, word}">
					<button type="button" :disabled="disabled" :title="text + ' (' + weight + ')' + ' - ' + definirNoms(text)" :aria-label="text + ' (' + weight + ')' + ' - ' + definirNoms(text)" @click="afficherMot(word)">
						{{ text }}
					</button>
				</template>
			</VueWordCloud>
		</div>

		<div class="conteneur-modale" v-if="modale === 'media'">
			<div id="modale-media" class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<img v-if="media.type === 'image'" :src="media.fichier" :alt="media.alt">
						<audio v-else-if="media.type === 'audio'" controls :src="media.fichier" />
						<div class="video" v-else-if="media.type === 'video'">
							<iframe :src="media.lien" allow="autoplay; fullscreen" />
						</div>
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleMedia">{{ $t('fermer') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'mot'">
			<div id="modale-mot" class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<p :style="{'color': mot.color}">{{ mot.text }}</p>
						<span class="mot edition" v-if="editionMot">
							<TextareaAutosize :id="'champ' + mot.id" v-model="texte" :rows="1" :min-height="46" :max-height="92" :disabled="disabledModale" />
							<button type="button" class="bouton icone" :disabled="disabledModale" :title="$t('annuler')" :aria-label="$t('annuler')" @click="annulerModifierMot"><i class="material-icons" aria-hidden="true">close</i></button>
							<button type="button" class="bouton icone" :disabled="disabledModale" :title="$t('valider')" :aria-label="$t('valider')" @click="modifierMot"><i class="material-icons" aria-hidden="true">check</i></button>
						</span>
						<div class="actions">
							<input type="color" :title="$t('modifierCouleurMot')" :aria-label="$t('modifierCouleurMot')" :value="mot.color" :disabled="disabledModale" @change="modifierCouleurMot">
							<button type="button" class="bouton" :disabled="disabledModale" @click="afficherModifierMot">{{ $t('modifier') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="supprimerMot">{{ $t('supprimer') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleMot">{{ $t('fermer') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<Chargement v-if="chargement" />
	</div>
</template>

<script>
import latinise from 'voca/latinise'
import imagesLoaded from 'imagesloaded'
import methodes from '#root/components/js/methodes-fichiers'
import Chargement from '#root/components/chargement.vue'
import TextareaAutosize from '#root/components/textareaAutosize.vue'
import VueWordCloud from '#root/components/js/wordcloud'

export default {
	name: 'DigistormNuageMotsAfficher',
	inject: ['parent'],
	components: {
		Chargement,
		TextareaAutosize,
		[VueWordCloud.name]: VueWordCloud
	},
	extends: methodes,
	props: {
		code: String,
		donnees: Object,
		reponses: Array,
		session: Number,
		bannis: Array
	},
	data () {
		return {
			chargement: false,
			question: '',
			support: {},
			options: {},
			modale: '',
			media: {},
			mots: [],
			mot: '',
			texte: '',
			editionMot: false,
			progression: '',
			hauteurQuestion: 0,
			hauteurConteneur: 0,
			elementPrecedent: null
		}
	},
	computed: {
		disabled () {
			return this.parent.modale === '' && this.parent.message === '' && this.parent.modaleConfirmation === '' && this.modale === '' ? false : true
		},
		disabledModale () {
			return this.parent.message === '' ? false : true
		}
	},
	watch: {
		reponses: {
			handler () {
				this.definirMots()
			},
			deep: true
		},
		bannis: {
			handler () {
				this.definirMots()
			},
			deep: true
		},
		progression (progression) {
			if (progression === '' || progression === null) {
				setTimeout(() => {
					this.chargement = false
				}, 350)
			} else {
				this.chargement = true
			}
		}
	},
	created () {
		this.question = this.donnees.question
		this.support = this.donnees.support
		if (this.donnees.hasOwnProperty('options')) {
			this.options = this.donnees.options
		}
		this.definirMots()
	},
	mounted () {
		imagesLoaded('#question', () => {
			this.$nextTick(() => {
				window.typesetMathJax()
				this.$nextTick(() => {
					this.verifierConteneur()
				})
			})
		})
		document.addEventListener('keydown', this.gererClavier, false)
		window.addEventListener('resize', this.verifierConteneur, false)
	},
	beforeUnmount () {
		document.removeEventListener('keydown', this.gererClavier, false)
		window.removeEventListener('resize', this.verifierConteneur, false)
	},
	methods: {
		definirMots () {
			const mots = []
			this.reponses.forEach((item) => {
				if (!this.bannis.includes(item.identifiant) && item.reponse.visible && (Object.keys(this.options).length === 0 || (this.options.hasOwnProperty('casse') && this.options.casse === false))) {
					if (mots.map(mot => mot.text).includes(item.reponse.texte) === true) {
						mots.forEach((mot, indexMot) => {
							if (mot.text === item.reponse.texte) {
								mots[indexMot].weight = mot.weight + 1
							}
						})
					} else {
						const id = Math.random().toString(16).slice(3)
						mots.push({ id: id, text: item.reponse.texte, weight: 1, number: 1, rotation: 0, fontFamily: 'HKGrotesk-Black', color: item.reponse.couleur })
					}
				} else if (!this.bannis.includes(item.identifiant) && item.reponse.visible && this.options.hasOwnProperty('casse') && this.options.casse === true) {
					if (mots.map(mot => latinise(mot.text.toLowerCase())).includes(latinise(item.reponse.texte.toLowerCase())) === true) {
						mots.forEach((mot, indexMot) => {
							if (latinise(mot.text.toLowerCase()) === latinise(item.reponse.texte.toLowerCase())) {
								mots[indexMot].weight = mot.weight + 1
							}
						})
					} else {
						const id = Math.random().toString(16).slice(3)
						mots.push({ id: id, text: item.reponse.texte, weight: 1, number: 1, rotation: 0, fontFamily: 'HKGrotesk-Black', color: item.reponse.couleur })
					}
				}
			})
			this.mots = mots
		},
		definirNoms (mot) {
			const utilisateurs = []
			this.reponses.forEach((item) => {
				let utilisateur = ''
				if ((this.options.hasOwnProperty('casse') && this.options.casse === false && item.reponse.texte === mot) || (this.options.hasOwnProperty('casse') && this.options.casse === true && item.reponse.texte.toLowerCase() === mot.toLowerCase())) {
					if (item.nom !== '') {
						utilisateur = item.nom
					} else {
						utilisateur = item.identifiant
					}
					if (!utilisateurs.includes(utilisateur)) {
						utilisateurs.push(utilisateur)
					}
				}
			})
			return utilisateurs.join(', ')
		},
		modifierProgression (progression) {
			this.progression = progression
		},
		afficherMot (mot) {
			let taille = 40
			if (window.innerWidth < 400) {
				taille = 25
			} else if (window.innerWidth > 399 && window.innerWidth < 599) {
				taille = 32
			}
			this.mot = mot
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'mot'
			this.$emit('modale', true)
			this.$nextTick(() => {
				fitty('#modale-mot p', {
					minSize: taille,
					maxSize: 200,
					multiLine: true
				})
				document.querySelector('.modale .bouton:last-of-type')?.focus()
			})
		},
		modifierCouleurMot (event) {
			const couleur = event.target.value
			const id = this.mot.id
			this.mots.forEach((mot, index) => {
				if (mot.id === id) {
					this.mots[index].color = couleur
				}
			})
			this.$socket.emit('modifiercouleurmot', { code: this.code, session: this.session, mot: this.mot.text, couleur: couleur })
		},
		afficherModifierMot () {
			this.texte = this.mot.text
			this.editionMot = true
			this.$nextTick(() => {
				document.querySelector('#champ' + this.mot.id)?.focus()
			})
		},
		annulerModifierMot () {
			this.editionMot = false
			this.texte = ''
		},
		modifierMot () {
			if (this.texte !== '' && (Object.keys(this.options).length === 0 || (this.options.hasOwnProperty('casse') && this.options.casse === false))) {
				const mot = this.mot.text
				this.mot.text = this.texte
				this.reponses.forEach((item) => {
					if (item.reponse.texte === mot) {
						item.reponse.texte = this.texte
					}
				})
				this.$socket.emit('modifiermot', { code: this.code, session: this.session, mot: mot, nouveaumot: this.texte })
				this.texte = ''
				this.editionMot = false
			} else if (this.texte !== '' && this.options.hasOwnProperty('casse') && this.options.casse === true) {
				const mot = this.mot.text
				const mots = []
				this.mot.text = this.texte
				const texte = latinise(mot.toLowerCase())
				this.reponses.forEach((item) => {
					if (latinise(item.reponse.texte.toLowerCase()) === texte) {
						mots.push(item.reponse.texte)
						item.reponse.texte = this.texte
					}
				})
				this.$socket.emit('modifiermots', { code: this.code, session: this.session, mots: mots, nouveaumot: this.texte })
				this.texte = ''
				this.editionMot = false
			}
			this.fermerModaleMot()
		},
		supprimerMot () {
			if (Object.keys(this.options).length === 0 || (this.options.hasOwnProperty('casse') && this.options.casse === false)) {
				const texte = this.mot.text
				const id = this.mot.id
				this.reponses.forEach((item) => {
					if (item.reponse.texte === texte) {
						item.reponse.visible = false
					}
				})
				this.mots.forEach((mot, index) => {
					if (mot.id === id) {
						this.mots.splice(index, 1)
					}
				})
				this.$socket.emit('supprimermot', { code: this.code, session: this.session, mot: this.mot.text })
			} else if (this.options.hasOwnProperty('casse') && this.options.casse === true) {
				const mots = []
				const texte = latinise(this.mot.text.toLowerCase())
				const id = this.mot.id
				this.reponses.forEach((item) => {
					if (latinise(item.reponse.texte.toLowerCase()) === texte) {
						mots.push(item.reponse.texte)
						item.reponse.visible = false
					}
				})
				this.mots.forEach((mot, index) => {
					if (mot.id === id) {
						this.mots.splice(index, 1)
					}
				})
				this.$socket.emit('supprimermots', { code: this.code, session: this.session, mots: mots })
			}
			this.fermerModaleMot()
		},
		fermerModaleMot () {
			this.modale = ''
			this.mot = ''
			this.$emit('modale', false)
			this.gererFocus()
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
			this.$emit('modale', true)
			this.$nextTick(() => {
				document.querySelector('.modale .bouton')?.focus()
			})
		},
		fermerModaleMedia () {
			this.modale = ''
			this.media = {}
			this.$emit('modale', false)
			this.gererFocus()
		},
		verifierConteneur () {
			const hauteurConteneur = document.querySelector('#conteneur').offsetHeight - (document.querySelector('#question').offsetHeight + 80)
			const hauteurQuestion = document.querySelector('#question').offsetHeight + 80
			this.hauteurConteneur = hauteurConteneur
			this.hauteurQuestion = hauteurQuestion
		},
		gererFocus () {
			this.$nextTick(() => {
				if (this.elementPrecedent) {
					this.elementPrecedent.focus()
					this.elementPrecedent = null
				}
			})
		},
		gererClavier (event) {
			if (event.key === 'Escape' && this.modale === 'mot') {
				this.fermerModaleMot()
			} else if (event.key === 'Escape' && this.modale === 'media') {
				this.fermerModaleMedia()
			} else if (event.key === 'Escape' && this.modale !== '') {
				this.modale = ''
				this.$emit('modale', false)
				this.gererFocus()
			} else if (event.key === 'Tab') {
				if (this.modale !== '') {
					const modale = document.querySelector('.modale')
					this.parent.piegerFocus(event, modale)
				}
			}
		}
	}
}
</script>

<style scoped src="#root/components/css/style-afficher.css"></style>

<style scoped>
#conteneur-nuage {
	position: absolute;
	left: 0;
	right: 0;
	width: 100%;
}

#modale-media img {
	max-height: calc(90vh - 190px);
}

#modale-mot  {
	text-align: center;
	max-width: 984px;
}

#modale-mot .conteneur {
	padding: 30px 25px;
}

#modale-mot p {
	font-weight: 700;
}

#modale-mot .actions {
	display: flex;
	justify-content: center;
	align-items: center;
	flex-wrap: wrap;
}

#modale-mot .actions .bouton {
	margin-right: 20px;
}

#modale-mot .actions .bouton:last-of-type {
	margin-right: 0;
}

#modale-mot input[type="color"] {
	width: 30px;
	height: 30px;
	margin-right: 20px;
	border: none;
	cursor: pointer;
}

#modale-mot input[type="color"]::-moz-color-swatch {
	border: 1px solid #ddd;
	border-radius: 50%;
}

#modale-mot input[type="color"]::-webkit-color-swatch {
	border: 1px solid #ddd;
	border-radius: 50%;
}

#modale-mot input[type="color"]::-webkit-color-swatch-wrapper {
	padding: 0;
}

#modale-mot .mot.edition {
	display: flex;
	justify-content: flex-start;
	align-items: center;
	width: 100%;
	margin-bottom: 20px;
}

#modale-mot .mot textarea {
	border: 1px solid #ddd;
	background: #fff;
	border-radius: 4px;
	padding: 10px 15px;
	margin-bottom: 0;
	width: calc(100% - 80px);
	line-height: 1.25;
}

#modale-mot .mot .bouton.icone {
	display: flex;
	justify-content: center;
	align-items: center;
	font-size: 24px;
	font-weight: 400!important;
	width: 30px;
	height: 30px;
	padding: 0;
	margin-left: 10px;
	color: #242f3d;
	background: #fff;
	letter-spacing: 0;
	text-indent: 0;
	text-shadow: none;
	border-radius: 50%;
	border: 2px solid #242f3d;
	cursor: pointer;
	user-select: none;
}

@media screen and (max-width: 399px) {
	#modale-mot .actions input {
		margin-bottom: 15px;
	}

	#modale-mot .actions .bouton:first-of-type {
		margin-right: 0;
		margin-bottom: 15px;
	}
}
</style>

<style>
#question .question {
	text-align: center;
}

#question .question a {
	color: #00a1e3;
	text-decoration: underline;
}
</style>
