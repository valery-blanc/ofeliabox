<template>
	<div id="nuage-de-mots">
		<div id="parametres" class="section">
			<h2>{{ $t('parametres') }}</h2>
			<div class="conteneur-parametres" role="form" :aria-label="$t('parametres')">
				<div class="parametre">
					<h3>{{ $t('casseEtAccents') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('casseEtAccents') + ' ' + $t('oui')" @keydown.enter.space.prevent="activerInput('casse-oui')">{{ $t('oui') }}
						<input id="casse-oui" type="radio" name="casse" :checked="options.casse === true" :disabled="disabled" @change="modifierParametres('casse', true)">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('casseEtAccents') + ' ' + $t('non')" @keydown.enter.space.prevent="activerInput('casse-non')">{{ $t('non') }}
						<input id="casse-non" type="radio" name="casse" :checked="options.casse === false" :disabled="disabled" @change="modifierParametres('casse', false)">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre">
					<h3>{{ $t('nomOuPseudo') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('nomOuPseudo') + ' ' + $t('obligatoire')" @keydown.enter.space.prevent="activerInput('nom-obligatoire')">{{ $t('obligatoire') }}
						<input id="nom-obligatoire" type="radio" name="nom" :checked="options.nom === 'obligatoire'" :disabled="disabled" @change="modifierParametres('nom', 'obligatoire')">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('nomOuPseudo') + ' ' + $t('aleatoire')" @keydown.enter.space.prevent="activerInput('nom-aleatoire')">{{ $t('aleatoire') }}
						<input id="nom-aleatoire" type="radio" name="nom" :checked="options.nom === 'aleatoire'" :disabled="disabled" @change="modifierParametres('nom', 'aleatoire')">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('nomOuPseudo') + ' ' + $t('facultatif')" @keydown.enter.space.prevent="activerInput('nom-facultatif')">{{ $t('facultatif') }}
						<input id="nom-facultatif" type="radio" name="nom" :checked="options.nom === 'facultatif'" :disabled="disabled" @change="modifierParametres('nom', 'facultatif')">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre">
					<h3>{{ $t('nombreReponsesLimite') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('nombreReponsesLimite') + ' ' + $t('oui')" @keydown.enter.space.prevent="activerInput('reponses-limitees-oui')">{{ $t('oui') }}
						<input id="reponses-limitees-oui" type="radio" name="reponses" :checked="options.messagesLimites === true" :disabled="disabled" @change="modifierParametres('messagesLimites', true)">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('nombreReponsesLimite') + ' ' + $t('non')" @keydown.enter.space.prevent="activerInput('reponses-limitees-non')">{{ $t('non') }}
						<input id="reponses-limitees-non" type="radio" name="reponses" :checked="options.messagesLimites === false" :disabled="disabled" @change="modifierParametres('messagesLimites', false)">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre" v-if="options.messagesLimites === true">
					<h3>{{ $t('nombreMaximumReponses') }}</h3>
					<input type="number" name="nombre-reponses" :value="options.messages" :min="1" :disabled="disabled" @change="modifierParametres('messages', parseInt($event.target.value))">
				</div>
			</div>
		</div>

		<div id="question" class="section">
			<h2>{{ $t('question') }}</h2>
			<div class="question">
				<div class="conteneur-textarea" :class="{'media': Object.keys(support).length > 0}">
					<TextareaAutosize v-model="question" :rows="1" :min-height="46" :max-height="94" :placeholder="$t('question')" :disabled="disabled" />
				</div>
				<span class="actions" v-if="chargement === 'support'">
					<span class="conteneur-chargement">
						<span class="chargement" />
						<span class="progression">{{ progression }} %</span>
					</span>
				</span>
				<span class="actions" v-else-if="chargement !== 'support' && Object.keys(support).length === 0">
					<button type="button" :disabled="disabled" :title="$t('ajouterSupport')" :aria-label="$t('ajouterSupport')" @click="afficherAjouterMedia"><i class="material-icons" aria-hidden="true">library_add</i></button>
				</span>
				<button type="button" class="actions media" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="chargement !== 'support' && Object.keys(support).length > 0 && support.lien && support.lien !== ''" @click="afficherMedia(support.lien, '', 'video')" :style="{'background-image': 'url(' + support.vignette + ')'}" />
				<button type="button" class="actions media" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="chargement !== 'support' && Object.keys(support).length > 0 && support.fichier && support.fichier !== '' && support.type === 'image'" @click="afficherMedia(definirCheminFichier(support.fichier), support.alt, 'image')" :style="{'background-image': 'url(' + definirCheminFichier(support.fichier) + ')'}"></button>
				<button type="button" class="actions media audio" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="chargement !== 'support' && Object.keys(support).length > 0 && support.fichier && support.fichier !== '' && support.type === 'audio'" @click="afficherMedia(definirCheminFichier(support.fichier), '', 'audio')">
					<span><i class="material-icons" aria-hidden="true">graphic_eq</i></span>
				</button>
			</div>
		</div>

		<div class="conteneur-modale" v-if="modale === 'ajouter-media' || modale === 'media'">
			<div id="modale-ajouter-media" class="modale" role="dialog" v-if="modale === 'ajouter-media'">
				<header>
					<span class="titre">{{ $t('ajouterMedia') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleAjouterMedia"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('ajouterMedia')" v-if="chargement !== 'support'">
						<label for="champ-lien-video">{{ $t('lienVideo') }}</label>
						<div class="valider">
							<input id="champ-lien-video" type="text" v-model="lien" :disabled="disabledModale" @keydown.enter="ajouterVideo">
							<button type="button" class="bouton-secondaire" :disabled="disabledModale" :title="$t('valider')" :aria-label="$t('valider')" @click="ajouterVideo"><i class="material-icons" aria-hidden="true">search</i></button>
						</div>
						<div class="separateur"><span>{{ $t('ou') }}</span></div>
						<label>{{ $t('fichierImageAudio') }}</label>
						<label for="selectionner-media" class="bouton" :tabindex="tabIndexModale" :aria-disabled="disabledModale" @keydown.enter.space.prevent="activerInput('selectionner-media')">{{ $t('selectionnerFichier') }}</label>
						<input id="selectionner-media" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif, .mp3, .wav, .m4a, .ogg" :disabled="disabledModale" @change="televerserMedia">
					</div>
					<div class="contenu" v-else>
						<div class="conteneur-chargement">
							<div class="chargement" />
						</div>
					</div>
				</div>
			</div>
			<div id="modale-media" class="modale" role="dialog" v-else-if="modale === 'media'">
				<header>
					<span class="titre" />
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleMedia"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu">
						<img v-if="media.type === 'image'" :src="media.fichier" :alt="media.alt">
						<audio v-else-if="media.type === 'audio'" controls :src="media.fichier" />
						<div class="video" v-else-if="media.type === 'video'">
							<iframe :src="media.lien" allow="autoplay; fullscreen" />
						</div>
						<div class="texte-alt" v-if="media.type === 'image'">
							<label>{{ $t('texteAlternatif') }}</label>
							<div class="champ-texte-alt">
								<TextareaAutosize v-model="alt" :rows="1" :min-height="36" :max-height="72" :disabled="disabledModale" />
							</div>
						</div>
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="afficherAjouterMedia">{{ $t('modifier') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="supprimerMedia">{{ $t('supprimer') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleMedia">{{ $t('fermer') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import axios from 'axios'
import methodes from '#root/components/js/methodes-creer'
import TextareaAutosize from '#root/components/textareaAutosize.vue'

export default {
	name: 'DigistormNuageMotsCreer',
	inject: ['parent'],
	components: {
		TextareaAutosize
	},
	extends: methodes,
	props: {
		hote: String,
		code: String,
		donnees: Object,
		enregistrement: String
	},
	data () {
		return {
			question: '',
			support: {},
			options: {
				casse: false,
				nom: 'facultatif',
				messagesLimites: false,
				messages: 10
			},
			chargement: '',
			modale: '',
			lien: '',
			media: {},
			medias: [],
			alt: '',
			corbeille: [],
			progression: 0,
			elementPrecedent: null
		}
	},
	watch: {
		enregistrement (valeur) {
			if (valeur === 'enregistrement' || valeur === 'lancement') {
				if (Object.keys(this.support).length > 0 && this.medias.includes(this.support.fichier)) {
					const index = this.medias.indexOf(this.support.fichier)
					this.medias.splice(index, 1)
				}
				this.corbeille.push(...this.medias.filter((fichier) => !this.corbeille.includes(fichier)))
				this.$emit('enregistrement', { question: this.question, support: this.support, options: this.options })
			} else if (valeur === 'termine') {
				this.viderCorbeille()
			}
		}
	},
	created () {
		if (Object.keys(this.donnees).length > 0) {
			this.question = this.donnees.question
			this.support = this.donnees.support
			if (this.donnees.hasOwnProperty('options')) {
				this.options = this.donnees.options
				if (!this.options.hasOwnProperty('nom')) {
					this.options.nom = 'facultatif'
				}
				if (this.options.hasOwnProperty('casse') && this.options.casse === 'oui') {
					this.options.casse = true
				} else if (this.options.hasOwnProperty('casse') && this.options.casse === 'non') {
					this.options.casse = false
				}
				if (!this.options.hasOwnProperty('messagesLimites')) {
					this.options.messagesLimites = false
				}
				if (!this.options.hasOwnProperty('messages')) {
					this.options.messages = 10
				}
			}
		}
	},
	mounted () {
		this.$nextTick(() => {
			if (this.question === '') {
				document.querySelector('#question textarea')?.focus()
			}
		})

		document.addEventListener('keydown', this.gererClavier, false)

		window.addEventListener('beforeunload', this.quitterPage, false)
	},
	beforeUnmount () {
		document.removeEventListener('keydown', this.gererClavier, false)
	},
	methods: {
		modifierParametres (type, valeur) {
			this.options[type] = valeur
		},
		viderCorbeille () {
			axios.post(this.hote + '/api/supprimer-fichiers', {
				code: this.code,
				fichiers: this.corbeille
			}).then(() => {
				this.corbeille = []
				this.medias = []
			})
		},
		quitterPage () {
			if (this.medias.length > 0) {
				axios.post(this.hote + '/api/supprimer-fichiers', {
					code: this.code,
					fichiers: this.medias
				})
			}
		}
	}
}
</script>

<style scoped src="#root/components/css/style-creer.css"></style>
