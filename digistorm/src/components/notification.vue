<template>
	<div id="notification" aria-live="polite" />
</template>

<script>
export default {
	name: 'DigistormNotification',
	props: {
		notification: String
	},
	watch: {
		notification (notification) {
			if (notification === '') return
			const element = document.createElement('div')
			element.textContent = notification
			element.classList.add('notification')
			document.querySelector('#notification')?.appendChild(element)
			setTimeout(() => {
				element?.remove()
				this.$emit('fermer')
			}, 2500)
		}
	}
}
</script>
