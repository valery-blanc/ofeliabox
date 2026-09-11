export { render as onRenderClient }

import { createPageApp } from './app'

function render (pageContext) {
	if (pageContext.pageProps.hasOwnProperty('erreur')) {
		window.location.href = '/'
	} else {
		const app = createPageApp(pageContext)
		app.mount('#app')
	}
}
