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

		<div id="mot">
			<div class="conteneur-textarea">
				<TextareaAutosize v-model="texte" :rows="2" :min-height="46" :max-height="124" :placeholder="$t('votreMot')" :disabled="disabled" />
			</div>
			<div class="actions">
				<button type="button" class="bouton" :class="{'desactive': statut === 'verrouille'}" :disabled="disabled || statut === 'verrouille'" @click="envoyerReponse">{{ $t('envoyer') }}</button>
			</div>
		</div>

		<div id="mots" v-if="mots.length > 0">
			<h3 v-if="mots.length === 1">{{ $t('motEnvoye') }}</h3>
			<h3 v-else>{{ $t('motsEnvoyes') }}</h3>
			<ul>
				<li v-for="(mot, indexMot) in mots" :key="'mot_' + indexMot">
					<span v-if="mot.visible">{{ mot.texte }} <span v-if="mot.hasOwnProperty('texteoriginal')"><del>{{ mot.texteoriginal }}</del></span></span>
					<span v-else><del>{{ mot.texte }}</del></span>
				</li>
			</ul>
		</div>

		<div class="conteneur-modale" v-if="modale === 'nuage'">
			<div id="modale-nuage" class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<VueWordCloud :animation-duration="350" animation-easing="ease-in-out" :animation-overlap="1" color="#00ced1" font-family="HKGrotesk-Black" :spacing="1/2" :words="nuage" @update:progress="modifierProgression">
							<template v-slot="{text, weight}">
								<div :title="text + ' (' + weight + ')'" :aria-label="text + ' (' + weight + ')'">
									{{ text }}
								</div>
							</template>
						</VueWordCloud>
					</div>
				</div>
			</div>
		</div>

		<Chargement v-if="chargement" />
	</div>
</template>

<script>
import latinise from 'voca/latinise'
import methodes from '#root/components/js/methodes-fichiers'
import Chargement from '#root/components/chargement.vue'
import TextareaAutosize from '#root/components/textareaAutosize.vue'
import VueWordCloud from '#root/components/js/wordcloud'

