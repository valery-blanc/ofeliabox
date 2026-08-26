<template>
	<div id="questionnaire">
		<div id="progression" v-if="indexQuestion > -1 && questions.length > 1">
			{{ $t('question') }} {{ indexQuestion + 1 }} / {{ questions.length }}
		</div>
		<div id="progression" v-else-if="indexQuestion === -1 && description !=='' && Object.keys(support).length === 0">
			{{ $t('description') }}
		</div>
		<div id="progression" v-else-if="indexQuestion === -1 && description !=='' && Object.keys(support).length > 0">
			{{ $t('descriptionEtSupport') }}
		</div>

		<div id="support" v-if="indexQuestion > -1 && Object.keys(support).length > 0">
			<button type="button" class="bouton" :disabled="disabled" @click="afficherSupport">{{ $t('afficherSupport') }}</button>
		</div>

		<div id="description" v-if="description !== '' || Object.keys(support).length > 0" v-show="indexQuestion === -1">
			<div class="description" v-if="description !== ''" v-html="formaterHTML(description)" />
			<div class="support" v-if="Object.keys(support).length > 0">
				<button type="button" class="support" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" v-if="support.type === 'image'" @click="afficherImage($event, definirCheminFichier(support.fichier), support.alt)"><img :src="definirCheminFichier(support.fichier)" :alt="support.alt"></button>
				<audio v-else-if="support.type === 'audio'" controls :src="definirCheminFichier(support.fichier)" />
				<div class="video" v-else-if="support.type === 'video'">
					<iframe :src="support.lien" allow="autoplay; fullscreen" />
				</div>
			</div>
		</div>

		<div id="questions" aria-live="polite" :class="{'avec-progression': indexQuestion > -1 && questions.length > 1}">
			<TransitionGroup name="fondu">
				<div :id="'q' + indexQ" class="q" v-for="(q, indexQ) in questions" v-show="indexQuestion === indexQ" :key="'q_' + indexQ">
					<div :id="'question' + indexQ">
						<div class="question-et-image" v-if="q.question !== '' && Object.keys(q.support).length > 0 && q.support.image && q.support.image !== ''">
							<span class="question" v-html="formaterHTML(q.question)" />
							<button type="button" class="support" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(q.support.image), q.support.alt)"><img :src="definirCheminFichier(q.support.image)" :alt="q.support.alt"></button>
						</div>
						<div class="question-et-audio" v-else-if="q.question !== '' && Object.keys(q.support).length > 0 && q.support.audio && q.support.audio !== ''">
							<div class="question" v-html="formaterHTML(q.question)" />
							<audio controls :src="definirCheminFichier(q.support.audio)" />
						</div>
						<div class="question" v-else-if="q.question !== ''" v-html="formaterHTML(q.question)" />
						<div class="support" v-else-if="Object.keys(q.support).length > 0">
							<button type="button" class="support" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" v-if="q.support.image && q.support.image !== ''" @click="afficherImage($event, definirCheminFichier(q.support.image), q.support.alt)"><img :src="definirCheminFichier(q.support.image)" :alt="q.support.alt"></button>
							<audio controls :src="definirCheminFichier(q.support.audio)" v-else-if="q.support.audio && q.support.audio !== ''" />
						</div>
					</div>

					<div :id="'items' + indexQ" class="items" v-if="q.option !== 'texte-court'">
						<template v-for="(item, index) in q.items">
							<label :id="'item' + indexQ + '_' + index" class="item" :tabindex="tabIndex" :aria-disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee' || tempsEcoule" :class="{'desactive': reponseEnvoyee[indexQ] === 'reponse-envoyee' || tempsEcoule, 'correct': (options.reponses === 'oui' || options.reponses === 'utilisateur') && donneesSession[indexQ] && verifierItemCorrect(donneesSession[indexQ].itemsCorrects, item) === true && reponseEnvoyee[indexQ] === 'reponse-envoyee', 'audio-et-texte': verifierItemAudioTexte(item) === true, 'selectionne': verifierReponse(reponse[indexQ], item) === true}" @keydown.enter.space.prevent="activerInput('item' + indexQ + '_' + index + ' input')" v-if="verifierItem(item) === true" :key="'item_' + indexQ + '_' + index">
								<input type="radio" name="item" :value="item.texte" @change="definirReponse($event, indexQ)" :disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee' || tempsEcoule" style="display: none;" v-if="q.option === 'choix-unique' && item.texte !== ''">

								<input type="checkbox" name="item" :value="item.texte" @change="definirReponse($event, indexQ)" :disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee' || tempsEcoule" style="display: none;" v-else-if="q.option === 'choix-multiples' && item.texte !== ''">

								<input type="radio" name="item" :value="item.image" @change="definirReponse($event, indexQ)" :disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee' || tempsEcoule" style="display: none;" v-else-if="q.option === 'choix-unique' && item.image && item.image !== ''">

								<input type="checkbox" name="item" :value="item.image" @change="definirReponse($event, indexQ)" :disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee' || tempsEcoule" style="display: none;" v-else-if="q.option === 'choix-multiples' && item.image && item.image !== ''">

								<input type="radio" name="item" :value="item.audio" @change="definirReponse($event, indexQ)" :disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee' || tempsEcoule" style="display: none;" v-else-if="q.option === 'choix-unique' && item.audio && item.audio !== ''">

								<input type="checkbox" name="item" :value="item.audio" @change="definirReponse($event, indexQ)" :disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee' || tempsEcoule" style="display: none;" v-else-if="q.option === 'choix-multiples' && item.audio && item.audio !== ''">

								<span class="icone material-icons" v-if="q.option === 'choix-unique' && verifierReponse(reponse[indexQ], item) === false">radio_button_unchecked</span>

								<span class="icone material-icons" v-else-if="q.option === 'choix-multiples' && verifierReponse(reponse[indexQ], item) === false">check_box_outline_blank</span>

								<span class="icone material-icons" v-else-if="q.option === 'choix-unique' && verifierReponse(reponse[indexQ], item) === true">radio_button_checked</span>

								<span class="icone material-icons" v-else-if="q.option === 'choix-multiples' && verifierReponse(reponse[indexQ], item) === true">check_box</span>

								<button type="button" class="image" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" v-if="item.image && item.image !== ''" @click="afficherImage($event, definirCheminFichier(item.image), item.alt)" @keydown.enter.space.stop><img :src="definirCheminFichier(item.image)" :alt="item.alt"></button>

								<span class="audio" v-else-if="item.audio && item.audio !== ''"><audio controls :src="definirCheminFichier(item.audio)" /></span>

								<span class="texte" v-if="item.texte !== ''">{{ item.texte }}</span>
							</label>
						</template>
					</div>
					<div :id="'reponses' + indexQ" class="conteneur-textarea" :class="{'reponse-envoyee': reponseEnvoyee[indexQ] === 'reponse-envoyee', 'correct': reponseCorrecte === true}" v-else>
						<TextareaAutosize :rows="2" :min-height="46" :max-height="124" :placeholder="$t('votreReponse')" :disabled="disabled" @input="definirReponse($event, indexQ)" v-if="indexQuestion === indexQ && reponseEnvoyee[indexQ] !== 'reponse-envoyee'" />
						<div class="reponse-texte-court" v-if="indexQuestion === indexQ && reponseEnvoyee[indexQ] === 'reponse-envoyee'" v-html="definirReponseEnvoyee(indexQ)" />
					</div>

					<div class="retroaction" v-if="(options.reponses === 'oui' || options.reponses === 'utilisateur') && options.retroaction === true && retroaction !== '' && reponseEnvoyee[indexQ] === 'reponse-envoyee'">
						<span v-html="formaterHTML(retroaction)" />
					</div>

					<div :id="'actions' + indexQ" class="actions" v-if="options.progression === 'libre'">
						<button type="button" class="bouton bouton-reponse" :disabled="disabled || reponse[indexQ].length === 0" :class="{'desactive': reponse[indexQ].length === 0}" @click="envoyerReponse(indexQ)" v-if="statut !== 'verrouille' && reponseEnvoyee[indexQ] !== 'reponse-envoyee'">{{ $t('envoyer') }}</button>
						<button type="button" class="bouton bouton-reponse desactive" disabled v-else-if="statut === 'verrouille' && reponseEnvoyee[indexQ] !== 'reponse-envoyee'">{{ $t('envoyer') }}</button>
						<button type="button" class="bouton" :disabled="disabled" @click="modifierIndexQuestion" v-if="statut !== 'verrouille' && reponseEnvoyee[indexQ] === 'reponse-envoyee' && reponse[indexQ + 1] && reponse[indexQ + 1].length === 0">{{ $t('questionSuivante') }}</button>
						<button type="button" class="bouton desactive" disabled v-else-if="statut === 'verrouille' && reponseEnvoyee[indexQ] === 'reponse-envoyee' && reponse[indexQ + 1] && reponse[indexQ + 1].length === 0">{{ $t('questionSuivante') }}</button>
					</div>
				</div>
			</TransitionGroup>
		</div>
	</div>
