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

		<div id="conteneur-categories" aria-live="polite" class="ascenseur" :class="{'scroll': ascenseur}" :style="{'top': hauteurQuestion + 'px', 'height': hauteurConteneur + 'px'}">
			<div id="categories" v-if="categories.length > 0">
				<template v-for="(categorie, index) in categories">
					<div :id="'categorie' + index" class="conteneur-categorie" v-if="categorie.texte !== '' || categorie.image !== ''" :key="'categorie_' + index">
						<div class="categorie" :style="{'border-color': couleurs[index]}">
							<div class="categorie-header">
								<button type="button" class="image" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(categorie.image), categorie.alt)" v-if="categorie.image !== ''"><img :src="definirCheminFichier(categorie.image)" :alt="categorie.alt"></button>
								<span class="texte" v-if="categorie.texte !== ''">{{ categorie.texte }}</span>
							</div>
							<div class="categorie-contenu">
								<draggable class="items" v-model="messages[index]" tag="ul" group="categorie" draggable="li" filter=".actions, .champ-message" :animation="150" :scroll="true" :force-fallback="true" :prevent-on-filter="false" :scroll-speed="40" @start="defilement = false" @sort="reorganiserMessages">
									<li v-for="(item, indexMessage) in messages[index]" :style="{'color': couleurs[index], 'background': eclaircirCouleur(couleurs[index])}" :key="'message_' + indexMessage">
										<span class="message edition" v-if="messageId === item.reponse.id">
											<TextareaAutosize :id="'champ' + item.reponse.id" class="champ-message" v-model="texte" :rows="1" :min-height="36" :max-height="72" :disabled="disabled" />
											<button type="button" class="bouton icone" :disabled="disabled" :title="$t('annuler')" :aria-label="$t('annuler')" @click="annulerModifierMessage"><i class="material-icons" aria-hidden="true">close</i></button>
											<button type="button" class="bouton icone" :disabled="disabled" :title="$t('valider')" :aria-label="$t('valider')" @click="modifierMessage(item.reponse.id)"><i class="material-icons" aria-hidden="true">check</i></button>
										</span>
										<span class="message" :title="definirNom(item)" v-else>{{ item.reponse.texte }}</span>
										<span class="actions" v-if="messageId !== item.reponse.id">
											<button type="button" :disabled="disabled" :title="$t('afficherMessage')" :aria-label="$t('afficherMessage')" @click="afficherMessage(item.reponse.texte)"><i class="material-icons" aria-hidden="true">zoom_in</i></button>
											<button type="button" :disabled="disabled" :title="$t('modifierMessage')" :aria-label="$t('modifierMessage')" @click="afficherModifierMessage(item.reponse.id, item.reponse.texte)"><i class="material-icons" aria-hidden="true">edit</i></button>
											<button type="button" :disabled="disabled" :title="$t('supprimerMessage')" :aria-label="$t('supprimerMessage')" @click="supprimerMessage(item.reponse.id)"><i class="material-icons supprimer" aria-hidden="true">delete</i></button>
										</span>
									</li>
								</draggable>
							</div>
						</div>
					</div>
				</template>
			</div>
			<div id="categorie" v-else>
				<div class="categorie">
					<div class="categorie-contenu">
						<draggable class="items" v-model="messages" tag="ul" draggable="li" filter=".actions, .champ-message, .bouton" :animation="150" :scroll="true" :force-fallback="true" :prevent-on-filter="false" @sort="reorganiserMessages">
							<li v-for="(item, indexMessage) in messages" :key="'message_' + indexMessage">
								<span class="message edition" v-if="messageId === item.reponse.id">
									<TextareaAutosize :id="'champ' + item.reponse.id" class="champ-message" v-model="texte" :rows="1" :min-height="36" :max-height="72" :disabled="disabled" />
									<button type="button" class="bouton icone" :disabled="disabled" :title="$t('annuler')" :aria-label="$t('annuler')" @click="annulerModifierMessage"><i class="material-icons" aria-hidden="true">close</i></button>
									<button type="button" class="bouton icone" :disabled="disabled" :title="$t('valider')" :aria-label="$t('valider')" @click="modifierMessage(item.reponse.id)"><i class="material-icons" aria-hidden="true">check</i></button>
								</span>
								<span class="message" :title="definirNom(item)" v-else>{{ item.reponse.texte }}</span>
								<span class="actions" v-if="messageId !== item.reponse.id">
									<button type="button" :disabled="disabled" :title="$t('afficherMessage')" :aria-label="$t('afficherMessage')" @click="afficherMessage(item.reponse.texte)"><i class="material-icons" aria-hidden="true">zoom_in</i></button>
									<button type="button" :disabled="disabled" :title="$t('modifierMessage')" :aria-label="$t('modifierMessage')" @click="afficherModifierMessage(item.reponse.id, item.reponse.texte)"><i class="material-icons" aria-hidden="true">edit</i></button>
									<button type="button" :disabled="disabled" :title="$t('supprimerMessage')" :aria-label="$t('supprimerMessage')" @click="supprimerMessage(item.reponse.id)"><i class="material-icons supprimer" aria-hidden="true">delete</i></button>
								</span>
							</li>
						</draggable>
					</div>
				</div>
			</div>
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
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleMedia">{{ $t('fermer') }}</button>
						</div>
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

		<div class="conteneur-modale" v-else-if="modale === 'message'">
			<div id="modale-message" class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<p>{{ message }}</p>
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleMessage">{{ $t('fermer') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import imagesLoaded from 'imagesloaded'
import methodes from '#root/components/js/methodes-fichiers'
import TextareaAutosize from '#root/components/textareaAutosize.vue'
import { VueDraggableNext } from 'vue-draggable-next'

