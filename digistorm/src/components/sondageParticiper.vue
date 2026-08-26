<template>
	<div id="sondage">
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

					<div :id="'items' + indexQ" class="items" v-if="q.option === 'choix-unique' || q.option === 'choix-multiples'">
						<template v-for="(item, index) in q.items">
							<label :id="'item' + indexQ + '_' + index" class="item" :tabindex="tabIndex" :aria-disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee'" :class="{'desactive': reponseEnvoyee[indexQ] === 'reponse-envoyee', 'audio-et-texte': verifierItemAudioTexte(item) === true, 'selectionne': verifierReponse(reponse[indexQ], item) === true}" v-if="verifierItem(item) === true" @keydown.enter.space.prevent="activerInput('item' + indexQ + '_' + index + ' input')" :key="'item_' + indexQ + '_' + index">
								<input type="radio" name="item" :value="item.texte" @change="definirReponse($event, indexQ)" :disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee'" style="display: none;" v-if="q.option === 'choix-unique' && item.texte !== ''">

								<input type="checkbox" name="item" :value="item.texte" @change="definirReponse($event, indexQ)" :disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee'" style="display: none;" v-else-if="q.option === 'choix-multiples' && item.texte !== ''">

								<input type="radio" name="item" :value="item.image" @change="definirReponse($event, indexQ)" :disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee'" style="display: none;" v-else-if="q.option === 'choix-unique' && item.image && item.image !== ''">

								<input type="checkbox" name="item" :value="item.image" @change="definirReponse($event, indexQ)" :disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee'" style="display: none;" v-else-if="q.option === 'choix-multiples' && item.image && item.image !== ''">

								<input type="radio" name="item" :value="item.audio" @change="definirReponse($event, indexQ)" :disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee'" style="display: none;" v-else-if="q.option === 'choix-unique' && item.audio && item.audio !== ''">

								<input type="checkbox" name="item" :value="item.audio" @change="definirReponse($event, indexQ)" :disabled="disabled || reponseEnvoyee[indexQ] === 'reponse-envoyee'" style="display: none;" v-else-if="q.option === 'choix-multiples' && item.audio && item.audio !== ''">

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
					<div :id="'reponses' + indexQ" class="conteneur-textarea" v-else-if="q.option === 'texte-court'">
						<TextareaAutosize :rows="2" :min-height="46" :max-height="124" :placeholder="$t('votreReponse')" @input="definirReponse($event, indexQ)" v-if="indexQuestion === indexQ && reponseEnvoyee[indexQ] !== 'reponse-envoyee'" :disabled="disabled" />
						<div class="reponse-texte-court" v-if="indexQuestion === indexQ && reponseEnvoyee[indexQ] === 'reponse-envoyee'" v-html="definirReponseEnvoyee(indexQ)" />
					</div>
					<div :id="'etoiles' + indexQ" class="etoiles" v-else-if="q.option === 'etoiles'">
						<template v-if="indexQuestion === indexQ && reponseEnvoyee[indexQ] !== 'reponse-envoyee' && (!reponse[indexQ][0] || (reponse[indexQ][0] && reponse[indexQ][0] === null))">
							<button type="button" class="etoile" :disabled="disabled" :title="etoile > 1 ? etoile + ' ' + $t('etoilesP') : etoile + ' ' + $t('etoile')" :aria-label="etoile > 1 ? etoile + ' ' + $t('etoilesP') : etoile + ' ' + $t('etoile')" v-for="etoile in q.etoiles" @click="definirReponse(etoile, indexQ)" :key="'etoile_vide' + etoile"><i class="material-icons" aria-hidden="true">star_outline</i></button>
						</template>
						<template v-else-if="indexQuestion === indexQ && reponseEnvoyee[indexQ] !== 'reponse-envoyee' && reponse[indexQ][0] && reponse[indexQ][0] !== null">
							<button type="button" class="etoile selectionne" :disabled="disabled" :title="etoile > 1 ? etoile + ' ' + $t('etoilesP') : etoile + ' ' + $t('etoile')" :aria-label="etoile > 1 ? etoile + ' ' + $t('etoilesP') : etoile + ' ' + $t('etoile')" v-for="etoile in reponse[indexQ][0]" @click="definirReponse(etoile, indexQ)" :key="'etoile_' + etoile"><i class="material-icons" aria-hidden="true">star</i></button>
							<button type="button" class="etoile" :disabled="disabled" :title="etoile > 1 ? etoile + ' ' + $t('etoilesP') : etoile + ' ' + $t('etoile')" :aria-label="etoile > 1 ? etoile + ' ' + $t('etoilesP') : etoile + ' ' + $t('etoile')" v-for="etoile in (q.etoiles - reponse[indexQ][0])" @click="definirReponse(reponse[indexQ][0] + etoile, indexQ)" :key="'etoilevide_' + etoile"><i class="material-icons" aria-hidden="true">star_outline</i></button>
						</template>
						<template v-else-if="indexQuestion === indexQ && reponseEnvoyee[indexQ] === 'reponse-envoyee'">
							<i class="material-icons selectionne envoye" v-for="etoile in reponse[indexQ][0]" :key="'etoile_' + etoile">star</i>
							<i class="material-icons envoye" v-for="etoile in (q.etoiles - reponse[indexQ][0])" :key="'etoilevide_' + etoile">star_outline</i>
						</template>
					</div>

					<div :id="'actions' + indexQ" class="actions" v-if="options.progression === 'libre'">
						<button type="button" class="bouton bouton-reponse" :class="{'desactive': reponse[indexQ].length === 0}" :disabled="disabled || reponse[indexQ].length === 0" @click="envoyerReponse(indexQ)" v-if="statut !== 'verrouille' && reponseEnvoyee[indexQ] !== 'reponse-envoyee'">{{ $t('envoyer') }}</button>
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
	name: 'DigistormSondageParticiper',
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
		statut: String,
		session: Number,
		indexQuestion: Number,
		validation: String,
		reponseEnvoyee: Array,
		rechargement: Boolean
	},
	data () {
		return {
			description: '',
			support: {},
			options: {},
			questions: [],
			reponse: []
		}
	},
	watch: {
		validation (valeur) {
			if (this.options.progression === 'animateur' && valeur === 'validation' && this.reponse[this.indexQuestion].length > 0) {
				this.$emit('validation', { reponse: this.reponse, identifiant: this.identifiant, nom: this.nom })
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
			const question = this.questions[indexQuestion]
			if (question && question.option === 'texte-court' && this.reponseEnvoyee[indexQuestion] !== 'reponse-envoyee') {
				this.$nextTick(() => {
					document.querySelector('#reponses' + indexQuestion + ' textarea')?.focus()
				})
			} else if (question && (question.option === 'choix-unique' || question.option === 'choix-multiples') && this.reponseEnvoyee[indexQuestion] !== 'reponse-envoyee') {
				this.$nextTick(() => {
					document.querySelector('#items' + indexQuestion + ' label')?.focus()
				})
			} else if (question && question.option === 'etoiles' && this.reponseEnvoyee[indexQuestion] !== 'reponse-envoyee') {
				this.$nextTick(() => {
					document.querySelector('#etoiles' + indexQuestion + ' .etoile')?.focus()
				})
			} else if (this.reponseEnvoyee[indexQuestion] === 'reponse-envoyee') {
				this.$nextTick(() => {
					document.querySelector('#actions' + indexQuestion + ' button')?.focus()
				})
			}
		}
	},
	created () {
		this.description = this.donnees.description
		this.support = this.donnees.support
		this.options = this.donnees.options
		this.questions = this.donnees.questions
		this.reponses.forEach((item) => {
			if (item.identifiant === this.identifiant) {
				this.reponse = item.reponse
			}
		})
		if (this.reponse.length === 0) {
			this.questions.forEach(() => {
				this.reponse.push([])
			})
		}
	},
	methods: {
		envoyerReponse (indexQuestion) {
			if (this.reponse[indexQuestion].length > 0 && this.reponseEnvoyee[indexQuestion] !== 'reponse-envoyee') {
				this.$emit('validation', { reponse: this.reponse, identifiant: this.identifiant, nom: this.nom, indexQuestion: indexQuestion })
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

#questions .etoiles {
	display: flex;
	justify-content: center;
	font-size: 6rem;
	text-align: center;
	margin-bottom: 20px;
	margin-top: 40px;
	line-height: 1;
}

#questions .etoiles button.etoile {
	background: none;
	border: none;
	padding: 0;
	cursor: pointer;
	font-size: inherit;
	line-height: 1;
	color: #aaa;
}

#questions .etoiles button.etoile.selectionne {
	color: #fdcc33;
}

#questions .etoiles i {
	color: #aaa;
	line-height: 1;
}

#questions .etoiles i.selectionne {
	color: #fdcc33;
}

#questions .etoiles i.envoye {
	cursor: default;
}

@media screen and (max-width: 359px) {
	#questions .etoiles {
		font-size: 3rem;
	}
}

@media screen and (min-width: 360px) and (max-width: 399px) {
	#questions .etoiles {
		font-size: 3.5rem;
	}
}

@media screen and (min-width: 400px) and (max-width: 499px) {
	#questions .etoiles {
		font-size: 3.8rem;
	}
}

@media screen and (min-width: 500px) and (max-width: 599px) {
	#questions .etoiles {
		font-size: 4.8rem;
	}
}
</style>
