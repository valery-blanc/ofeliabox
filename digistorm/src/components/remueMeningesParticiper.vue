<template>
	<div id="remue-meninges">
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

		<div id="message">
			<div class="conteneur-textarea">
				<TextareaAutosize v-model="texte" :rows="2" :min-height="46" :max-height="124" :placeholder="$t('votreMessage')" :disabled="disabled" />
			</div>
			<div id="categories" v-if="categories.length > 0">
				<h3>{{ $t('categorie') }}</h3>
				<div id="conteneur-categories" v-if="categories.length > 0">
					<template v-for="(cat, indexCat) in categories">
						<label class="bouton-radio avec-image" v-if="cat.texte !== '' && cat.image !== ''" :tabindex="tabIndex" :aria-disabled="disabled" @keydown.enter.space.prevent="activerInput('categorie_texte_image_' + indexCat)" :key="'categorie_texte_image_' + indexCat">
							<input :id="'categorie_texte_image_' + indexCat" type="radio" name="categorie" :checked="categorie === cat.texte" :disabled="disabled" @change="categorie = cat.texte">
							<span class="image"><button type="button" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(cat.image), cat.alt)" @keydown.enter.space.stop><img :src="definirCheminFichier(cat.image)" :alt="cat.alt" :style="{'border': '2px solid' + couleurs[indexCat]}"></button></span><span class="texte" :style="{'color': couleurs[indexCat]}">{{ cat.texte }}</span>
							<span class="coche" />
						</label>

						<label class="bouton-radio" v-else-if="cat.texte !== ''" :style="{'color': couleurs[indexCat]}" :tabindex="tabIndex" :aria-disabled="disabled" @keydown.enter.space.prevent="activerInput('categorie_texte_' + indexCat)" :key="'categorie_texte_' + indexCat">{{ cat.texte }}
							<input :id="'categorie_texte_' + indexCat" type="radio" name="categorie" :checked="categorie === cat.texte" :disabled="disabled" @change="categorie = cat.texte">
							<span class="coche" />
						</label>

						<label class="bouton-radio avec-image" v-else-if="cat.image !== ''" :tabindex="tabIndex" :aria-disabled="disabled" @keydown.enter.space.prevent="activerInput('categorie_image_' + indexCat)" :key="'categorie_image_' + indexCat">
							<input :id="'categorie_image_' + indexCat" type="radio" name="categorie" :checked="categorie === cat.image" :disabled="disabled" @change="categorie = cat.image">
							<span class="image"><button type="button" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(cat.image), cat.alt)" @keydown.enter.space.stop><img :src="definirCheminFichier(cat.image)" :alt="cat.alt" :style="{'border': '2px solid' + couleurs[indexCat]}"></button></span>
							<span class="coche" />
						</label>
					</template>
				</div>
			</div>
			<div class="actions">
				<button type="button" class="bouton" :class="{'desactive': statut === 'verrouille'}" :disabled="disabled || statut === 'verrouille'" @click="envoyerReponse">{{ $t('envoyer') }}</button>
			</div>
		</div>

		<div id="messages" v-if="messages.length > 0">
			<h3 v-if="messages.length === 1">{{ $t('messageEnvoye') }}</h3>
			<h3 v-else>{{ $t('messagesEnvoyes') }}</h3>
			<ul v-if="categories.length > 0">
				<li v-for="(message, indexMessage) in messages" :style="{'color': definirCouleurCategorie(message.categorie), 'background': eclaircirCouleur(definirCouleurCategorie(message.categorie))}" :key="'message_' + indexMessage">
					<span v-if="message.visible">{{ message.texte }} <span v-if="message.hasOwnProperty('texteoriginal')"><del>{{ message.texteoriginal }}</del></span></span>
					<span v-else><del>{{ message.texte }}</del></span>
				</li>
			</ul>
			<ul v-else>
				<li v-for="(message, indexMessage) in messages" :key="'message_' + indexMessage">
					<span v-if="message.visible">{{ message.texte }} <span v-if="message.hasOwnProperty('texteoriginal')"><del>{{ message.texteoriginal }}</del></span></span>
					<span v-else><del>{{ message.texte }}</del></span>
				</li>
			</ul>
		</div>

		<Chargement v-if="chargement" />
	</div>
</template>

<script>
import Chargement from '#root/components/chargement.vue'
import TextareaAutosize from '#root/components/textareaAutosize.vue'
import methodes from '#root/components/js/methodes-participer'

