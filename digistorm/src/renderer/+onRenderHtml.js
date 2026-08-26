export { render as onRenderHtml }

import { escapeInject, dangerouslySkipEscape } from 'vike/server'

const locales = {
	de: 'de_DE',
	en: 'en_US',
	es: 'es_ES',
	fr: 'fr_FR',
	it: 'it_IT'
}

function render (pageContext) {
	let hote = 'https://digistorm.app'
	let titre = 'Digistorm by La Digitale'
	let langueParDefaut = import.meta.env.VITE_DEFAULT_LANGUAGE || 'fr'
	if (!locales.hasOwnProperty(langueParDefaut)) {
		langueParDefaut = 'fr'
	}
	let langue = langueParDefaut
	if (pageContext && pageContext.hasOwnProperty('pageProps') && pageContext.pageProps.hasOwnProperty('titrePage')) {
		titre = pageContext.pageProps.titrePage
	}
	if (pageContext && pageContext.hasOwnProperty('pageProps') && pageContext.pageProps.hasOwnProperty('hote')) {
		hote = pageContext.pageProps.hote
	}
	if (pageContext && pageContext.hasOwnProperty('pageProps') && pageContext.pageProps.hasOwnProperty('langue')) {
		langue = pageContext.pageProps.langue
	}
	if (!locales.hasOwnProperty(langue)) {
		langue = langueParDefaut
	}
	let url = hote
	if (pageContext && pageContext.hasOwnProperty('pageProps') && pageContext.pageProps.hasOwnProperty('urlOriginal')) {
		url = hote + pageContext.pageProps.urlOriginal
	}
	let robots = 'index,nofollow'
	if (url !== hote) {
		robots = 'noindex'
	}
	const locale = locales[langue]
	let umami = ''
	if (process.env.NODE_ENV === 'production' && import.meta.env.UMAMI_SCRIPT_URL && import.meta.env.UMAMI_SCRIPT_URL !== '' && import.meta.env.UMAMI_WEBSITE_ID && import.meta.env.UMAMI_WEBSITE_ID !== '') {
		umami = dangerouslySkipEscape('<script defer src="' + import.meta.env.UMAMI_SCRIPT_URL + '" data-website-id="' + import.meta.env.UMAMI_WEBSITE_ID + '"></script>')
	}
	const documentHtml = escapeInject`<!DOCTYPE html>
		<html lang="${langue}">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, height=device-height, viewport-fit=cover, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no">
				<meta name="mobile-web-app-capable" content="yes">
				<meta name="HandheldFriendly" content="true">
				<meta name="keywords" content="ladigitale, quizzes, wordclouds, surveys, brainstorming, education, openedtech, free software">
				<meta name="description" content="Un outil éducatif pour interagir en temps réel en présence ou à distance proposé par La Digitale">
				<meta name="robots" content="${robots}">
				<meta name="theme-color" content="#00ced1">
				<meta property="og:title" content="${titre}">
				<meta property="og:description" content="Un outil éducatif pour interagir en temps réel en présence ou à distance proposé par La Digitale">
				<meta property="og:type" content="website">
				<meta property="og:url" content="${url}">
				<meta property="og:image" content="${hote}/img/digistorm.png">
				<meta property="og:locale" content="${locale}">
				<title>${titre}</title>
				<link rel="icon" type="image/png" href="/img/favicon.png">
				${umami}
			</head>
			<body>
				<noscript>
      				<strong>Veuillez activer Javascript dans votre navigateur pour utiliser <i>Digistorm</i>.</strong>
    			</noscript>
				<div id="app"></div>
				<a id="ofelia-back" href="/" title="Portail" style="position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999;background:#1e293b;color:#38bdf8;border:1px solid #334155;width:38px;height:38px;border-radius:50%;text-decoration:none;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,.5);opacity:.92;display:flex;align-items:center;justify-content:center">&#127968;</a>
				<script>
				// Ofelia FEAT-041 — le portail vit sur le meme hote, sans le port
				// 3000. On le calcule ici plutot que de l'ecrire en dur : l'adresse
				// de la Box depend du chemin emprunte (cable, point d'acces Wi-Fi,
				// ZeroTier), et un lien fige serait faux dans deux cas sur trois.
				(function () {
				  var b = document.getElementById('ofelia-back');
				  if (b) b.href = location.protocol + '//' + location.hostname + '/';
				})();
				</script>
				<script src="/js/qrcode.js"></script>
				<script src="/js/fitty.js"></script>
				<script src="/js/charger-mathjax.js"></script>
			</body>
		</html>`
  	return {
    	documentHtml
  	}
}
