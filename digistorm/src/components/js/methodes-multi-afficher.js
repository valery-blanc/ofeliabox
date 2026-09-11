import linkifyHtml from 'linkify-html'
import DOMPurify from 'dompurify'

export default {
	inject: ['parent'],
	data () {
		return {
			stockage: import.meta.env.VITE_STORAGE,
			lienPublicS3: import.meta.env.VITE_S3_PUBLIC_LINK
		}
	},
	computed: {
		tabIndex () {
			return this.parent.modale === '' && this.parent.message === '' && this.parent.modaleConfirmation === '' && this.modale === '' && !this.modaleQuestion ? 0 : -1
		},
		disabled () {
			return this.parent.modale === '' && this.parent.message === '' && this.parent.modaleConfirmation === '' && this.modale === '' && !this.modaleQuestion ? false : true
		},
		disabledModale () {
			return this.parent.message === '' ? false : true
		}
	},
	methods: {
		definirCheminFichier (fichier) {
			if (this.stockage === 's3' && this.lienPublicS3 && this.lienPublicS3 !== '') {
				return this.lienPublicS3 + '/' + this.code + '/' + fichier
			} else {
				return '/fichiers/' + this.code + '/' + fichier
			}
		},
		formaterHTML (html) {
			html = linkifyHtml(html, {
				defaultProtocol: 'https',
				truncate: 50,
				rel: 'noreferrer',
				target: '_blank'
			})
			html = DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] })
			return html
		},
		verifierItem (item) {
			let itemContenu = false
			if (item.texte !== '' || (item.hasOwnProperty('image') && item.image !== '') || (item.hasOwnProperty('audio') && item.audio !== '')) {
				itemContenu = true
			}
			return itemContenu
		},
		verifierItemAudioTexte (item) {
			let itemAudioTexte = false
			if (item.texte !== '' && item.hasOwnProperty('audio') && item.audio !== '') {
				itemAudioTexte = true
			}
			return itemAudioTexte
		},
		definirListe (liste) {
			liste.forEach((identifiant, indexIdentifiant) => {
				this.parent.utilisateurs.forEach((utilisateur) => {
					if (identifiant === utilisateur.identifiant && utilisateur.nom !== '') {
						liste[indexIdentifiant] = utilisateur.nom
					}
				})
			})
			return liste.join(', ')
		},
		afficherModaleListe (liste) {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'liste'
			this.liste = this.definirListe(liste)
			this.$emit('modale', true)
			this.$nextTick(() => {
				document.querySelector('.modale .fermer')?.focus()
			})
		},
		fermerModaleListe () {
			this.modale = ''
			this.liste = ''
			this.$emit('modale', false)
			this.gererFocus()
		},
		afficherMedia () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'media'
			this.$emit('modale', true)
			this.$nextTick(() => {
				document.querySelector('.modale .bouton')?.focus()
			})
		},
		fermerModaleMedia () {
			this.modale = ''
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
		gererFocus () {
			this.$nextTick(() => {
				if (this.elementPrecedent) {
					this.elementPrecedent.focus()
					this.elementPrecedent = null
				}
			})
		},
		gererClavier (event) {
			if (event.key === 'Escape' && this.modaleQuestion) {
				this.fermerModaleQuestion()
			} else if (event.key === 'Escape' && this.modale === 'liste') {
				this.fermerModaleListe()
			} else if (event.key === 'Escape' && this.modale === 'media') {
				this.fermerModaleMedia()
			} else if (event.key === 'Escape' && this.modale === 'image') {
				this.fermerModaleImage()
			} else if (event.key === 'Escape' && this.modale !== '') {
				this.modale = ''
				this.$emit('modale', false)
				this.gererFocus()
			} else if (event.key === 'ArrowLeft' && this.modaleQuestion) {
				if (this.parent.type === 'Questionnaire') {
					this.modifierIndexQuestionTableau('precedente')
				} else {
					this.modifierIndexQuestionModale('precedente')
				}
			} else if (event.key === 'ArrowRight' && this.modaleQuestion) {
				if (this.parent.type === 'Questionnaire') {
					this.modifierIndexQuestionTableau('suivante')
				} else {
					this.modifierIndexQuestionModale('suivante')
				}
			} else if (event.key === 'Tab') {
				if (this.modale !== '' || this.modaleQuestion) {
					const modale = document.querySelector('.modale')
					this.parent.piegerFocus(event, modale)
				}
			}
		}
	}
}
