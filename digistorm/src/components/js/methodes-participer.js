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
			return this.parent.modale === '' && this.parent.message === '' ? 0 : -1
		},
		disabled () {
			return this.parent.modale === '' && this.parent.message === '' ? false : true
		}
	},
	methods: {
		activerInput (id) {
			document.querySelector('#' + id)?.click()
		},
		definirCheminFichier (fichier) {
			if (this.stockage === 's3' && this.lienPublicS3 && this.lienPublicS3 !== '') {
				return this.lienPublicS3 + '/' + this.code + '/' + fichier
			} else {
				return '/fichiers/' + this.code + '/' + fichier
			}
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
		verifierItemCorrect (itemsCorrects, item) {
			let itemCorrect = false
			if (itemsCorrects.includes(item.texte) || (item.hasOwnProperty('image') && itemsCorrects.includes(item.image)) || (item.hasOwnProperty('audio') && itemsCorrects.includes(item.audio))) {
				itemCorrect = true
			}
			return itemCorrect
		},
		verifierReponse (reponse, item) {
			let reponseItem
			if (!reponse.includes(item.texte) && !reponse.includes(item.image) && !reponse.includes(item.audio)) {
				reponseItem = false
			} else {
				reponseItem = true
			}
			return reponseItem
		},
		definirReponse (event, indexQuestion) {
			if (this.questions[indexQuestion].option === 'choix-unique' || this.questions[indexQuestion].option === 'texte-court' || this.questions[indexQuestion].option === 'etoiles') {
				if (this.reponse[indexQuestion].length > 0) {
					this.reponse[indexQuestion].splice(0, 1)
				}
				if (this.questions[indexQuestion].option === 'etoiles') {
					this.reponse[indexQuestion].push(event)
					this.$nextTick(() => {
						document.querySelector('#etoiles' + indexQuestion + ' :nth-child(' + event + ')')?.focus()
					})
				} else {
					this.reponse[indexQuestion].push(event.target.value)
				}
			} else if (this.questions[indexQuestion].option === 'choix-multiples') {
				if (event.target.checked === true) {
					this.reponse[indexQuestion].push(event.target.value)
				} else {
					const index = this.reponse[indexQuestion].indexOf(event.target.value)
					this.reponse[indexQuestion].splice(index, 1)
				}
			}
		},
		definirReponseEnvoyee (indexQuestion) {
			let reponse = this.reponse[indexQuestion].toString()
			if (this.options.reponses === 'oui' && this.donneesSession[indexQuestion] && this.donneesSession[indexQuestion].reponseCorrecte === false) {
				reponse = '<s>' + this.reponse[indexQuestion].toString() + '</s> ' + '<span style="color: #00a695">' + this.donneesSession[indexQuestion].itemsCorrects.join(', ') + '</span>'
			}
			return reponse
		},
		modifierIndexQuestion () {
			this.$emit('index')
		},
		afficherSupport () {
			this.$emit('support')
		},
		afficherImage (event, image, alt) {
			this.$emit('image', event, image, alt)
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
		}
	}
}