export default {
	name: 'DigistormRemueMeningesAfficher',
	inject: ['parent'],
	components: {
		TextareaAutosize,
		draggable: VueDraggableNext
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
			question: '',
			support: {},
			categories: [],
			couleurs: ['#27ae60', '#2980b9', '#8e44ad', '#f39c12', '#d35400', '#b71540', '#535c68', '#273c75'],
			modale: '',
			media: {},
			image: '',
			alt: '',
			messages: [],
			message: '',
			texte: '',
			messageId: '',
			hauteurQuestion: 0,
			hauteurConteneur: 0,
			ascenseur: false,
			defilement: false,
			depart: 0,
			distance: 0,
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
				this.definirMessages()
			},
			deep: true
		},
		bannis: {
			handler () {
				this.definirMessages()
			},
			deep: true
		}
	},
	created () {
		this.question = this.donnees.question
		this.support = this.donnees.support
		this.categories = this.donnees.categories.filter((categorie) => {
			return categorie.texte !== '' || categorie.image !== ''
		})
		this.definirMessages()
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
		definirNom (item) {
			if (item.nom !== '') {
				return item.nom
			} else {
				return item.identifiant
			}
		},
		afficherMessage (message) {
			let taille = 40
			if (window.innerWidth < 400) {
				taille = 25
			} else if (window.innerWidth > 399 && window.innerWidth < 599) {
				taille = 32
			}
			this.message = message
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'message'
			this.$emit('modale', true)
			this.$nextTick(() => {
				fitty('#modale-message p', {
					minSize: taille,
					maxSize: 200,
					multiLine: true
				})
				document.querySelector('.modale .bouton')?.focus()
			})
		},
		fermerModaleMessage () {
			this.modale = ''
			this.message = ''
			this.$emit('modale', false)
			this.gererFocus()
		},
		afficherModifierMessage (id, texte) {
			this.messageId = id
			this.texte = texte
			this.$nextTick(() => {
				document.querySelector('#champ' + id)?.focus()
			})
		},
		annulerModifierMessage () {
			this.messageId = ''
			this.texte = ''
		},
		modifierMessage (id) {
			if (this.texte !== '') {
				this.$socket.emit('modifiermessage', { code: this.code, session: this.session, id: id, texte: this.texte })
				this.messageId = ''
				this.texte = ''
			}
		},
		supprimerMessage (id) {
			this.$socket.emit('supprimermessage', { code: this.code, session: this.session, id: id })
		},
		definirMessages () {
			const messages = []
			for (let i = 0; i < this.categories.length; i++) {
				messages.push([])
			}
			if (messages.length > 0) {
				this.reponses.forEach((item) => {
					let index = -1
					this.categories.forEach((categorie, indexCategorie) => {
						if (item.reponse.categorie === categorie.texte || item.reponse.categorie === categorie.image) {
							index = indexCategorie
						}
					})
					if (!this.bannis.includes(item.identifiant) && item.reponse.visible && index > -1) {
						messages[index].push(item)
					}
				})
			} else {
				this.reponses.forEach((item) => {
					if (!this.bannis.includes(item.identifiant) && item.reponse.visible) {
						messages.push(item)
					}
				})
			}
			this.messages = messages
		},
		reorganiserMessages () {
			const messages = this.messages
			let reponses = []
			if (this.categories.length > 0) {
				messages.forEach((items, index) => {
					let categorie = ''
					if (this.categories[index].texte !== '') {
						categorie = this.categories[index].texte
					} else if (this.categories[index].image !== '') {
						categorie = this.categories[index].image
					}
					items.forEach((message) => {
						message.reponse.categorie = categorie
						reponses.push(message)
					})
				})
			} else {
				reponses = messages
			}
			this.$socket.emit('reorganisermessages', { code: this.code, session: this.session, reponses: reponses })
		},
		afficherMedia (event, media, alt, type) {
			event.preventDefault()
			event.stopPropagation()
			if (type === 'video') {
				this.media = { lien: media, type: type }
			} else if (type === 'image') {
				this.media = { fichier: media, type: type, alt: alt }
				this.alt = alt
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
			this.alt = ''
			this.$emit('modale', false)
			this.gererFocus()
		},
		afficherImage (event, image, alt) {
			event.preventDefault()
			event.stopPropagation()
			this.image = image
			this.alt = alt
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'image'
			this.$emit('modale', true)
			this.$nextTick(() => {
				document.querySelector('#modale-image .bouton')?.focus()
			})
		},
		fermerModaleImage () {
			this.modale = ''
			this.image = ''
			this.alt = ''
			this.$emit('modale', false)
			this.gererFocus()
		},
		verifierConteneur () {
			const hauteurConteneur = document.querySelector('#conteneur').offsetHeight - (document.querySelector('#question').offsetHeight + 80)
			const hauteurQuestion = document.querySelector('#question').offsetHeight + 80
			const ascenseur = document.querySelector('#conteneur-categories').scrollWidth > document.querySelector('#conteneur-categories').offsetWidth
			this.hauteurConteneur = hauteurConteneur
			this.hauteurQuestion = hauteurQuestion
			this.ascenseur = ascenseur
			if (this.ascenseur) {
				this.activerDefilementHorizontal()
			} else {
				this.desactiverDefilementHorizontal()
			}
		},
		activerDefilementHorizontal () {
			const element = document.querySelector('#conteneur-categories')
			element.addEventListener('mousedown', this.defilementHorizontalDebut)
			element.addEventListener('mouseleave', this.defilementHorizontalFin)
			element.addEventListener('mouseup', this.defilementHorizontalFin)
			element.addEventListener('mousemove', this.defilementHorizontalEnCours)
		},
		desactiverDefilementHorizontal () {
			const element = document.querySelector('#conteneur-categories')
			element.removeEventListener('mousedown', this.defilementHorizontalDebut)
			element.removeEventListener('mouseleave', this.defilementHorizontalFin)
			element.removeEventListener('mouseup', this.defilementHorizontalFin)
			element.removeEventListener('mousemove', this.defilementHorizontalEnCours)
		},
		defilementHorizontalDebut (event) {
			const element = document.querySelector('#conteneur-categories')
			this.defilement = true
			this.depart = event.pageX - element.offsetLeft
			this.distance = element.scrollLeft
		},
		defilementHorizontalFin () {
			this.defilement = false
		},
		defilementHorizontalEnCours (event) {
			if (!this.defilement) { return }
			event.preventDefault()
			const element = document.querySelector('#conteneur-categories')
			const x = event.pageX - element.offsetLeft
			const delta = (x - this.depart) * 1.5
			element.scrollLeft = this.distance - delta
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
		gererFocus () {
			this.$nextTick(() => {
				if (this.elementPrecedent) {
					this.elementPrecedent.focus()
					this.elementPrecedent = null
				}
			})
		},
		gererClavier (event) {
			if (event.key === 'Escape' && this.modale === 'message') {
				this.fermerModaleMessage()
			} else if (event.key === 'Escape' && this.modale === 'media') {
				this.fermerModaleMedia()
			} else if (event.key === 'Escape' && this.modale === 'image') {
				this.fermerModaleImage()
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
#conteneur-categories {
	position: absolute;
	left: 0;
	width: 100%;
	overflow: auto;
	-webkit-overflow-scrolling: touch;
}

#categories {
	display: flex;
	flex-direction: row;
	justify-content: center;
	align-content: flex-start;
	align-items: flex-start;
	flex-wrap: nowrap;
	padding: 0 20px;
	margin-bottom: 20px;
}

.scroll #categories {
	justify-content: flex-start;
}

#categorie {
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
	width: 100%;
	max-width: 1024px;
	padding: 0 20px;
	margin: 0 auto 20px;
}

#conteneur-categories .categorie {
	position: relative;
	border: 2px solid #ddd;
	padding: 15px 20px 5px;
	border-radius: 1em;
	margin: 0 0 20px;
	width: 40rem;
	min-height: 25rem;
	flex-shrink: 0;
}

