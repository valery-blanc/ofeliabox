<template>
	<div id="conteneur-message" class="conteneur-modale">
		<div id="message" class="modale" role="dialog">
			<div class="conteneur">
				<div class="contenu">
					<div class="message" v-html="message" />
					<div class="actions">
						<button type="button" class="bouton" @click="$emit('fermer')">{{ $t('fermer') }}</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
export default {
	name: 'DigistormMessage',
	props: {
		message: String
	},
	mounted () {
		if (this.message !== '') {
			this.$emit('elementPrecedent', document.activeElement || document.body)
			this.$nextTick(() => {
				document.querySelector('#message .bouton')?.focus()
			})
		}
	}
}
</script>