export default {
	name: 'DigistormRemueMeningesParticiper',
	inject: ['parent'],
	components: {
		Chargement,
		TextareaAutosize
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
			categories: [],
			couleurs: ['#27ae60', '#2980b9', '#8e44ad', '#f39c12', '#d35400', '#b71540', '#535c68', '#273c75'],
			categorie: '',
			texte: ''
		}
	},
	computed: {
		messages () {
			const messages = []
			this.reponses.forEach((item) => {
				if (item.identifiant === this.identifiant && item.reponse.hasOwnProperty('texteoriginal')) {
					messages.push({ texte: item.reponse.texte, texteoriginal: item.reponse.texteoriginal, categorie: item.reponse.categorie, visible: item.reponse.visible })
				} else if (item.identifiant === this.identifiant) {
					messages.push({ texte: item.reponse.texte, categorie: item.reponse.categorie, visible: item.reponse.visible })
				}
			})
			return messages
		}
	},
	created () {
		this.ecouterSocket()
		this.question = this.donnees.question
		if (this.donnees.support.hasOwnProperty('image')) {
			this.support = { fichier: this.donnees.support.image, alt: this.donnees.support.alt, type: 'image' }
		} else {
			this.support = this.donnees.support
		}
		if (this.donnees.hasOwnProperty('options')) {
			this.options = this.donnees.options
		}
		this.categories = this.donnees.categories.filter((categorie) => {
			return categorie.texte !== '' || categorie.image !== ''
		})
		if (this.categories.length > 0 && this.categories[0].texte !== '') {
			this.categorie = this.categories[0].texte
		} else if (this.categories.length > 0 && this.categories[0].image !== '') {
			this.categorie = this.categories[0].image
		}
	},
	methods: {
		envoyerReponse () {
			if (this.options.messagesLimites === true && this.messages.length === parseInt(this.options.messages)) {
				this.parent.message = this.$t('nombreMaximumMessagesEnvoyes')
				return
			}
			const texte = this.texte.trim()
			let doublon = 0
			this.messages.forEach((message) => {
				if (this.categorie === message.categorie && (texte === message.texte || (message.hasOwnProperty('texteoriginal') && message.texteoriginal === texte))) {
					doublon++
				}
			})
			if (texte !== '' && doublon === 0) {
				this.chargement = true
				const id = Date.now().toString(36) + Math.random().toString(36).substring(2)
				this.$socket.emit('reponse', { code: this.code, session: this.session, donnees: { reponse: { id: id, texte: texte, categorie: this.categorie, visible: true }, identifiant: this.identifiant, nom: this.nom } })
				this.texte = ''
			}
		},
		definirCouleurCategorie (categorie) {
			let couleur
			this.categories.forEach((item, index) => {
				if (item.texte === categorie || item.image === categorie) {
					couleur = this.couleurs[index]
				}
			})
			return couleur
		},
		afficherMedia (event, media, alt, type) {
			this.$emit('media', event, media, alt, type)
		},
		eclaircirCouleur (hex) {
			if (!hex) {
				return 'transparent'
			}
			const r = parseInt(hex.slice(1, 3), 16)
			const v = parseInt(hex.slice(3, 5), 16)
			const b = parseInt(hex.slice(5, 7), 16)
			return 'rgba(' + r + ', ' + v + ', ' + b + ', ' + 0.1 + ')'
		},
		ecouterSocket () {
			this.$socket.on('reponseenvoyee', () => {
				this.chargement = false
				this.texte = ''
			})
		}
	}
}
</script>

<style scoped src="#root/components/css/style-participer.css"></style>

<style scoped>
#message .conteneur-textarea {
	position: relative;
	min-height: 46px;
	max-height: 124px;
	margin-bottom: 40px;
}

#message .conteneur-textarea > textarea {
	display: block;
	width: 100%;
	font-weight: 400;
	font-size: 2rem;
	text-align: left;
	border-radius: 4px;
	cursor: text;
	background: #fff;
	resize: none;
	max-width: 100%;
	border: 1px solid #ddd;
	padding: 10px 15px;
}

#messages > h3,
#categories > h3 {
	font-size: 16px;
	font-weight: 700;
	display: block;
	margin: 20px 0 10px;
}

#message .bouton-radio {
	font-weight: 400;
}

#message #conteneur-categories {
	display: inline-flex;
	justify-content: flex-start;
	align-items: center;
}

#message .bouton-radio.avec-image {
	display: inline-flex;
	justify-content: flex-start;
	align-items: center;
	height: 5rem;
}

#message .bouton-radio.avec-image .coche {
	top: 50%;
	margin-top: -11px;
}

#message .bouton-radio .image {
	display: flex;
	justify-content: flex-start;
	align-items: center;
	height: 5rem;
	max-width: 5rem;
}

#message .bouton-radio .image img {
	max-height: 5rem;
	max-width: 5rem;
	border-radius: 4px;
	cursor: zoom-in;
}

#message .bouton-radio .texte {
	margin-left: 5px;
}

#message .actions {
	text-align: center;
	margin-top: 5px;
}

#message .bouton {
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

#message .bouton:hover {
	background: #00a695;
}

#message .bouton.desactive:hover,
#message .bouton.desactive {
	background: #aaa!important;
}

#message #categories + .actions {
	margin-top: 10px;
}

#message .conteneur-textarea + .actions {
	margin-top: 20px;
}

#messages {
	margin-top: 40px;
	margin-bottom: 40px;
}

#messages ul {
	padding: 5px 0 0;
}

#messages li {
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