#categories .conteneur-categorie {
	padding-right: 20px;
}

#categories .conteneur-categorie:last-child {
	padding-right: 0;
}

.scroll #categories .conteneur-categorie {
	padding-right: 20px;
}

#categorie .categorie {
	max-width: 70rem;
	width: 100%;
}

#conteneur-categories .categorie-header {
	position: relative;
	display: flex;
	justify-content: flex-start;
	align-items: center;
	border-bottom: 1px solid #ddd;
	padding-bottom: 15px;
	width: 100%;
}

#conteneur-categories .categorie-header .image {
	display: flex;
	justify-content: center;
	align-items: center;
	font-size: 0;
	width: 7rem;
	height: 7rem;
	margin-right: 20px;
	cursor: zoom-in;
}

#conteneur-categories .categorie-header .image img {
	max-width: 7rem;
	max-height: 7rem;
	border-radius: 5px;
}

#conteneur-categories .categorie-header .texte {
	font-size: 2.3rem;
	font-weight: 400;
	line-height: 1.25;
}

#conteneur-categories .categorie-header .image + .texte {
	width: calc(100% - (7rem + 20px));
}

#categories .categorie-contenu ul {
	padding: 15px 0 0;
	min-height: 12rem;
}

#conteneur-categories .categorie-contenu li {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 5px 10px;
	background: #eee;
	border-radius: 4px;
	margin-bottom: 10px;
	cursor: move;
}