export default {
	name: 'DigistormNuageMotsParticiper',
	inject: ['parent'],
	components: {
		Chargement,
		TextareaAutosize,
		[VueWordCloud.name]: VueWordCloud
	},
	extends: methodes,
	props: {
		identifiant: String,
		nom: String,
		code: String,
		donnees: Object,
		reponses: Array,
		statut: String,
		session: Number
	},
	data () {
		return {
			chargement: false,
			question: '',
			support: {},
			options: {},
			texte: '',
			nuage: [],
			modale: '',
			progression: ''
		}
	},
	computed: {
		tabIndex () {
			return this.parent.modale === '' && this.parent.message === '' && this.modale === '' ? 0 : -1
		},
		disabled () {
			return this.parent.modale === '' && this.parent.message === '' && this.modale === '' ? false : true
		},
		mots () {
			const mots = []
			this.reponses.forEach((item) => {
				if (item.identifiant === this.identifiant && item.reponse.hasOwnProperty('texteoriginal')) {
					mots.push({ texte: item.reponse.texte, texteoriginal: item.reponse.texteoriginal, visible: item.reponse.visible })
				} else if (item.identifiant === this.identifiant) {
					mots.push({ texte: item.reponse.texte, visible: item.reponse.visible })
				}
			})
			return mots
		}
	},
	watch: {
		progression (progression) {
			if (progression === '' || progression === null) {
				this.chargement = true
				setTimeout(() => {
					this.chargement = false
				}, 350)
			} else {
				setTimeout(() => {
					this.chargement = false
				}, 350)
			}
		}
	},
	created () {
		this.ecouterSocket()
		this.question = this.donnees.question
		this.support = this.donnees.support
		if (this.donnees.hasOwnProperty('options')) {
			this.options = this.donnees.options
			if (this.options.hasOwnProperty('casse') && this.options.casse === 'oui') {
				this.options.casse = true
			} else if (this.options.hasOwnProperty('casse') && this.options.casse === 'non') {
				this.options.casse = false
			}
		}
		if (this.statut === 'nuage-affiche') {
			this.definirNuage(this.reponses)
		}
	},
	mounted () {
		if (this.statut === 'nuage-affiche') {
			this.$socket.emit('recupererdonneesnuage', { code: this.code, session: this.session })
		}
	},
	methods: {
		definirNuage (reponses) {
			const nuage = []
			reponses.forEach((item) => {
				if (item.reponse.visible && (Object.keys(this.options).length === 0 || (this.options.hasOwnProperty('casse') && this.options.casse === false))) {
					if (nuage.map(mot => mot.text).includes(item.reponse.texte) === true) {
						nuage.forEach((mot, indexMot) => {
							if (mot.text === item.reponse.texte) {
								nuage[indexMot].weight = mot.weight + 1
							}
						})
					} else {
						const id = Math.random().toString(16).slice(3)
						nuage.push({ id: id, text: item.reponse.texte, weight: 1, number: 1, rotation: 0, fontFamily: 'HKGrotesk-Black', color: item.reponse.couleur })
					}
				} else if (item.reponse.visible && this.options.hasOwnProperty('casse') && this.options.casse === true) {
					if (nuage.map(mot => latinise(mot.text.toLowerCase())).includes(latinise(item.reponse.texte.toLowerCase())) === true) {
						nuage.forEach((mot, indexMot) => {
							if (latinise(mot.text.toLowerCase()) === latinise(item.reponse.texte.toLowerCase())) {
								nuage[indexMot].weight = mot.weight + 1
							}
						})
					} else {
						const id = Math.random().toString(16).slice(3)
						nuage.push({ id: id, text: item.reponse.texte, weight: 1, number: 1, rotation: 0, fontFamily: 'HKGrotesk-Black', color: item.reponse.couleur })
					}
				}
			})
			this.nuage = nuage
		},
		modifierProgression (progression) {
			this.progression = progression
		},
		envoyerReponse () {
			if (this.options.messagesLimites === true && this.mots.length === parseInt(this.options.messages)) {
				this.parent.message = this.$t('nombreMaximumMotsEnvoyes')
				return
			}
			const texte = this.texte.trim()
			let doublon = 0
			this.mots.forEach((mot) => {
				if (this.options.casse === true && ((latinise(texte.toLowerCase()) === latinise(mot.texte.toLowerCase())) || (mot.hasOwnProperty('texteoriginal') && latinise(mot.texteoriginal.toLowerCase()) === latinise(texte.toLowerCase())))) {
					doublon++
				} else if (this.options.casse === false && (texte === mot.texte || (mot.hasOwnProperty('texteoriginal') && mot.texteoriginal === texte))) {
					doublon++
				}
			})
			if (texte !== '' && doublon === 0) {
				this.chargement = true
				const couleurs = ['#ffd077', '#3bc4c7', '#3a9eea', '#ff4e69', '#461e47']
				const couleur = couleurs[Math.floor(Math.random() * couleurs.length)]
				this.$socket.emit('reponse', { code: this.code, session: this.session, donnees: { reponse: { texte: texte, couleur: couleur, visible: true }, identifiant: this.identifiant, nom: this.nom } })
				this.texte = ''
			}
		},
		afficherMedia (event, media, alt, type) {
			this.$emit('media', event, media, alt, type)
		},
		ecouterSocket () {
			this.$socket.on('reponseenvoyee', () => {
				this.chargement = false
				this.texte = ''
			})

			this.$socket.on('nuageaffiche', (reponses) => {
				this.definirNuage(reponses)
				this.modale = 'nuage'
			})

			this.$socket.on('nuagemasque', () => {
				this.nuage = []
				if (this.modale === 'nuage') {
					this.modale = ''
				}
			})
		}
	}
}
</script>

<style scoped src="#root/components/css/style-participer.css"></style>

<style scoped>
#mot .conteneur-textarea {
	position: relative;
	min-height: 46px;
	max-height: 124px;
}

#mot .conteneur-textarea > textarea {
	display: block;
	width: 100%;
	font-weight: 400;
	font-size: 16px;
	text-align: left;
	border-radius: 4px;
	cursor: text;
	background: #fff;
	resize: none;
	max-width: 100%;
	border: 1px solid #ddd;
	padding: 10px 15px;
}

#mots > h3 {
	font-size: 16px;
	font-weight: 700;
	display: block;
	margin: 20px 0 10px;
}

#mot .actions {
	text-align: center;
	margin-top: 5px;
}

#mot .bouton {
	display: inline-block;
	font-weight: 700;
	font-size: 18px;
	text-transform: uppercase;
	height: 40px;
	line-height: 40px;
	padding: 0 50px;
	cursor: pointer;
	color: #fff;
	text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.3);
	background: #009688;
	border-radius: 2em;
	letter-spacing: 1px;
	text-indent: 1px;
	transition: all 0.1s ease-in;
}

#mot .bouton:hover {
	background: #00a695;
}

#mot .bouton.desactive:hover,
#mot .bouton.desactive {
	background: #aaa!important;
}

#mot .conteneur-textarea + .actions {
	margin-top: 20px;
}

#mots {
	margin-top: 40px;
	margin-bottom: 30px;
}

#mots ul {
	padding: 5px 0 0;
}

#mots li {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 5px 10px;
	background: #eee;
	border-radius: 4px;
	margin-bottom: 10px;
	font-size: 16px;
	font-weight: 400;
}

#modale-nuage {
	height: 90%;
	width: 95%;
	max-width: 95%;
}

#modale-nuage .conteneur,
#modale-nuage .contenu {
	height: 100%;
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
