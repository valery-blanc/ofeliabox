<template>
	<div id="remue-meninges">
		<div id="parametres" class="section">
			<h2>{{ $t('parametres') }}</h2>
			<div class="conteneur-parametres" role="form" :aria-label="$t('parametres')">
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
				<span class="actions" v-else-if="Object.keys(support).length === 0">
					<button type="button" :disabled="disabled" :title="$t('ajouterSupport')" :aria-label="$t('ajouterSupport')" @click="afficherAjouterMedia"><i class="material-icons" aria-hidden="true">library_add</i></button>
				</span>
				<button type="button" class="actions media" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="Object.keys(support).length > 0 && support.lien && support.lien !== ''" @click="afficherMedia(support.lien, '', 'video')" :style="{'background-image': 'url(' + support.vignette + ')'}" />
				<button type="button" class="actions media" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="Object.keys(support).length > 0 && support.fichier && support.fichier !== '' && support.type === 'image'" @click="afficherMedia(definirCheminFichier(support.fichier), support.alt, 'image')" :style="{'background-image': 'url(' + definirCheminFichier(support.fichier) + ')'}"></button>
				<button type="button" class="actions media audio" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="Object.keys(support).length > 0 && support.fichier && support.fichier !== '' && support.type === 'audio'" @click="afficherMedia(definirCheminFichier(support.fichier), '', 'audio')">
					<span><i class="material-icons" aria-hidden="true">graphic_eq</i></span>
				</button>
			</div>
		</div>

		<div id="categories" class="section">
			<h2>{{ $t('categories') }}</h2>
			<p>{{ $t('ajouterCategories') }}</p>
			<draggable class="categories" v-model="categories" draggable=".categorie" handle=".poignee" filter=".desactive" :animation="150" :scroll="true" :force-fallback="true">
				<div :id="'categorie' + index" class="categorie" v-for="(categorie, index) in categories" :key="'categorie_' + index">
					<span class="poignee" :class="{'desactive': chargement.substring(0, 5) === 'image' || categories.length === 1}">
						<i class="material-icons">drag_indicator</i>
					</span>
					<div class="conteneur-textarea" :class="{'image': categorie.image !== ''}">
						<TextareaAutosize v-model="categorie.texte" :rows="1" :min-height="46" :max-height="94" :placeholder="$t('categorie') + ' ' + (index + 1)" :disabled="disabled" />
					</div>
					<span class="actions" v-if="chargement === 'image' + index">
						<span class="conteneur-chargement">
							<span class="chargement" />
							<span class="progression">{{ progression }} %</span>
						</span>
						<button type="button" :disabled="disabled || categories.length === 1" :title="$t('supprimerCategorie')" :aria-label="$t('supprimerCategorie')" @click="supprimerCategorie(index)" :class="{'desactive': categories.length === 1}"><i class="material-icons" aria-hidden="true">delete</i></button>
					</span>
					<span class="actions" v-else-if="chargement !== 'image' + index && categorie.image === ''">
						<label :for="'televerser-image' + index" :tabindex="tabIndex" :aria-disabled="disabled" :title="$t('ajouterImage')" :aria-label="$t('ajouterImage')" @keydown.enter.space.prevent="activerInput('televerser-image' + index)"><i class="material-icons" aria-hidden="true">add_photo_alternate</i></label>
						<input :id="'televerser-image' + index" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif" :disabled="disabled" @change="televerserImage(index)">
						<button type="button" :disabled="disabled || categories.length === 1" :title="$t('supprimerCategorie')" :aria-label="$t('supprimerCategorie')" @click="supprimerCategorie(index)" :class="{'desactive': categories.length === 1}"><i class="material-icons" aria-hidden="true">delete</i></button>
					</span>
					<span class="actions" v-else-if="chargement !== 'image' + index && categorie.image !== ''">
						<button type="button" class="image" :disabled="disabled" @click="afficherImage(definirCheminFichier(categorie.image), categorie.alt, index)" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" :style="{'background-image': 'url(' + definirCheminFichier(categorie.image) + ')'}"></button>
						<button type="button" :disabled="disabled || categories.length === 1" :title="$t('supprimerCategorie')" :aria-label="$t('supprimerCategorie')" @click="supprimerCategorie(index)" :class="{'desactive': categories.length === 1}"><i class="material-icons" aria-hidden="true">delete</i></button>
					</span>
				</div>
			</draggable>

			<button type="button" id="ajouter" :disabled="disabled" :title="$t('ajouterCategorie')" :aria-label="$t('ajouterCategorie')" @click="ajouterCategorie" v-if="categories.length < 8"><i class="material-icons" aria-hidden="true">add_circle_outline</i></button>
		</div>

		<div class="conteneur-modale" v-if="modale === 'ajouter-media' || modale === 'media' || modale === 'image'">
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
							<button type="button" :disabled="disabledModale" :title="$t('valider')" :aria-label="$t('valider')" class="bouton-secondaire" @click="ajouterVideo"><i class="material-icons" aria-hidden="true">search</i></button>
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
					<div class="contenu" role="form" :aria-label="$t('modifierMedia')">
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
			<div id="modale-image" class="modale" role="dialog" v-else-if="modale === 'image'">
				<header>
					<span class="titre" />
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleImage"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('modifierImage')">
						<img :src="image" :alt="alt">
						<div class="texte-alt">
							<label>{{ $t('texteAlternatif') }}</label>
							<div class="champ-texte-alt">
								<TextareaAutosize v-model="alt" :rows="1" :min-height="36" :max-height="72" :disabled="disabledModale" />
							</div>
						</div>
						<div class="actions">
							<label :for="'televerser-image' + indexImage" class="bouton" :tabindex="tabIndexModale" :aria-disabled="disabledModale" @keydown.enter.space.prevent="activerInput('televerser-image' + indexImage)">{{ $t('modifier') }}</label>
							<input :id="'televerser-image' + indexImage" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif" :disabled="disabledModale" @change="televerserImage(indexImage)">
							<button type="button" class="bouton" :disabled="disabledModale" @click="supprimerImage(indexImage)">{{ $t('supprimer') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleImage">{{ $t('fermer') }}</button>
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
import { VueDraggableNext } from 'vue-draggable-next'

export default {
	name: 'DigistormRemueMeningesCreer',
	inject: ['parent'],
	components: {
		TextareaAutosize,
		draggable: VueDraggableNext
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
				nom: 'facultatif',
				messagesLimites: false,
				messages: 10
			},
			categories: [{ texte: '', image: '', alt: '' }, { texte: '', image: '', alt: '' }],
			chargement: '',
			modale: '',
			lien: '',
			media: {},
			medias: [],
			image: '',
			alt: '',
			indexImage: -1,
			corbeille: [],
			progression: 0,
			elementPrecedent: null
		}
	},
	watch: {
		enregistrement (valeur) {
			if (valeur === 'enregistrement' || valeur === 'lancement') {
				this.categories.forEach((categorie) => {
					if (categorie.image !== '' && this.medias.includes(categorie.image)) {
						const index = this.medias.indexOf(categorie.image)
						this.medias.splice(index, 1)
					}
				})
				if (Object.keys(this.support).length > 0 && this.medias.includes(this.support.fichier)) {
					const index = this.medias.indexOf(this.support.fichier)
					this.medias.splice(index, 1)
				}
				this.corbeille.push(...this.medias.filter((fichier) => !this.corbeille.includes(fichier)))
				this.$emit('enregistrement', { question: this.question, support: this.support, options: this.options, categories: this.categories })
			} else if (valeur === 'termine') {
				this.viderCorbeille()
			}
		}
	},
	created () {
		if (Object.keys(this.donnees).length > 0) {
			this.question = this.donnees.question
			if (this.donnees.support.hasOwnProperty('image')) {
				this.support = { fichier: this.donnees.support.image, alt: this.donnees.support.alt, type: 'image' }
			} else {
				this.support = this.donnees.support
			}
			if (this.donnees.hasOwnProperty('options')) {
				this.options = this.donnees.options
				if (!this.options.hasOwnProperty('messagesLimites')) {
					this.options.messagesLimites = false
				}
				if (!this.options.hasOwnProperty('messages')) {
					this.options.messages = 10
				}
			}
			this.categories = this.donnees.categories
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
		ajouterCategorie () {
			if (this.categories.length < 8) {
				this.categories.push({ texte: '', image: '', alt: '' })
				const index = this.categories.length - 1
				setTimeout(() => {
					document.querySelector('#categorie' + index + ' textarea')?.focus()
				}, 10)
			}
		},
		supprimerCategorie (index) {
			if (this.categories.length > 1) {
				if (this.categories[index].image !== '') {
					this.corbeille.push(this.categories[index].image)
				}
				this.categories.splice(index, 1)
			}
		},
		televerserImage (index) {
			const modaleImageOuverte = this.modale === 'image' && this.indexImage === index
			const altActuel = modaleImageOuverte ? this.alt : this.categories[index].alt
			if (modaleImageOuverte) {
				this.fermerModaleImage()
			} else {
				this.modale = ''
			}
			const champ = document.querySelector('#televerser-image' + index)
			const formats = ['jpg', 'jpeg', 'png', 'gif']
			const extension = champ.files[0].name.substr(champ.files[0].name.lastIndexOf('.') + 1).toLowerCase()
			if (champ.files && champ.files[0] && formats.includes(extension) && champ.files[0].size <= (this.limite * 1024 * 1000)) {
				this.chargement = 'image' + index
				const fichier = champ.files[0]
				const formulaire = new FormData()
				formulaire.append('code', this.code)
				formulaire.append('fichier', fichier)
				formulaire.append('nomfichier', fichier.name)
				axios.post(this.hote + '/api/televerser-image', formulaire, {
					onUploadProgress: (progression) => {
						const pourcentage = parseInt(Math.round((progression.loaded * 100) / progression.total))
						this.progression = pourcentage
					}
				}).then((reponse) => {
					this.chargement = ''
					const donnees = reponse.data
					this.categories[index].image = donnees.image
					this.categories[index].alt = altActuel
					this.medias.push(donnees.image)
					champ.value = ''
					this.progression = 0
				}).catch((err) => {
					champ.value = ''
					this.chargement = ''
					this.progression = 0
					if (err.response?.data === 'non_connecte') {
						window.location.replace('/')
					} else if (err.response?.data === 'erreur_televersement') {
						this.parent.message = this.$t('erreurTeleversementFichier')
					} else if (err.response?.data === 'fichier_trop_volumineux') {
						this.parent.message = this.$t('tailleMaximaleFichier', { taille: this.limite })
					} else {
						this.parent.message = this.$t('erreurCommunicationServeur')
					}
				})
			} else if (!formats.includes(extension)) {
				champ.value = ''
				this.parent.message = this.$t('formatImageNonAccepte')
			} else if (champ.files[0].size > (this.limite * 1024 * 1000)) {
				champ.value = ''
				this.parent.message = this.$t('tailleMaximaleFichier', { taille: this.limite })
			}
		},
		afficherImage (image, alt, index) {
			this.image = image
			this.alt = alt
			this.indexImage = index
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'image'
			this.$nextTick(() => {
				document.querySelector('#modale-image .fermer')?.focus()
			})
		},
		supprimerImage (index) {
			this.categories[index].image = ''
			this.categories[index].alt = ''
			this.fermerModaleImage()
		},
		fermerModaleImage () {
			this.modale = ''
			if (this.indexImage !== -1) {
				this.categories[this.indexImage].alt = this.alt
			}
			this.image = ''
			this.alt = ''
			this.indexImage = -1
			this.gererFocus()
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

<style scoped>
.categorie .conteneur-textarea.image textarea{
	border-top-right-radius: 0!important;
	border-bottom-right-radius: 0!important;
}

#categories p {
	margin-bottom: 15px;
}

.categorie {
	position: relative;
	display: flex;
	justify-content: center;
	align-items: center;
	margin-bottom: 15px;
	z-index: 1;
}

.categorie.sortable-chosen.sortable-ghost {
	opacity: 0!important;
}

.categorie.sortable-chosen.sortable-drag {
	z-index: 2!important;
}

.categorie .poignee {
	text-align: center;
	font-size: 24px;
	width: 24px;
	cursor: move;
}

.categorie .conteneur-textarea {
	flex-grow: 1;
}

.categorie .actions {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 24px;
	width: 80px;
	line-height: 1;
}

.categorie .actions > button:last-of-type {
	color: #ff6259;
}

.categorie .actions label,
.categorie .actions button {
	margin: 0 8px;
	text-align: center;
	cursor: pointer;
	line-height: 1;
}

.categorie .actions .image {
	position: absolute;
	width: 40px;
	right: 40px;
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
	background-color: #ddd;
	border-top-right-radius: 4px;
	border-bottom-right-radius: 4px;
	height: 100%;
	margin: 0;
	cursor: pointer;
}

.categorie .actions .image + span,
.categorie .actions .image + button {
	margin-left: 48px;
}

.categorie .poignee.desactive,
.categorie .actions span.desactive,
.categorie .actions button.desactive {
	color: #aaa;
	cursor: default;
}

#ajouter {
	display: block;
	text-align: center;
	width: 60px;
	font-size: 36px;
	cursor: pointer;
	line-height: 1;
	color: #00ced1;
	margin: 0 auto;
}

#modale-image label {
	display: inline-block;
	width: auto;
	margin-bottom: 0;
}

#modale-image img {
	max-height: calc(90vh - 295px);
}

#modale-image .actions {
	margin-top: 0;
}

#modale-image .bouton {
	margin-left: 10px;
	margin-right: 10px;
	margin-top: 20px;
}
</style>