#conteneur-categories .categorie-contenu li .message {
	font-size: 2rem;
	font-weight: 400;
	width: calc(100% - 95px);
	line-height: 1.25;
}

#conteneur-categories .categorie-contenu li .message.edition {
	display: flex;
	justify-content: flex-start;
	align-items: center;
	width: 100%;
}

#conteneur-categories .categorie-contenu li .message textarea {
	border: 1px solid #ddd;
	background: #fff;
	border-radius: 4px;
	padding: 0 10px;
	width: calc(100% - 80px);
	line-height: 1.25;
}

#conteneur-categories .categorie-contenu li .message .bouton.icone {
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

#conteneur-categories .categorie-contenu li .actions {
	display: flex;
	visibility: hidden;
	margin-left: 11px;
	cursor: pointer;
}

#conteneur-categories .categorie-contenu li .actions i {
	font-size: 24px;
	margin-left: 4px;
	color: #242f3d;
}

#conteneur-categories .categorie-contenu li .actions i.supprimer {
	color: #ff6259;
}

#conteneur-categories .categorie-contenu li:hover .actions {
	visibility: visible;
}

#modale-image img {
	max-height: calc(90vh - 190px);
}

#modale-message  {
	text-align: center;
	max-width: 984px;
}

#modale-message .conteneur {
	padding: 30px 25px;
}

#modale-message p {
	font-weight: 400;
}

@media screen and (max-width: 767px) {
	#categories .conteneur-categorie {
		width: 100%!important;
		padding-right: 0!important;
	}

	#conteneur-categories .categorie {
		width: 100%;
		margin-right: 0;
	}

	#categories {
		flex-wrap: wrap;
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