</template>

<script>
import TextareaAutosize from '#root/components/textareaAutosize.vue'
import methodes from '#root/components/js/methodes-participer'

export default {
	name: 'DigistormQuestionnaireParticiper',
	inject: ['parent'],
	components: {
		TextareaAutosize
	},
	extends: methodes,
	props: {
		identifiant: String,
		nom: String,
		code: String,
		donnees: Object,
		reponses: Array,
		donneesSession: Array,
		statut: String,
		session: Number,
		indexQuestion: Number,
		date: Number,
		validation: String,
		reponseEnvoyee: Array,
		tempsEcoule: Boolean,
		rechargement: Boolean
	},
	data () {
		return {
			description: '',
			support: {},
			options: {},
			questions: [],
			reponse: [],
			temps: [],
			reponseCorrecte: false,
			retroaction: ''
		}
	},
	watch: {
		validation (valeur) {
			if (this.options.progression === 'animateur' && valeur === 'validation' && this.options.points === 'classique' && this.reponse[this.indexQuestion].length > 0) {
				this.$emit('validation', { reponse: this.reponse, identifiant: this.identifiant, nom: this.nom })
			} else if (this.options.progression === 'animateur' && valeur === 'validation' && this.options.points !== 'classique' && this.reponse[this.indexQuestion].length > 0) {
				const temps = Math.abs((new Date().getTime() - this.date) / 1000)
				this.temps[this.indexQuestion] = temps
				this.$emit('validation', { reponse: this.reponse, temps: this.temps, identifiant: this.identifiant, nom: this.nom })
			} else {
				this.parent.validation = ''
			}
		},
		reponseEnvoyee: {
			handler (reponse) {
				if (reponse[this.indexQuestion] === 'reponse-envoyee' && this.options.progression === 'libre' && this.parent.notification === '' && !this.rechargement) {
					this.parent.notification = this.$t('reponseEnvoyee')
				}
			},
			deep: true
		},
		indexQuestion (indexQuestion) {
			if (indexQuestion > - 1 && this.reponseEnvoyee[indexQuestion] === 'reponse-envoyee' && this.donneesSession[indexQuestion]) {
				this.reponseCorrecte = this.donneesSession[indexQuestion].reponseCorrecte
				if (this.donneesSession[indexQuestion].retroaction !== '') {
					this.retroaction = this.donneesSession[indexQuestion].retroaction
				}
			} else {
				this.reponseCorrecte = false
				this.retroaction = ''
			}
			const question = this.questions[indexQuestion]
			if (question && question.option === 'texte-court' && this.reponseEnvoyee[indexQuestion] !== 'reponse-envoyee') {
				this.$nextTick(() => {
					document.querySelector('#reponses' + indexQuestion + ' textarea')?.focus()
				})
			} else if (question && (question.option === 'choix-unique' || question.option === 'choix-multiples') && this.reponseEnvoyee[indexQuestion] !== 'reponse-envoyee') {
				this.$nextTick(() => {
					document.querySelector('#items' + indexQuestion + ' label')?.focus()
				})
			} else if (this.reponseEnvoyee[indexQuestion] === 'reponse-envoyee') {
				this.$nextTick(() => {
					document.querySelector('#actions' + indexQuestion + ' button')?.focus()
				})
			}
		},
		donneesSession: {
			handler (donneesSession) {
				if (this.indexQuestion > - 1 && this.reponseEnvoyee[this.indexQuestion] === 'reponse-envoyee' && donneesSession[this.indexQuestion]) {
					this.reponseCorrecte = donneesSession[this.indexQuestion].reponseCorrecte
					if (donneesSession[this.indexQuestion].retroaction !== '') {
						this.retroaction = donneesSession[this.indexQuestion].retroaction
					}
				}
			},
			deep: true
		}
	},
	created () {
		this.description = this.donnees.description
		this.support = this.donnees.support
		this.options = this.donnees.options
		if (!this.options.hasOwnProperty('points')) {
			this.options.points = 'classique'
		}
		if (this.options.reponses === true) {
			this.options.reponses = 'oui'
		} else if (this.options.reponses === false) {
			this.options.reponses = 'non'
		}
		this.questions = this.donnees.questions
		this.reponses.forEach((item) => {
			if (item.identifiant === this.identifiant) {
				this.reponse = item.reponse
				if (item.hasOwnProperty('temps')) {
					this.temps = item.temps
				}
			}
		})
		if (this.reponse.length === 0) {
			this.questions.forEach(() => {
				this.reponse.push([])
				this.temps.push([])
			})
		}
		if (this.donneesSession[this.indexQuestion]) {
			this.reponseCorrecte = this.donneesSession[this.indexQuestion].reponseCorrecte
			if (this.donneesSession[this.indexQuestion].retroaction !== '') {
				this.retroaction = this.donneesSession[this.indexQuestion].retroaction
			}
		}
	},
	methods: {
		envoyerReponse (indexQuestion) {
			if (this.reponse[indexQuestion].length > 0 && this.reponseEnvoyee[indexQuestion] !== 'reponse-envoyee' && this.options.points === 'classique') {
				this.$emit('validation', { reponse: this.reponse, identifiant: this.identifiant, nom: this.nom, indexQuestion: indexQuestion })
			} else if (this.reponse[indexQuestion].length > 0 && this.reponseEnvoyee[indexQuestion] !== 'reponse-envoyee' && this.options.points !== 'classique') {
				const temps = Math.abs((new Date().getTime() - this.date) / 1000)
				this.temps[indexQuestion] = temps
				this.$emit('validation', { reponse: this.reponse, temps: this.temps, identifiant: this.identifiant, nom: this.nom, indexQuestion: indexQuestion })
			}
		}
	}
}
</script>

<style scoped src="#root/components/css/style-multi-participer.css"></style>

<style>
#description .description a,
#questions .question a {
	color: #00a1e3;
  	text-decoration: underline;
}

#questions .retroaction span a {
	text-decoration: underline;
}
</style>
