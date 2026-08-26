import axios from 'axios'

export default {
	inject: ['parent'],
	data () {
		return {
			limite: import.meta.env.VITE_UPLOAD_LIMIT ? parseFloat(import.meta.env.VITE_UPLOAD_LIMIT) : 5,
			stockage: import.meta.env.VITE_STORAGE,
			lienPublicS3: import.meta.env.VITE_S3_PUBLIC_LINK
		}
	},
	computed: {
		tabIndex () {
			return this.parent.modale === '' && this.parent.message === '' && this.parent.modaleConfirmation === '' && this.modale === '' ? 0 : -1
		},
		tabIndexModale () {
			return this.parent.message === '' && this.chargement !== 'media' ? 0 : -1
		},
		disabled () {
			return this.parent.modale === '' && this.parent.message === '' && this.parent.modaleConfirmation === '' && this.modale === '' ? false : true
		},
		disabledModale () {
			return this.parent.message === '' && this.chargement !== 'media' ? false : true
		}
	},
	watch: {
		accordeonOuvert (index) {
			const accordeons = document.querySelectorAll('.contenu-accordeon')
			accordeons.forEach((accordeon) => {
				accordeon.style.display = 'none'
			})
			if (index !== -1) {
				const accordeon = document.querySelector('#accordeon' + index + ' .contenu-accordeon')
				accordeon.style.display = 'block'
			}
		},
		enregistrement (valeur) {
			if (valeur === 'enregistrement' || valeur === 'lancement') {
				if (Object.keys(this.support).length > 0 && this.medias.includes(this.support.fichier)) {
					const index = this.medias.indexOf(this.support.fichier)
					this.medias.splice(index, 1)
				}
				this.questions.forEach((q) => {
					if (q.hasOwnProperty('items')) {
						q.items.forEach((item) => {
							let index
							if (item.hasOwnProperty('image') && item.image !== '' && this.medias.includes(item.image)) {
								index = this.medias.indexOf(item.image)
								this.medias.splice(index, 1)
							}
							if (item.hasOwnProperty('audio') && item.audio !== '' && this.medias.includes(item.audio)) {
								index = this.medias.indexOf(item.audio)
								this.medias.splice(index, 1)
							}
						})
					}
					if (Object.keys(q.support).length > 0 && q.support.hasOwnProperty('image') && this.medias.includes(q.support.image)) {
						const index = this.medias.indexOf(q.support.image)
						this.medias.splice(index, 1)
					}
					if (Object.keys(q.support).length > 0 && q.support.hasOwnProperty('audio') && this.medias.includes(q.support.audio)) {
						const index = this.medias.indexOf(q.support.audio)
						this.medias.splice(index, 1)
					}
				})
				this.corbeille.push(...this.medias.filter((fichier) => !this.corbeille.includes(fichier)))
				let indexQuestion = 0
				if (this.description !== '' || Object.keys(this.support).length > 0) {
					indexQuestion = -1
				}
				this.$emit('enregistrement', { description: this.description, support: this.support, options: this.options, questions: this.questions, indexQuestion: indexQuestion, copieIndexQuestion: indexQuestion, messageFin: this.messageFin })
			} else if (valeur === 'termine') {
				this.viderCorbeille()
			}
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
		definirTitre (indexQuestion) {
			if (this.accordeonOuvert !== indexQuestion && this.questions[indexQuestion].question !== '') {
				return this.$t('question') + ' ' + (indexQuestion + 1) + this.$t('doublePoint') + this.questions[indexQuestion].question
			} else {
				return this.$t('question') + ' ' + (indexQuestion + 1)
			}
		},
		gererAccordeon (indexQuestion) {
			if (this.accordeonOuvert === indexQuestion) {
				this.accordeonOuvert = -1
			} else {
				this.accordeonOuvert = indexQuestion
			}
			this.$nextTick(() => {
				document.querySelector('#accordeon' + indexQuestion + ' .statut')?.focus()
			})
		},
		definirMediaItem (item) {
			let media = false
			if (item.hasOwnProperty('image') && item.image !== '') {
				media = true
			} else if (item.hasOwnProperty('audio') && item.audio !== '') {
				media = true
			}
			return media
		},
		afficherAjouterMedia () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'ajouter-media'
			this.$emit('modale', true)
			this.$nextTick(() => {
				document.querySelector('#modale-ajouter-media input')?.focus()
			})
		},
		fermerModaleAjouterMedia () {
			this.modale = ''
			this.lien = ''
			this.$emit('modale', false)
			this.gererFocus()
		},
		ajouterVideo () {
			let id
			let lien
			const regExpIframe = RegExp('<iframe(.+)</iframe>', 'g')
			const regExpYT = /http(?:s?):\/\/(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-\_]*)(&(amp;)?[\w\?=]*)?/
			if (this.lien.includes('ladigitale.dev/digiview/inc/video.php') && regExpIframe.test(this.lien) === true) {
				lien = this.lien.match(/<iframe [^>]*src="[^"]*"[^>]*>/g).map(x => x.replace(/.*src="([^"]*)".*/, '$1'))[0]
				if (this.verifierURL(lien) === true) {
					id = this.lien.match(/videoId=(.*?)&vignette/)[1]
					this.support = { lien: lien, vignette: 'https://i.ytimg.com/vi/' + id + '/default.jpg', fichier: '', type: 'video' }
					this.fermerModaleAjouterMedia()
				}
			} else if (this.verifierURL(this.lien) === true && regExpYT.test(this.lien) === true) {
				id = this.lien.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/)[2]
				this.support = { lien: 'https://www.youtube-nocookie.com/embed/' + id, vignette: 'https://i.ytimg.com/vi/' + id + '/default.jpg', fichier: '', type: 'video' }
				this.fermerModaleAjouterMedia()
			}
		},
		verifierURL (lien) {
			let url
			try {
				url = new URL(lien)
			} catch {
				return false
			}
			return url.protocol === 'http:' || url.protocol === 'https:'
		},
		televerserMedia (event, interaction) {
			this.fermerModaleAjouterMedia()
			const champ = event.target
			const formats = ['jpg', 'jpeg', 'png', 'gif', 'mp3', 'wav', 'm4a', 'ogg']
			const extension = champ.files[0].name.substr(champ.files[0].name.lastIndexOf('.') + 1).toLowerCase()
			if (champ.files && champ.files[0] && formats.includes(extension) && champ.files[0].size <= (this.limite * 1024 * 1000)) {
				this.chargement = 'media'
				const fichier = champ.files[0]
				let nomFichier = fichier.name
				if (nomFichier === null || nomFichier === undefined) {
					nomFichier = champ.value.replace(/^.*[\\\/]/, '')
				}
				const formulaire = new FormData()
				formulaire.append('code', this.code)
				formulaire.append('fichier', fichier)
				formulaire.append('nomfichier', nomFichier)
				axios.post(this.hote + '/api/televerser-media', formulaire, {
					onUploadProgress: (progression) => {
						const pourcentage = parseInt(Math.round((progression.loaded * 100) / progression.total))
						this.progression = pourcentage
					}
				}).then((reponse) => {
					this.chargement = ''
					const donnees = reponse.data
					this.support = donnees
					this.medias.push(donnees.fichier)
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
		ajouterQuestion (interaction) {
			if (interaction === 'Sondage') {
				this.questions.push({ question: '', support: {}, option: 'choix-unique', items: [{ texte: '' }, { texte: '' }] })
			} else if (interaction === 'Questionnaire') {
				this.questions.push({ question: '', support: {}, option: 'choix-unique', items: [{ texte: '', reponse: false }, { texte: '', reponse: false }], reponses: '', retroaction: { correcte: '', incorrecte: '' }, points: 1000, temps: 20 })
			}
			const indexQuestion = this.questions.length - 1
			this.$nextTick(() => {
				this.accordeonOuvert = indexQuestion
				setTimeout(() => {
					document.querySelector('#question' + indexQuestion + ' .question textarea')?.focus()
				}, 10)
			})
		},
		deplacerQuestion (event) {
			if (this.accordeonOuvert === event.oldIndex) {
				this.$nextTick(() => {
					this.accordeonOuvert = event.newIndex
				})
			}
		},
		supprimerQuestion (indexQuestion) {
			if (this.questions[indexQuestion].hasOwnProperty('items')) {
				this.questions[indexQuestion].items.forEach((item) => {
					if (item.image !== '') {
						this.corbeille.push(item.image)
					}
				})
			}
			this.questions.splice(indexQuestion, 1)
			this.accordeonOuvert = -1
		},
		dupliquerQuestion (indexQuestion) {
			const medias = []
			if (this.questions[indexQuestion].support.hasOwnProperty('image') && this.questions[indexQuestion].support.image !== '') {
				medias.push(this.questions[indexQuestion].support.image)
			}
			if (this.questions[indexQuestion].hasOwnProperty('items')) {
				this.questions[indexQuestion].items.forEach((item) => {
					if (item.hasOwnProperty('image') && item.image && item.image !== '') {
						medias.push(item.image)
					}
				})
			}
			if (this.questions[indexQuestion].support.hasOwnProperty('audio') && this.questions[indexQuestion].support.audio !== '') {
				medias.push(this.questions[indexQuestion].support.audio)
			}
			if (this.questions[indexQuestion].hasOwnProperty('items')) {
				this.questions[indexQuestion].items.forEach((item) => {
					if (item.hasOwnProperty('audio') && item.audio && item.audio !== '') {
						medias.push(item.audio)
					}
				})
			}
			if (medias.length > 0) {
				this.parent.chargementPage = true
				axios.post(this.hote + '/api/dupliquer-medias', {
					code: this.code,
					medias: medias
				}).then(() => {
					this.parent.chargementPage = false
					const question = JSON.parse(JSON.stringify(this.questions[indexQuestion]))
					if (question.support.hasOwnProperty('image') && question.support.image !== '') {
						question.support.image = 'dup-' + question.support.image
						this.medias.push(question.support.image)
					} else if (question.support.hasOwnProperty('audio') && question.support.audio !== '') {
						question.support.audio = 'dup-' + question.support.audio
						this.medias.push(question.support.audio)
					}
					if (question.hasOwnProperty('items')) {
						question.items.forEach((item) => {
							if (item.hasOwnProperty('image') && item.image !== '') {
								item.image = 'dup-' + item.image
								this.medias.push(item.image)
							}
							if (item.hasOwnProperty('audio') && item.audio !== '') {
								item.audio = 'dup-' + item.audio
								this.medias.push(item.audio)
							}
						})
					}
					this.questions.push(question)
					const indexNouvelleQuestion = this.questions.length - 1
					this.$nextTick(() => {
						this.accordeonOuvert = indexNouvelleQuestion
						setTimeout(() => {
							document.querySelector('#question' + indexNouvelleQuestion + ' textarea')?.focus()
						}, 10)
					})
				}).catch(() => {
					this.parent.chargementPage = false
					this.parent.message = this.$t('erreurCommunicationServeur')
				})
			} else {
				const question = JSON.parse(JSON.stringify(this.questions[indexQuestion]))
				this.questions.push(question)
				const indexNouvelleQuestion = this.questions.length - 1
				this.$nextTick(() => {
					this.accordeonOuvert = indexNouvelleQuestion
					setTimeout(() => {
						document.querySelector('#question' + indexNouvelleQuestion + ' textarea')?.focus()
					}, 10)
				})
			}
		},
		ajouterItem (indexQuestion, interaction) {
			if (interaction === 'Sondage') {
				this.questions[indexQuestion].items.push({ texte: '' })
			} else if (interaction === 'Questionnaire') {
				this.questions[indexQuestion].items.push({ texte: '', reponse: false })
			}
			const indexItem = this.questions[indexQuestion].items.length - 1
			this.$nextTick(() => {
				document.querySelector('#item' + indexQuestion + '_' + indexItem + ' textarea')?.focus()
			})
		},
		supprimerItem (indexQuestion, indexItem) {
			if (this.questions[indexQuestion].items.length > 1) {
				if (this.questions[indexQuestion].items[indexItem].image !== '') {
					this.corbeille.push(this.questions[indexQuestion].items[indexItem].image)
				}
				this.questions[indexQuestion].items.splice(indexItem, 1)
			}
		},
		televerserMediaQuestion (indexQuestion, indexItem, interaction) {
			this.modale = ''
			this.$emit('modale', false)
			let champ = document.querySelector('#televerser-media' + indexQuestion + '_' + indexItem)
			if (indexItem === 'support') {
				champ = document.querySelector('#televerser-support' + indexQuestion)
			}
			const formats = ['jpg', 'jpeg', 'png', 'gif', 'mp3', 'wav', 'm4a', 'ogg']
			const extension = champ.files[0].name.substr(champ.files[0].name.lastIndexOf('.') + 1).toLowerCase()
			if (champ.files && champ.files[0] && formats.includes(extension) && champ.files[0].size <= (this.limite * 1024 * 1000)) {
				if (indexItem === 'support') {
					this.chargement = 'support' + indexQuestion
				} else {
					this.chargement = 'media' + indexQuestion + '_' + indexItem
				}
				const fichier = champ.files[0]
				let nomFichier = fichier.name
				if (nomFichier === null || nomFichier === undefined) {
					nomFichier = champ.value.replace(/^.*[\\\/]/, '')
				}
				const formulaire = new FormData()
				formulaire.append('code', this.code)
				formulaire.append('fichier', fichier)
				formulaire.append('nomfichier', nomFichier)
				axios.post(this.hote + '/api/televerser-media', formulaire, {
					onUploadProgress: (progression) => {
						const pourcentage = parseInt(Math.round((progression.loaded * 100) / progression.total))
						this.progression = pourcentage
					}
				}).then((reponse) => {
					this.chargement = ''
					const donnees = reponse.data
					const type = donnees.type
					if (indexItem === 'support' && type === 'image') {
						this.questions[indexQuestion].support = { image: donnees.fichier, alt: donnees.alt }
					} else if (indexItem === 'support' && type === 'audio') {
						this.questions[indexQuestion].support = { audio: donnees.fichier }
					} else if (indexItem !== 'support') {
						const item = this.questions[indexQuestion].items[indexItem]
						if (type === 'image') {
							item.image = donnees.fichier
							item.alt = donnees.alt
							if (item.hasOwnProperty('audio')) {
								delete item.audio
							}
						} else {
							item.audio = donnees.fichier
							if (item.hasOwnProperty('image')) {
								delete item.image
								delete item.alt
							}
						}
					}
					this.medias.push(donnees.fichier)
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
				this.parent.message = this.$t('formatFichierNonAccepte')
			} else if (champ.files[0].size > (this.limite * 1024 * 1000)) {
				champ.value = ''
				this.parent.message = this.$t('tailleMaximaleFichier', { taille: this.limite })
			}
		},
		afficherSupport (indexQuestion, fichier, alt, type) {
			this.indexQuestion = indexQuestion
			this.media = { fichier: fichier, type: type }
			this.alt = alt
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'media-question'
			this.$emit('modale', true)
			this.$nextTick(() => {
				document.querySelector('.modale .fermer')?.focus()
			})
		},
		afficherMediaQuestion (indexQuestion, fichier, alt, indexItem, type) {
			this.indexQuestion = indexQuestion
			this.media = { fichier: fichier, type: type }
			this.alt = alt
			this.indexItem = indexItem
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'media-question'
			this.$emit('modale', true)
			this.$nextTick(() => {
				document.querySelector('.modale .fermer')?.focus()
			})
		},
		supprimerMediaQuestion (indexQuestion, indexItem) {
			if (indexItem === 'support') {
				this.questions[indexQuestion].support = {}
			} else if (indexItem !== 'support') {
				const item = this.questions[indexQuestion].items[indexItem]
				if (this.media.type === 'image') {
					item.image = ''
					item.alt = ''
					if (item.hasOwnProperty('audio')) {
						delete item.audio
					}
				} else if (this.media.type === 'audio') {
					item.audio = ''
					if (item.hasOwnProperty('image')) {
						delete item.image
						delete item.alt
					}
				}
			}
			this.fermerModaleMediaQuestion()
		},
		fermerModaleMediaQuestion () {
			this.modale = ''
			if (this.media.type === 'image' && this.indexItem === -1 && Object.keys(this.questions[this.indexQuestion].support).length > 0) {
				this.questions[this.indexQuestion].support.alt = this.alt
			} else if (this.media.type === 'image' && this.indexItem !== -1) {
				this.questions[this.indexQuestion].items[this.indexItem].alt = this.alt
			}
			this.media = {}
			this.alt = ''
			this.indexItem = -1
			this.indexQuestion = -1
			this.$emit('modale', false)
			this.gererFocus()
		},
		afficherMedia (media, alt, type) {
			if (type === 'video') {
				this.media = { lien: media, type: type }
			} else if (type === 'image') {
				this.media = { fichier: media, type: type }
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
		supprimerMedia () {
			this.fermerModaleMedia()
			this.support = {}
		},
		fermerModaleMedia () {
			this.modale = ''
			if (this.media.type === 'image') {
				this.support.alt = this.alt
			}
			this.media = {}
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
			if (event.key === 'Escape' && this.chargement !== 'media') {
				if (this.modale === 'ajouter-media') {
					this.fermerModaleAjouterMedia()
				} else if (this.modale === 'media') {
					this.fermerModaleMedia()
				} else if (this.modale === 'media-question') {
					this.fermerModaleMediaQuestion()
				} else if (this.modale !== '') {
					this.modale = ''
					this.$emit('modale', false)
					this.gererFocus()
				}
			} else if (event.key === 'Tab') {
				if (this.modale !== '') {
					const modale = document.querySelector('.modale')
					this.parent.piegerFocus(event, modale)
				}
			}
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
