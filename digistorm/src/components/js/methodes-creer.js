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
			return this.parent.message === '' && this.chargement !== 'support' ? 0 : -1
		},
		disabled () {
			return this.parent.modale === '' && this.parent.message === '' && this.parent.modaleConfirmation === '' && this.modale === '' ? false : true
		},
		disabledModale () {
			return this.parent.message === '' && this.chargement !== 'support' ? false : true
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
		televerserMedia (event) {
			this.fermerModaleAjouterMedia()
			const champ = event.target
			const formats = ['jpg', 'jpeg', 'png', 'gif', 'mp3', 'wav', 'm4a', 'ogg']
			const extension = champ.files[0].name.substr(champ.files[0].name.lastIndexOf('.') + 1).toLowerCase()
			if (champ.files && champ.files[0] && formats.includes(extension) && champ.files[0].size <= (this.limite * 1024 * 1000)) {
				this.chargement = 'support'
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
		afficherMedia (media, alt, type) {
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
				document.querySelector('.modale .fermer')?.focus()
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
			if (event.key === 'Escape' && this.chargement !== 'support') {
				if (this.modale === 'ajouter-media') {
					this.fermerModaleAjouterMedia()
				} else if (this.modale === 'media') {
					this.fermerModaleMedia()
				} else if (this.modale === 'image' && typeof this.fermerModaleImage === 'function') {
					this.fermerModaleImage()
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
		}
	}
}
