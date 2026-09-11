<template>
	<div id="rebours" :class="{'rouge': tempsEcoule || (duree !== '' && calculerTempsRestant(duree).total < 6000)}">
		<span class="minutes">{{ texteMinutes }}</span>
		<span class="separateur">:</span>
		<span class="secondes">{{ texteSecondes }}</span>
	</div>
</template>

<script>
export default {
	name: 'DigistormRebours',
	props: {
		date: Number,
		temps: Number,
		indexQuestion: Number
	},
	data () {
		return {
			minutes: 0,
			secondes: 0,
			texteMinutes: '',
			texteSecondes: '',
			duree: '',
			decompte: '',
			tempsRestant: '',
			tempsEcoule: false
		}
	},
	watch: {
		indexQuestion () {
			this.tempsEcoule = false
			this.minutes = Math.floor((this.temps / 60) % 60)
			this.secondes = Math.floor((this.temps) % 60)
			if (this.secondes < 10) {
				this.texteSecondes = '0' + this.secondes
			} else {
				this.texteSecondes = this.secondes
			}
			if (this.minutes < 10) {
				this.texteMinutes = '0' + this.minutes
			} else {
				this.texteMinutes = this.minutes
			}
			if (this.decompte !== '') {
				clearInterval(this.decompte)
				this.decompte = ''
			}
			this.demarrer()
		}
	},
	created () {
		const dateDebut = Date.parse(new Date(this.date))
		const dateFin =  Date.parse(new Date(dateDebut + (this.temps * 1000)))
		const dateActuelle = Date.parse(new Date())
		if ((dateActuelle - dateDebut) > (dateFin - dateDebut)) {
			this.$emit('tempsEcoule')
			this.tempsEcoule = true
			this.minutes = 0
			this.secondes = 0
			this.texteSecondes = '00'
			this.texteMinutes = '00'
		} else {
			this.minutes = Math.floor((this.temps / 60) % 60)
			this.secondes = Math.floor((this.temps) % 60)
		}
	},
	mounted () {
		if (!this.tempsEcoule) {
			if (this.secondes < 10) {
				this.texteSecondes = '0' + this.secondes
			} else {
				this.texteSecondes = this.secondes
			}
			if (this.minutes < 10) {
				this.texteMinutes = '0' + this.minutes
			} else {
				this.texteMinutes = this.minutes
			}
			this.demarrer()
		}
	},
	methods: {
		demarrer () {
			const date = Date.parse(new Date(this.date)) + 1000
			this.duree = new Date(date + (((this.minutes * 60) + (this.secondes - 1)) * 1000))
			this.decompter()
			this.decompte = setInterval(this.decompter, 100)
		},
		decompter () {
			const temps = this.calculerTempsRestant(this.duree)
			if (temps.secondes < 10) {
				this.texteSecondes = '0' + temps.secondes
			} else {
				this.texteSecondes = temps.secondes
			}
			if (temps.minutes < 10) {
				this.texteMinutes = '0' + temps.minutes
			} else {
				this.texteMinutes = temps.minutes
			}
			if (temps.total <= 0) {
				clearInterval(this.decompte)
				this.decompte = ''
				this.tempsEcoule = true
				this.$emit('tempsEcoule')
			}
		},
		calculerTempsRestant (d) {
			const temps = Date.parse(d) - Date.parse(new Date())
			const secondes = Math.floor((temps / 1000) % 60)
			const minutes = Math.floor((temps / 1000 / 60) % 60)
			return { total: temps, minutes: minutes, secondes: secondes }
		}
	}
}
</script>

<style>
#rebours {
	display: flex;
	justify-content: center;
	align-items: center;
	font-weight: 700;
	font-size: 20px;
	height: 40px;
	padding: 0 12px;
    border: 2px solid #ddd;
    border-radius: 5px;
	letter-spacing: 1px;
	text-indent: 1px;
	line-height: 1;
}

#rebours.rouge {
	color: #ff6259;
}

#rebours .separateur {
	padding: 0 1px;
}

#rebours + .bouton {
	margin-left: 20px;
}
</style>
