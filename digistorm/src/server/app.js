import 'dotenv/config'
import path from 'path'
import fs from 'fs-extra'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/cluster-adapter'
import eiows from 'eiows'
import compression from 'compression'
import axios from 'axios'
import cors from 'cors'
import { createClient } from 'redis'
import helmet from 'helmet'
import v from 'voca'
import multer from 'multer'
import Busboy from 'busboy'
import PDFDocument from 'pdfkit'
import sharp from 'sharp'
import archiver from 'archiver'
import AdmZip from 'adm-zip'
import dayjs from 'dayjs'
import 'dayjs/locale/es.js'
import 'dayjs/locale/fr.js'
import 'dayjs/locale/it.js'
import 'dayjs/locale/de.js'
import localizedFormat from 'dayjs/plugin/localizedFormat.js'
import bcrypt from 'bcrypt'
import cron from 'node-cron'
import nodemailer from 'nodemailer'
import { fileURLToPath } from 'url'
import { RedisStore } from 'connect-redis'
import session from 'express-session'
import rateLimit from 'express-rate-limit'
import { RedisStore as RateLimitRedisStore } from 'rate-limit-redis'
import { randomBytes, timingSafeEqual } from 'crypto'
import Rabbit from 'crypto-js/rabbit.js'
import Utf8 from 'crypto-js/enc-utf8.js'
import { NameForgeJS } from './nameforge.js'
import { pipeline } from 'stream/promises'
import { Agent } from 'https'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { S3Client, CopyObjectCommand, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { renderPage, createDevMiddleware } from 'vike/server'
// Charger strings langues
import t from './lang.js'

const production = process.env.NODE_ENV === 'production'
let cluster = false
if (production) {
	cluster = parseInt(process.env.NODE_CLUSTER) === 1
}
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = `${__dirname}/..`

// Vérifier si un buffer est une image jpg ou png (pour PDFKit)
const magic = ['ffd8ffe0', '89504e47', 'ffd8ffe1']

demarrerServeur()

async function demarrerServeur () {
	const app = express()
	app.use(compression())
	const httpServer = createServer(app)

	let hote = 'http://localhost:3000'
	if (production) {
		hote = process.env.DOMAIN
	} else if (process.env.PORT) {
		hote = 'http://localhost:' + process.env.PORT
	}
	const hoteWs = hote.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
	const langues = ['fr', 'es', 'it', 'de', 'en']
	let langueParDefaut = 'fr'
	if (process.env.VITE_DEFAULT_LANGUAGE && langues.includes(process.env.VITE_DEFAULT_LANGUAGE)) {
		langueParDefaut = process.env.VITE_DEFAULT_LANGUAGE
	}
	let stockage = 'fs'
	const lienPublicS3 = process.env.VITE_S3_PUBLIC_LINK
	let s3Client = ''
	let bucket = ''
	if (process.env.VITE_STORAGE && process.env.VITE_STORAGE === 's3' && lienPublicS3 && lienPublicS3 !== '') {
		stockage = 's3'
		bucket = process.env.S3_BUCKET
	}
	if (stockage === 's3') {
		const s3ServerType = process.env.S3_SERVER_TYPE || 'aws'
		const maxSockets = parseInt(process.env.S3_MAX_SOCKETS) || 500
		const agent = new Agent({
			keepAlive: true,
			maxSockets: maxSockets
		})
		s3Client = new S3Client({
			endpoint: process.env.S3_ENDPOINT,
			region: process.env.S3_REGION,
			credentials: {
				accessKeyId: process.env.S3_ACCESS_KEY,
				secretAccessKey: process.env.S3_SECRET_KEY
			},
			forcePathStyle: s3ServerType === 'minio' ? true : false,
			requestHandler: new NodeHttpHandler({ httpsAgent: agent })
		})
	}
	let db
	const db_port = parseInt(process.env.DB_PORT) || 6379
	if (production) {
		db = await createClient({
			url: 'redis://default:' + process.env.DB_PWD  + '@' + process.env.DB_HOST + ':' + db_port
		}).on('error', (err) => {
			console.error('Erreur Redis : ' + err)
		}).on('ready', () => {
			console.log('Redis prêt')
		}).connect()
	} else {
		db = await createClient({
			url: 'redis://localhost:' + db_port
		}).on('error', (err) => {
			console.error('Erreur Redis : ' + err)
		}).on('ready', () => {
			console.log('Redis prêt')
		}).connect()
	}
	const cookieSecurise = parseInt(process.env.COOKIE_SECURE) !== 0
	let storeOptions, cookie, dureeSession, domainesAutorises
	if (production) {
		storeOptions = {
			host: process.env.DB_HOST,
			port: db_port,
			pass: process.env.DB_PWD,
			client: db,
			prefix: 'sessions:'
		}
		cookie = cookieSecurise ? { sameSite: 'None', secure: true } : { sameSite: 'Lax', secure: false }
	} else {
		storeOptions = {
			host: 'localhost',
			port: db_port,
			client: db,
			prefix: 'sessions:'
		}
		cookie = {
			secure: false
		}
	}
	if (production && !process.env.SESSION_KEY) {
		throw new Error('SESSION_KEY manquante dans les variables d\'environnement. Arrêt du serveur.')
	}
	const redisStore = new RedisStore(storeOptions)
	const sessionOptions = {
		secret: process.env.SESSION_KEY || 'cle-par-defaut-dev',
		store: redisStore,
		name: 'digistorm',
		resave: false,
		rolling: true,
		saveUninitialized: false,
		cookie: cookie
	}
	if (process.env.SESSION_DURATION) {
		dureeSession = parseInt(process.env.SESSION_DURATION)
	} else {
		dureeSession = 864000000 //3600 * 24 * 10 * 1000
	}
	const sessionMiddleware = session(sessionOptions)

	if (production && process.env.AUTHORIZED_DOMAINS) {
		domainesAutorises = process.env.AUTHORIZED_DOMAINS.split(',')
	} else {
		domainesAutorises = '*'
	}

	let earlyHints103 = false
	if (process.env.EARLY_HINTS && parseInt(process.env.EARLY_HINTS) === 1) {
		earlyHints103 = true
	}

	const transporter = nodemailer.createTransport({
		host: process.env.EMAIL_HOST,
		port: process.env.EMAIL_PORT,
		secure: parseInt(process.env.EMAIL_SECURE) === 1,
		auth: {
			user: process.env.EMAIL_ADDRESS,
			pass: process.env.EMAIL_PASSWORD
		}
	})

	cron.schedule('59 23 * * Saturday', async () => {
		await fs.emptyDir(path.join(__dirname, '..', '/static/temp'))
	})

	const cleCrypto = process.env.ENCRYPTION_KEY || ''

	const validationInscription = parseInt(process.env.ACCOUNT_VALIDATION) || 0

	// Charger plugin dayjs
	dayjs.extend(localizedFormat)

	const limiteTeleversement = (parseFloat(process.env.VITE_UPLOAD_LIMIT) || 5) * 1024 * 1000

	const limiteApi = rateLimit({
		windowMs: 15 * 60 * 1000,
		limit: 100,
		standardHeaders: 'draft-7',
		legacyHeaders: false,
		store: new RateLimitRedisStore({
			sendCommand: (...args) => db.sendCommand(args),
			prefix: 'rl-api:'
		}),
		skipSuccessfulRequests: true,
		validate: { trustProxy: false }
	})

	const limiteAuth = rateLimit({
		windowMs: 15 * 60 * 1000,
		limit: 10,
		standardHeaders: 'draft-7',
		legacyHeaders: false,
		store: new RateLimitRedisStore({
			sendCommand: (...args) => db.sendCommand(args),
			prefix: 'rl-auth:'
		}),
		skipSuccessfulRequests: true,
		validate: { trustProxy: false }
	})

	const limiteAuthAdmin = rateLimit({
		windowMs: 15 * 60 * 1000,
		limit: 3,
		standardHeaders: 'draft-7',
		legacyHeaders: false,
		store: new RateLimitRedisStore({
			sendCommand: (...args) => db.sendCommand(args),
			prefix: 'rl-admin:'
		}),
		skipSuccessfulRequests: true,
		validate: { trustProxy: false }
	})

	let scriptSrc
	let domaineUmami = null
	if (process.env.UMAMI_SCRIPT_URL && process.env.UMAMI_SCRIPT_URL !== '') {
		const umamiScriptUrl = new URL(process.env.UMAMI_SCRIPT_URL)
		domaineUmami = umamiScriptUrl.protocol + '//' + umamiScriptUrl.hostname
		scriptSrc = ["'self'", domaineUmami, "https://cdn.jsdelivr.net"]
	} else {
		scriptSrc = ["'self'", "https://cdn.jsdelivr.net"]
	}
	if (!production) {
		scriptSrc.push("'unsafe-inline'")
	}
	let hoteVite = 'ws://localhost:24678'
	if (production) {
		hoteVite = ''
	}
	app.set('trust proxy', true)
	app.use(
		helmet.contentSecurityPolicy({
			directives: {
				"default-src": ["'self'", "https:", "data:"],
				"connect-src": ["'self'", hoteWs, hoteVite, "https://cdn.jsdelivr.net", ...(domaineUmami ? [domaineUmami] : [])],
				"script-src": scriptSrc,
				"worker-src": ["'self'", "blob:"],
				"media-src": ["'self'", "https:", "data:"],
				"img-src": ["'self'", "https:", "data:"],
				"frame-ancestors": ["*"],
				"frame-src": ["*", "blob:"]
			}
		})
	)
	app.use(express.json({ limit: '10mb' }))
	app.use(sessionMiddleware)
	app.use(cors({ 'origin': domainesAutorises }))
	app.use('/api/', limiteApi)
	if (parseInt(process.env.REVERSE_PROXY) !== 1 || !production) {
		app.use('/', express.static('static'))
	}

	if (!production) {
		const { devMiddleware } = await createDevMiddleware({ root })
		app.use(devMiddleware)
	} else if (production && parseInt(process.env.REVERSE_PROXY) !== 1) {
		const sirv = (await import('sirv')).default
		app.use(sirv(`${root}/dist/client`))
	}

	app.get('/', async (req, res, next) => {
		if (req.session.identifiant && req.session.role === 'utilisateur') return res.redirect(302, '/u/' + req.session.identifiant)
		let langue = langueParDefaut
		if (req.session.hasOwnProperty('langue') && req.session.langue !== '') {
			langue = req.session.langue
		}
		const pageContextInit = {
			urlOriginal: req.originalUrl,
			params: req.query,
			hote: hote,
			langues: langues,
			langue: langue
		}
		const pageContext = await renderPage(pageContextInit)
		if (pageContext.errorWhileRendering) {
			if (!pageContext.httpResponse) throw pageContext.errorWhileRendering
		}
		const { httpResponse } = pageContext
		if (!httpResponse) return next()
		const { body, statusCode, headers, earlyHints } = httpResponse
		if (earlyHints103 === true && res.writeEarlyHints) {
			res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
		}
		if (headers) {
			headers.forEach(([name, value]) => res.setHeader(name, value))
		}
		res.status(statusCode).send(body)
	})

	app.get('/u/:utilisateur', async (req, res, next) => {
		const identifiant = req.params.utilisateur
		if (identifiant !== req.session.identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) {
			supprimerSession(req)
			return res.redirect(302, '/')
		}
		try {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return res.redirect(302, '/')
			if (comparerHash(req.session.motdepasse, donneesUtilisateur.motdepasse) === false) {
				supprimerSession(req)
				return res.redirect(302, '/')
			}
			const donneesContenusUtilisateur = await recupererDonnees(identifiant)
			let contenusSupprimes = []
			let favorisSupprimes = []
			let interactions = donneesContenusUtilisateur[0].filter((element) => {
				if (element.hasOwnProperty('code')) {
					element.code = parseInt(element.code)
				}
				return element !== '' && Object.keys(element).length > 0
			})
			let corbeille = donneesContenusUtilisateur[1].filter((element) => {
				if (element.hasOwnProperty('code')) {
					element.code = parseInt(element.code)
					contenusSupprimes.push(element.code)
				}
				return element !== '' && Object.keys(element).length > 0
			})
			let favoris = donneesContenusUtilisateur[2].filter((element) => {
				if (element.hasOwnProperty('code')) {
					element.code = parseInt(element.code)
					if (contenusSupprimes.includes(element.code)) {
						favorisSupprimes.push(element.code)
					}
				}
				return element !== '' && Object.keys(element).length > 0 && !contenusSupprimes.includes(element.code)
			})
			const filtre = donneesContenusUtilisateur[3]
			// Supprimer doublons
			interactions = interactions.filter((valeur, index, self) =>
				index === self.findIndex((t) => (
					t.code === valeur.code
				))
			)
			favoris = favoris.filter((valeur, index, self) =>
				index === self.findIndex((t) => (
					t.code === valeur.code
				))
			)
			corbeille = corbeille.filter((valeur, index, self) =>
				index === self.findIndex((t) => (
					t.code === valeur.code
				))
			)
			// Dossiers
			let contenusSupprimesDansDossiers = []
			let dossiers = []
			if (donneesUtilisateur.hasOwnProperty('dossiers')) {
				try {
					dossiers = parseJSON(donneesUtilisateur.dossiers, [])
				} catch (err) {
					dossiers = []
				}
			}
			const listeInteractions = []
			dossiers.forEach((dossier, indexDossier) => {
				dossier.contenus.forEach((contenu, indexContenu) => {
					dossiers[indexDossier].contenus[indexContenu] = parseInt(contenu)
					if (contenusSupprimes.includes(parseInt(contenu))) {
						contenusSupprimesDansDossiers.push({ code: parseInt(contenu), dossier: dossier.id })
					}
					if (!listeInteractions.includes(parseInt(contenu)) && !contenusSupprimes.includes(parseInt(contenu))) {
						listeInteractions.push(parseInt(contenu))
					}
				})
			})
			const interactionsSupprimees = await Promise.all(listeInteractions.map(async (interaction) => {
				const interactionExiste = await db.EXISTS('interactions:' + interaction)
				if (interactionExiste === 0) {
					return parseInt(interaction)
				} else {
					return null
				}
			}))
			interactionsSupprimees.forEach((interactionSupprimee) => {
				if (interactionSupprimee) {
					dossiers.forEach((dossier, indexDossier) => {
						if (dossier.contenus.includes(interactionSupprimee)) {
							const index = dossier.contenus.indexOf(interactionSupprimee)
							dossiers[indexDossier].contenus.splice(index, 1)
						}
					})
				}
			})
			// Préparer contenus corbeille avec favoris et dossiers
			corbeille.forEach((contenu, indexContenu) => {
				if (favorisSupprimes.includes(contenu.code)) {
					corbeille[indexContenu].favori = true
				} else {
					corbeille[indexContenu].favori = false
				}
				if (contenusSupprimesDansDossiers.map((e) => { return e.code }).includes(contenu.code)) {
					const index = contenusSupprimesDansDossiers.map((e) => { return e.code }).indexOf(contenu.code)
					corbeille[indexContenu].dossier = contenusSupprimesDansDossiers[index].dossier
				} else {
					corbeille[indexContenu].dossier = ''
				}
			})
			// Supprimer doublons dans dossiers
			dossiers.forEach((dossier, indexDossier) => {
				const listeInteractions = []
				dossiers[indexDossier].contenus = dossier.contenus.filter((contenu) => {
					if (!listeInteractions.includes(contenu)) {
						listeInteractions.push(contenu)
						return true
					}
					return false
				})
			})
			await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
			// Supprimer contenus corbeille dans dossiers
			dossiers.forEach((dossier, indexDossier) => {
				dossiers[indexDossier].contenus = dossier.contenus.filter((element) => {
					return !contenusSupprimes.includes(element)
				})
			})
			const pageContextInit = {
				urlOriginal: req.originalUrl,
				params: req.query,
				hote: hote,
				langues: langues,
				identifiant: req.session.identifiant,
				nom: req.session.nom,
				email: req.session.email,
				langue: req.session.langue,
				role: req.session.role,
				interactions: interactions,
				favoris: favoris,
				corbeille: corbeille,
				dossiers: dossiers,
				filtre: filtre
			}
			const pageContext = await renderPage(pageContextInit)
			if (pageContext.errorWhileRendering) {
				if (!pageContext.httpResponse) throw pageContext.errorWhileRendering
			}
			const { httpResponse } = pageContext
			if (!httpResponse) return next()
			const { body, statusCode, headers, earlyHints } = httpResponse
			if (earlyHints103 === true && res.writeEarlyHints) {
				res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
			}
			if (headers) {
				headers.forEach(([name, value]) => res.setHeader(name, value))
			}
			res.status(statusCode).send(body)
		} catch {
			supprimerSession(req)
			res.redirect(302, '/')
		}
	})

	app.get('/c/:code', async (req, res, next) => {
		const code = parseInt(req.params.code)
		if (req.session.identifiant === '' || req.session.identifiant === undefined) {
			const identifiant = 'u' + Math.random().toString(16).slice(3)
			req.session.identifiant = identifiant
			req.session.motdepasse = ''
			req.session.nom = ''
			req.session.email = ''
			req.session.langue = langueParDefaut
			req.session.role = 'invite'
			req.session.interactions = []
			req.session.cookie.expires = new Date(Date.now() + dureeSession)
		}
		if (!req.session.hasOwnProperty('interactions')) {
			req.session.interactions = []
		}
		if (req.query.id && req.query.id !== '' && req.query.mdp && req.query.mdp !== '') {
			try {
				const id = decodeURIComponent(req.query.id)
				const mdpB = Rabbit.decrypt(decodeURIComponent(req.query.mdp), cleCrypto)
				const mdp = mdpB.toString(Utf8)
				const { acces, utilisateur } = await verifierAcces(code, id, mdp)
				if (acces === 'interaction_debloquee') {
					let nom = ''
					let langue = langueParDefaut
					if (utilisateur.hasOwnProperty('nom')) {
						nom = utilisateur.nom
					}
					if (req.session.langue && req.session.langue !== '') {
						langue = req.session.langue
					}
					if (utilisateur.hasOwnProperty('langue')) {
						langue = utilisateur.langue
					}
					req.session.identifiant = id
					req.session.motdepasse = ''
					req.session.nom = nom
					req.session.email = ''
					req.session.langue = langue
					req.session.role = 'auteur'
					if (!req.session.interactions.map(item => item.code).includes(code)) {
						req.session.interactions.push({ code: code, motdepasse: mdp })
					}
					req.session.cookie.expires = new Date(Date.now() + dureeSession)
				}
			} catch (e) {
				console.error(e.message)
			}
		}
		let pageContextInit = {}
		const interactionExiste = await db.EXISTS('interactions:' + code)
		if (interactionExiste !== 1) { 
			pageContextInit = {
				urlOriginal: req.originalUrl,
				erreur: true
			}
		} else {
			let donneesInteractions = await db.HGETALL('interactions:' + code)
			donneesInteractions = donneesInteractions ? { ...donneesInteractions } : {}
			const type = donneesInteractions.type
			const titre = donneesInteractions.titre
			let proprietaire = ''
			let motdepasse = ''
			let donnees = {}
			let reponses = []
			let sessions = []
			let bannis = []
			const statut = donneesInteractions.statut
			const session = parseInt(donneesInteractions.session)
			let digidrive = 0
			let identifiantInteraction = ''
			if (donneesInteractions.hasOwnProperty('identifiant')) {
				identifiantInteraction = donneesInteractions.identifiant
			}
			const admin = await verifierAdmin(code, identifiantInteraction, req.session)
			if (admin === true) {
				proprietaire = identifiantInteraction
				if (donneesInteractions.hasOwnProperty('motdepasse')) {
					motdepasse = donneesInteractions.motdepasse
				}
				donnees = parseJSON(donneesInteractions.donnees, {})
				reponses = parseJSON(donneesInteractions.reponses, {})
				sessions = parseJSON(donneesInteractions.sessions, {})
				if (donneesInteractions.hasOwnProperty('bannis')) {
					bannis = parseJSON(donneesInteractions.bannis, [])
				}
				if (req.session.role === 'auteur' && donneesInteractions.hasOwnProperty('digidrive')) {
					digidrive = parseInt(donneesInteractions.digidrive)
				}
			}
			if (admin === false && identifiantInteraction !== '') return res.redirect(302, '/')
			pageContextInit = {
				urlOriginal: req.originalUrl,
				params: req.query,
				hote: hote,
				langues: langues,
				identifiant: req.session.identifiant,
				nom: req.session.nom,
				email: req.session.email,
				langue: req.session.langue,
				role: req.session.role,
				interactions: req.session.interactions,
				type: type,
				titre: titre,
				proprietaire: proprietaire,
				motdepasse: motdepasse,
				donnees: donnees,
				reponses: reponses,
				sessions: sessions,
				bannis: bannis,
				statut: statut,
				session: session,
				digidrive: digidrive
			}
		}
		const pageContext = await renderPage(pageContextInit)
		if (pageContext.errorWhileRendering) {
			if (!pageContext.httpResponse) throw pageContext.errorWhileRendering
		}
		const { httpResponse } = pageContext
		if (!httpResponse) return next()
		const { body, statusCode, headers, earlyHints } = httpResponse
		if (earlyHints103 === true && res.writeEarlyHints) {
			res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
		}
		if (headers) {
			headers.forEach(([name, value]) => res.setHeader(name, value))
		}
		res.status(statusCode).send(body)
	})

	app.get('/p/:code', async (req, res, next) => {
		if (req.session.identifiant === '' || req.session.identifiant === undefined) {
			const identifiant = 'u' + Math.random().toString(16).slice(3)
			req.session.identifiant = identifiant
			req.session.motdepasse = ''
			req.session.nom = ''
			req.session.email = ''
			req.session.langue = langueParDefaut
			req.session.role = 'invite'
			req.session.interactions = []
			req.session.cookie.expires = new Date(Date.now() + dureeSession)
		}
		if (!req.session.hasOwnProperty('interactions')) {
			req.session.interactions = []
		}
		const pageContextInit = {
			urlOriginal: req.originalUrl,
			params: req.query,
			hote: hote,
			langues: langues,
			identifiant: req.session.identifiant,
			nom: req.session.nom,
			langue: req.session.langue
		}
		const pageContext = await renderPage(pageContextInit)
		if (pageContext.errorWhileRendering) {
			if (!pageContext.httpResponse) throw pageContext.errorWhileRendering
		}
		const { httpResponse } = pageContext
		if (!httpResponse) return next()
		const { body, statusCode, headers, earlyHints } = httpResponse
		if (earlyHints103 === true && res.writeEarlyHints) {
			res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
		}
		if (headers) {
			headers.forEach(([name, value]) => res.setHeader(name, value))
		}
		res.status(statusCode).send(body)
	})

	app.get('/admin', async (req, res, next) => {
		let langue = langueParDefaut
		if (req.session.hasOwnProperty('langue') && req.session.langue !== '') {
			langue = req.session.langue
		}
		const pageContextInit = {
			urlOriginal: req.originalUrl,
			params: req.query,
			hote: hote,
			langues: langues,
			langue: langue
		}
		const pageContext = await renderPage(pageContextInit)
		if (pageContext.errorWhileRendering) {
			if (!pageContext.httpResponse) throw pageContext.errorWhileRendering
		}
		const { httpResponse } = pageContext
		if (!httpResponse) return next()
		const { body, statusCode, headers, earlyHints } = httpResponse
		if (earlyHints103 === true && res.writeEarlyHints) {
			res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
		}
		if (headers) {
			headers.forEach(([name, value]) => res.setHeader(name, value))
		}
		res.status(statusCode).send(body)
	})

	app.post('/api/s-inscrire', limiteAuth, async (req, res) => {
		try {
			const identifiant = req.body.identifiant
			if (typeof identifiant !== 'string' || !identifiant.match(/^[\w-]+$/)) return res.status(400).send('identifiant_invalide')
			const motdepasse = req.body.motdepasse
			const emailBrut = req.body.email
			if (typeof emailBrut !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailBrut)) return res.status(400).send('erreur')
			const email = emailBrut.toLowerCase()
			const utilisateurExiste = await db.EXISTS('utilisateurs:' + identifiant)
			if (utilisateurExiste === 1) return res.status(409).send('utilisateur_existe_deja')
			if (utilisateurExiste !== 0) return res.status(500).send('erreur')
			const emailExiste = await db.EXISTS('emails:' + email)
			if (emailExiste === 1) return res.status(409).send('email_existe_deja')
			if (emailExiste === 0 && validationInscription === 1) {
				let codeActivation = randomBytes(18)
				codeActivation = codeActivation.toString('hex')
				const hash = await bcrypt.hash(motdepasse, 10)
				const date = dayjs().format()
				let langue = langueParDefaut
				if (req.session && req.session.hasOwnProperty('langue') && req.session.langue !== '') {
					langue = req.session.langue
				}
				await db.multi()
					.HSET('activations:' + codeActivation, ['id', identifiant, 'motdepasse', hash, 'date', date, 'email', email, 'langue', langue])
					.EXPIRE('activations:' + codeActivation, 43200)
					.exec()
				const message = {
					from: process.env.EMAIL_ADDRESS,
					to: email,
					subject: 'Activation de votre compte Digistorm',
					html: '<p>Vous avez créé un compte Digistorm ayant pour identifiant : <strong>' + v.escapeHtml(identifiant) + '</strong></p><p>Cliquez sur ce lien pour activer votre compte : <a href="' + hote + '/activation/' + codeActivation + '" target="_blank">' + hote + '/activation/' + codeActivation + '</a>.</p><p>Veuillez ignorer ce message si vous n\'êtes pas à l\'origine de cette création de compte.</p><p>La Digitale</p>'
				}
				transporter.sendMail(message, async (err) => {
					if (err) return res.status(500).send('erreur_email')
					res.status(200).send('activation_demandee')
				})
			} else if (emailExiste === 0 && validationInscription === 0) {
				const hash = await bcrypt.hash(motdepasse, 10)
				const date = dayjs().format()
				let langue = langueParDefaut
				if (req.session && req.session.hasOwnProperty('langue') && req.session.langue !== '') {
					langue = req.session.langue
				}
				await db.multi()
					.HSET('utilisateurs:' + identifiant, ['id', identifiant, 'email', email, 'motdepasse', hash, 'date', date, 'nom', '', 'langue', langue])
					.HSET('emails:' + email, 'identifiant', identifiant)
					.exec()
				req.session.identifiant = identifiant
				req.session.motdepasse = hash
				req.session.nom = ''
				req.session.email = email
				if (!req.session.langue || req.session.langue === '') {
					req.session.langue = langueParDefaut
				}
				req.session.role = 'utilisateur'
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				const message = {
					from: process.env.EMAIL_ADDRESS,
					to: email,
					subject: 'Nouveau compte Digistorm',
					html: '<p>Vous avez créé un compte Digistorm ayant pour identifiant : <strong>' + v.escapeHtml(identifiant) + '</strong></p><p>Conservez bien cet identifiant, il est nécessaire pour vous connecter à votre compte.</p><p>La Digitale</p>'
				}
				transporter.sendMail(message, async (err) => {
					if (err) return res.status(500).send('erreur_email')
					res.status(200).send('compte_cree')
				})
			} else {
				res.status(500).send('erreur')
			}
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.get('/activation/:code', async (req, res, next) => {
		if (validationInscription === 0) return res.redirect(302, '/')
		try {
			const codeActivation = req.params.code
			const codeActivationExiste = await db.EXISTS('activations:' + codeActivation)
			if (codeActivationExiste !== 1) return res.redirect(302, '/')
			let donneesActivation = await db.HGETALL('activations:' + codeActivation)
			donneesActivation = donneesActivation ? { ...donneesActivation } : {}
			if (Object.keys(donneesActivation).length === 0) return res.redirect(302, '/')
			const identifiant = donneesActivation.id
			const email = donneesActivation.email
			const motdepasse = donneesActivation.motdepasse
			const date = donneesActivation.date
			const langue = donneesActivation.langue
			const utilisateurExiste = await db.EXISTS('utilisateurs:' + identifiant)
			if (utilisateurExiste !== 0) return res.redirect(302, '/')
			const emailExiste = await db.EXISTS('emails:' + email)
			if (emailExiste !== 0) return res.redirect(302, '/')
			await db.multi()
				.HSET('utilisateurs:' + identifiant, ['id', identifiant, 'email', email, 'motdepasse', motdepasse, 'date', date, 'nom', '', 'langue', langue])
				.HSET('emails:' + email, 'identifiant', identifiant)
				.UNLINK('activations:' + codeActivation)
				.exec()
			const pageContextInit = {
				urlOriginal: req.originalUrl,
				params: req.query,
				hote: hote,
				langues: langues,
				langue: langue
			}
			const pageContext = await renderPage(pageContextInit)
			if (pageContext.errorWhileRendering) {
				if (!pageContext.httpResponse) throw pageContext.errorWhileRendering
			}
			const { httpResponse } = pageContext
			if (!httpResponse) return next()
			const { body, statusCode, headers, earlyHints } = httpResponse
			if (earlyHints103 === true && res.writeEarlyHints) {
				res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
			}
			if (headers) {
				headers.forEach(([name, value]) => res.setHeader(name, value))
			}
			res.status(statusCode).send(body)
		} catch (err) {
			console.error(err.stack)
			res.redirect(302, '/')
		}
	})

	app.post('/api/se-connecter', limiteAuth, async (req, res) => {
		try {
			const identifiant = req.body.identifiant
			const motdepasse = req.body.motdepasse
			const utilisateurExiste = await db.EXISTS('utilisateurs:' + identifiant)
			if (utilisateurExiste !== 1) return res.status(401).send('erreur_connexion')
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (Object.keys(donneesUtilisateur).length === 0) return res.status(401).send('erreur_connexion')
			let comparaison = false
			if (motdepasse.trim() !== '' && donneesUtilisateur.hasOwnProperty('motdepasse') && donneesUtilisateur.motdepasse.trim() !== '') {
				comparaison = await bcrypt.compare(motdepasse, donneesUtilisateur.motdepasse)
			}
			let comparaisonTemp = false
			if (donneesUtilisateur.hasOwnProperty('motdepassetemp') && donneesUtilisateur.motdepassetemp.trim() !== '' && motdepasse.trim() !== '') {
				comparaisonTemp = await bcrypt.compare(motdepasse, donneesUtilisateur.motdepassetemp)
			}
			if (comparaison === false && comparaisonTemp === false) return res.status(401).send('erreur_connexion')
			let hashSession = donneesUtilisateur.motdepasse
			if (comparaisonTemp === true) {
				hashSession = await bcrypt.hash(motdepasse, 10)
				await db.HSET('utilisateurs:' + identifiant, 'motdepasse', hashSession)
				await db.HDEL('utilisateurs:' + identifiant, 'motdepassetemp')
			}
			const nom = donneesUtilisateur.nom
			const langue = donneesUtilisateur.langue
			let email = ''
			if (donneesUtilisateur.hasOwnProperty('email')) {
				email = donneesUtilisateur.email.toLowerCase()
			}
			await new Promise((resolve, reject) => {
				req.session.regenerate((err) => { if (err) reject(err); else resolve() })
			})
			req.session.identifiant = identifiant
			req.session.motdepasse = hashSession
			req.session.nom = nom
			req.session.langue = langue
			req.session.role = 'utilisateur'
			req.session.email = email
			req.session.cookie.expires = new Date(Date.now() + dureeSession)
			res.status(200).send(identifiant)
		} catch (err) {
			console.error(err.stack)
			res.status(401).send('erreur_connexion')
		}
	})

	app.post('/api/mot-de-passe-oublie', limiteAuth, async (req, res) => {
		try {
			if (typeof req.body.identifiant !== 'string' || typeof req.body.email !== 'string') return res.status(400).send('erreur')
			const identifiant = req.body.identifiant
			let email = req.body.email.toLowerCase().trim()
			const utilisateurExiste = await db.EXISTS('utilisateurs:' + identifiant)
			if (utilisateurExiste !== 1) return res.status(400).send('identifiant_invalide')
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if ((donneesUtilisateur.hasOwnProperty('email') && donneesUtilisateur.email.toLowerCase() === email) || (verifierEmail(identifiant) === true)) {
				if (!donneesUtilisateur.hasOwnProperty('email') || (donneesUtilisateur.hasOwnProperty('email') && donneesUtilisateur.email === '')) {
					email = identifiant
				}
				const motdepasse = genererMotDePasse(12)
				const message = {
					from: process.env.EMAIL_ADDRESS,
					to: email,
					subject: 'Mot de passe Digistorm',
					html: '<p>Votre nouveau mot de passe : ' + motdepasse + '</p><p>Identifiant : ' + identifiant + '</p>'
				}
				await new Promise((resolve, reject) => {
					transporter.sendMail(message, (err) => { if (err) reject(err); else resolve() })
				})
				const hash = await bcrypt.hash(motdepasse, 10)
				await db.HSET('utilisateurs:' + identifiant, 'motdepassetemp', hash)
				res.status(200).send('message_envoye')
			} else {
				res.status(400).send('email_invalide')
			}
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur_email')
		}
	})

	app.post('/api/se-deconnecter', (req, res) => {
		supprimerSession(req)
		res.status(200).send('deconnecte')
	})

	app.post('/api/modifier-langue', (req, res) => {
		const langue = req.body.langue
		if (!langues.includes(langue)) return res.status(400).send('non_autorise')
		req.session.langue = langue
		req.session.save(() => {
			res.status(200).send('langue_modifiee')
		})
	})

	app.post('/api/modifier-nom', (req, res) => {
		const nom = req.body.nom
		req.session.nom = nom
		req.session.save(() => {
			res.status(200).send('nom_modifie')
		})
	})

	app.post('/api/generer-nom', (req, res) => {
		const generateur = new NameForgeJS()
		const noms = generateur.generateNames()
		const nom = noms[0].replace(/(^\w{1})|(\s+\w{1})/g, lettre => lettre.toUpperCase())
		req.session.nom = nom
		req.session.save(() => {
			res.status(200).send(nom)
		})
	})

	app.post('/api/modifier-filtre', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) {
			supprimerSession(req)
			return res.status(401).send('non_connecte')
		}
		try {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return res.status(500).send('erreur')
			if (comparerHash(req.session.motdepasse, donneesUtilisateur.motdepasse) === false) return res.status(403).send('non_autorise')
			const filtre = req.body.filtre
			await db.HSET('utilisateurs:' + identifiant, 'filtre', filtre)
			res.status(200).send('filtre_modifie')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/modifier-informations-utilisateur', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) {
			supprimerSession(req)
			return res.status(401).send('non_connecte')
		}
		try {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return res.status(500).send('erreur')
			if (comparerHash(req.session.motdepasse, donneesUtilisateur.motdepasse) === false) return res.status(403).send('non_autorise')
			const nom = req.body.nom
			const email = req.body.email.toLowerCase()
			await db.HSET('utilisateurs:' + identifiant, ['nom', nom, 'email', email])
			req.session.nom = nom
			req.session.email = email
			res.status(200).send('utilisateur_modifie')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/modifier-mot-de-passe-utilisateur', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur') return res.status(401).send('non_connecte')
		try {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return res.status(500).send('erreur')
			const motdepasse = req.body.motdepasse
			const nouveaumotdepasse = req.body.nouveaumotdepasse
			if (motdepasse.trim() !== '' && nouveaumotdepasse.trim() !== '' && donneesUtilisateur.hasOwnProperty('motdepasse') && donneesUtilisateur.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, donneesUtilisateur.motdepasse)) {
				const hash = await bcrypt.hash(nouveaumotdepasse, 10)
				await db.HSET('utilisateurs:' + identifiant, 'motdepasse', hash)
				req.session.motdepasse = hash
				res.status(200).send('motdepasse_modifie')
			} else {
				res.status(401).send('motdepasse_incorrect')
			}
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/verifier-mot-de-passe-admin', limiteAuthAdmin, (req, res) => {
		const admin = req.body.admin
		if (!verifierMotDePasseAdmin(admin)) return res.status(403).send('acces_invalide')
		res.status(200).send('acces_verifie')
	})

	app.post('/api/modifier-mot-de-passe-admin', limiteAuthAdmin, async (req, res) => {
		const admin = req.body.admin
		if (!verifierMotDePasseAdmin(admin)) return res.status(403).send('non_autorise')
		const identifiant = req.body.identifiant
		const email = req.body.email ? req.body.email.toLowerCase() : ''
		const nouveauMotDePasse = req.body.motdepasse
		try {
			if (identifiant !== '') {
				const utilisateurExiste = await db.EXISTS('utilisateurs:' + identifiant)
				if (utilisateurExiste !== 1) return res.status(400).send('identifiant_non_valide')
				const hash = await bcrypt.hash(nouveauMotDePasse, 10)
				await db.HSET('utilisateurs:' + identifiant, 'motdepasse', hash)
				return res.status(200).send('motdepasse_modifie')
			}
			if (email !== '') {
				const clesUtilisateurs = []
				for await (const cle of db.scanIterator({ MATCH: 'utilisateurs:*', COUNT: 100 })) {
					clesUtilisateurs.push(...cle)
				}
				if (clesUtilisateurs.length === 0) return res.status(400).send('email_non_valide')
				const utilisateurs = clesUtilisateurs.map(cle => cle.substring(13))
				// Récupération parallèle des emails pour chaque utilisateur
				const promessesEmails = utilisateurs.map(async (id) => {
					let donneesUtilisateur = await db.HGETALL('utilisateurs:' + id)
					donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
					if (donneesUtilisateur.hasOwnProperty('email')) {
						return { id: id, email: donneesUtilisateur.email.toLowerCase() }
					}
					return null
				})
				const listeEmails = await Promise.all(promessesEmails)
				// Recherche de l'utilisateur correspondant à l'email
				const utilisateurEmail = listeEmails.find(user => user && user.email === email)
				if (utilisateurEmail) {
					const hash = await bcrypt.hash(nouveauMotDePasse, 10)
					await db.HSET('utilisateurs:' + utilisateurEmail.id, 'motdepasse', hash)
					return res.status(200).send(utilisateurEmail.id)
				} else {
					return res.status(400).send('email_non_valide')
				}
			}
			return res.status(500).send('erreur')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/recuperer-donnees-interaction-admin', limiteAuthAdmin, async (req, res) => {
		const code = parseInt(req.body.code)
		const admin = req.body.admin
		if (!verifierMotDePasseAdmin(admin)) return res.status(403).send('non_autorise')
		try {
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste !== 1) return res.status(404).send('interaction_inexistante')
			let donneesInteraction = await db.HGETALL('interactions:' + code)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			res.status(200).json(donneesInteraction)
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/modifier-donnees-interaction-admin', limiteAuthAdmin, async (req, res) => {
		const admin = req.body.admin
		if (!verifierMotDePasseAdmin(admin)) return res.status(403).send('non_autorise')
		try {
			const code = parseInt(req.body.code)
			const champ = req.body.champ
			const valeur = req.body.valeur
			const champsAutorises = ['titre', 'motdepasse']
			if (!champsAutorises.includes(champ)) return res.status(500).send('erreur')
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste !== 1) return res.status(404).send('interaction_inexistante')
			await db.HSET('interactions:' + code, champ, valeur)
			res.status(200).send('donnees_modifiees')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/modifier-langue-utilisateur', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant) return res.status(401).send('non_connecte')
		const langue = req.body.langue
		if (!langues.includes(langue)) return res.status(400).send('non_autorise')
		try {
			await db.HSET('utilisateurs:' + identifiant, 'langue', langue)
			req.session.langue = langue
			res.status(200).send('langue_modifiee')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/supprimer-compte', async (req, res) => {
		const identifiant = req.body.identifiant
		const motdepasseAdmin = req.body.admin
		let admin = false
		if (verifierMotDePasseAdmin(motdepasseAdmin)) {
			admin = true
		}
		const utilisateurConnecte = ((req.session.identifiant && req.session.identifiant === identifiant && req.session.role === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') || admin)
		if (!utilisateurConnecte) return res.status(401).send('non_connecte')
		try {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return res.status(500).send('erreur')
			if (!admin && comparerHash(req.session.motdepasse, donneesUtilisateur.motdepasse) === false) return res.status(403).send('non_autorise')
			const email = donneesUtilisateur.email
			const interactions = await db.SMEMBERS('interactions-creees:' + identifiant)
			if (interactions === null) return res.status(500).send('erreur')
			await Promise.all(interactions.map(async (interaction) => {
				await db.UNLINK('interactions:' + interaction)
				const chemin = path.join(__dirname, '..', '/static/fichiers/' + interaction)
				if (stockage === 'fs' && await fs.pathExists(chemin)) {
					await fs.remove(chemin)
				} else if (stockage === 's3') {
					const listeObjets = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: interaction + '/' }))
					if (listeObjets && listeObjets.Contents) {
						const promessesCopiesS3 = listeObjets.Contents.map((objet) => {
							return s3Client.send(new DeleteObjectCommand(definirParametresSupprimerS3(objet.Key)))
						})
						await Promise.all(promessesCopiesS3)
					}
				}
			}))
			await db.multi()
				.UNLINK('interactions-creees:' + identifiant)
				.UNLINK('favoris:' + identifiant)
				.UNLINK('interactions-supprimees:' + identifiant)
				.UNLINK('utilisateurs:' + identifiant)
				.UNLINK('emails:' + email)
				.exec()
			if (!admin) {
				supprimerSession(req)
				return res.status(200).send('compte_supprime')
			}
			try {
				const listeSessions = []
				for await (const cle of db.scanIterator({ MATCH: 'sessions:*', COUNT: 100 })) {
					listeSessions.push(...cle)
				}
				if (listeSessions.length > 0) {
					const promessesSessions = listeSessions.map(async (session) => {
						const sessionId = session.substring(9)
						const donneesSessionStr = await db.GET('sessions:' + sessionId)
						if (donneesSessionStr) {
							const donneesSession = JSON.parse(donneesSessionStr)
							if (donneesSession.hasOwnProperty('identifiant') && donneesSession.identifiant === identifiant) {
								await db.UNLINK('sessions:' + sessionId)
							}
						}
					})
					await Promise.all(promessesSessions)
				}
			} catch (err) {
				console.error(err.stack)
			}
			res.status(200).send('compte_supprime')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/rejoindre-interaction', async (req, res) => {
		const code = parseInt(req.body.code)
		try {
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste !== 1) return res.status(400).send('erreur_code')
			if (!req.session.identifiant) {
				const identifiant = 'u' + Math.random().toString(16).slice(3)
				req.session.identifiant = identifiant
				req.session.motdepasse = ''
				req.session.nom = ''
				req.session.email = ''
				req.session.langue = langueParDefaut
				req.session.role = 'invite'
				req.session.interactions = []
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
			}
			res.status(200).send(code)
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/creer-interaction', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) {
			supprimerSession(req)
			return res.status(401).send('non_connecte')
		}
		try {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return res.status(500).send('erreur')
			if (comparerHash(req.session.motdepasse, donneesUtilisateur.motdepasse) === false) return res.status(403).send('non_autorise')
			const titre = req.body.titre
			const type = req.body.type
			const code = Math.floor(1000000 + Math.random() * 9000000)
			const date = dayjs().format()
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste === 1) return res.status(409).send('existe_deja')
			await db.multi()
				.HSET('interactions:' + code, ['type', type, 'titre', titre, 'code', code, 'identifiant', identifiant, 'motdepasse', '', 'donnees', JSON.stringify({}), 'reponses', JSON.stringify({}), 'sessions', JSON.stringify({}), 'statut', '', 'session', 1, 'date', date, 'digidrive', 0])
				.SADD('interactions-creees:' + identifiant, code.toString())
				.exec()
			if (stockage === 'fs') {
				const chemin = path.join(__dirname, '..', '/static/fichiers/' + code.toString())
				await fs.mkdirp(chemin)
			}
			const destination = req.body.dossier
			if (destination !== '') {
				const dossiers = parseJSON(donneesUtilisateur.dossiers, [])
				dossiers.forEach((dossier, indexDossier) => {
					if (dossier.id === destination) {
						dossiers[indexDossier].contenus.push(code)
					}
				})
				await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
			}
			res.status(200).send(code)
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/creer-interaction-sans-compte', async (req, res) => {
		if (!req.session.identifiant || (req.session.identifiant.length !== 13 && req.session.identifiant.substring(0, 1) !== 'u')) {
			const identifiant = 'u' + Math.random().toString(16).slice(3)
			req.session.identifiant = identifiant
		}
		if (!req.session.hasOwnProperty('interactions')) {
			req.session.interactions = []
		}
		try {
			const titre = req.body.titre
			const type = req.body.type
			const code = Math.floor(1000000 + Math.random() * 9000000)
			const motdepasse = creerMotDePasse()
			const date = dayjs().format()
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste === 1) return res.status(409).send('existe_deja')
			await db.HSET('interactions:' + code, ['type', type, 'titre', titre, 'code', code, 'motdepasse', motdepasse, 'donnees', JSON.stringify({}), 'reponses', JSON.stringify({}), 'sessions', JSON.stringify({}), 'statut', '', 'session', 1, 'date', date, 'digidrive', 0])
			if (stockage === 'fs') {
				const chemin = path.join(__dirname, '..', '/static/fichiers/' + code.toString())
				await fs.mkdirp(chemin)
			}
			req.session.nom = ''
			req.session.email = ''
			if (!req.session.langue || req.session.langue === '') {
				req.session.langue = langueParDefaut
			}
			req.session.role = 'auteur'
			req.session.interactions.push({ code: code, motdepasse: motdepasse })
			req.session.cookie.expires = new Date(Date.now() + dureeSession)
			res.status(200).send(code)
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/modifier-interaction', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant) return res.status(403).json({ message: 'non_connecte' })
		try {
			const code = parseInt(req.body.code)
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste !== 1) return res.status(400).send('erreur_code')
			let donneesInteraction = await db.HGETALL('interactions:' + code)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			let identifiantInteraction = ''
			if (donneesInteraction.hasOwnProperty('identifiant')) {
				identifiantInteraction = donneesInteraction.identifiant
			}
			if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return res.status(403).send('non_autorise')
			const titre = req.body.titre
			const type = donneesInteraction.type
			const donnees = req.body.donnees
			const donneesActuelles = parseJSON(donneesInteraction.donnees, {})
			let fichiersActuels = []
			let fichiers = []
			const corbeille = []
			if (Object.keys(donneesActuelles).length > 0) {
				fichiersActuels = definirFichiersInteraction(type, donneesActuelles)
				fichiers = definirFichiersInteraction(type, donnees)
				fichiersActuels.forEach((fichier) => {
					if (!fichiers.includes(fichier)) {
						corbeille.push(fichier)
					}
				})
			}
			await db.HSET('interactions:' + code, ['titre', titre, 'donnees', JSON.stringify(donnees)])
			if (corbeille.length > 0) {
				await Promise.all(corbeille.map((fichier) => supprimerFichier(code, fichier)))
			}
			res.status(200).send('donnees_enregistrees')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/modifier-statut-interaction', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant) return res.status(401).send('non_connecte')
		try {
			const code = parseInt(req.body.code)
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste !== 1) return res.status(400).json({ message: 'erreur_code' })
			let donneesInteraction = await db.HGETALL('interactions:' + code)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			let identifiantInteraction = ''
			if (donneesInteraction.hasOwnProperty('identifiant')) {
				identifiantInteraction = donneesInteraction.identifiant
			}
			if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return res.status(403).json({ message: 'non_autorise' })
			const statut = req.body.statut
			if (statut === 'ouvert') {
				const date = dayjs().format()
				const session = donneesInteraction.session
				const sessions = parseJSON(donneesInteraction.sessions, {})
				if (sessions[session] && Object.keys(sessions[session]).length > 0) {
					await db.HSET('interactions:' + code, 'statut', statut)
					res.status(200).json({ message: 'statut_modifie' })
				} else {
					sessions[session] = {}
					sessions[session].debut = date
					if ((donneesInteraction.type === 'Questionnaire' || donneesInteraction.type === 'Sondage') && (donneesInteraction.statut === '' || donneesInteraction.statut === 'attente' || donneesInteraction.statut === 'termine')) {
						const donnees = parseJSON(donneesInteraction.donnees, {})
						if (donnees.options && donnees.options.hasOwnProperty('questionsAleatoires') && donnees.options.questionsAleatoires === true) {
							donnees.questions = melanger(donnees.questions)
						}
						if (donnees.options && donnees.options.hasOwnProperty('itemsAleatoires') && donnees.options.itemsAleatoires === true) {
							donnees.questions.forEach((question) => {
								if (question.hasOwnProperty('items')) {
									question.items = melanger(question.items)
								}
							})
						}
						sessions[session].donnees = donnees
						await db.HSET('interactions:' + code, ['statut', statut, 'sessions', JSON.stringify(sessions)])
						res.status(200).json({ message: 'statut_modifie', donnees: donnees })
					} else {
						await db.HSET('interactions:' + code, ['statut', statut, 'sessions', JSON.stringify(sessions)])
						res.status(200).json({ message: 'statut_modifie' })
					}
				}
			} else {
				await db.HSET('interactions:' + code, 'statut', statut)
				res.status(200).json({ message: 'statut_modifie' })
			}
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/modifier-index-question', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant) return res.status(401).send('non_connecte')
		try {
			const code = parseInt(req.body.code)
			const indexQuestion = req.body.indexQuestion
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste !== 1) return res.status(400).send('erreur_code')
			let donneesInteraction = await db.HGETALL('interactions:' + code)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			let identifiantInteraction = ''
			if (donneesInteraction.hasOwnProperty('identifiant')) {
				identifiantInteraction = donneesInteraction.identifiant
			}
			if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return res.status(403).send('non_autorise')
			const donnees = parseJSON(donneesInteraction.donnees, {})
			donnees.indexQuestion = indexQuestion
			const session = donneesInteraction.session
			const sessions = parseJSON(donneesInteraction.sessions, {})
			if (sessions[session] && sessions[session].hasOwnProperty('donnees') && Object.keys(sessions[session].donnees).length > 0) {
				sessions[session].donnees.indexQuestion = indexQuestion
				await db.HSET('interactions:' + code, ['donnees', JSON.stringify(donnees), 'sessions', JSON.stringify(sessions)])
			} else {
				await db.HSET('interactions:' + code, 'donnees', JSON.stringify(donnees))
			}
			res.status(200).send('index_modifie')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/fermer-interaction', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant) return res.status(401).send('non_connecte')
		try {
			const code = parseInt(req.body.code)
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste !== 1) return res.status(400).send('erreur_code')
			let donneesInteraction = await db.HGETALL('interactions:' + code)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			let identifiantInteraction = ''
			if (donneesInteraction.hasOwnProperty('identifiant')) {
				identifiantInteraction = donneesInteraction.identifiant
			}
			if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return res.status(403).send('non_autorise')
			const date = dayjs().format()
			let session = donneesInteraction.session
			const type = donneesInteraction.type
			const donnees = parseJSON(donneesInteraction.donnees, {})
			const reponses = parseJSON(donneesInteraction.reponses, {})
			const sessions = parseJSON(donneesInteraction.sessions, {})
			if (reponses[session] && reponses[session].length > 0 && sessions[session]) {
				sessions[session].fin = date
				if (!sessions[session].hasOwnProperty('donnees')) {
					sessions[session].donnees = donnees
				}
				if (type === 'Questionnaire') {
					sessions[session].classement = req.body.classement
				}
				let bannis = []
				if (donneesInteraction.hasOwnProperty('bannis')) {
					bannis = parseJSON(donneesInteraction.bannis, [])
				}
				sessions[session].bannis = bannis
			} else if (sessions[session]) {
				delete sessions[session]
			}
			session = parseInt(session) + 1
			if (type === 'Questionnaire') {
				donnees.indexQuestion = donnees.copieIndexQuestion
				await db.HSET('interactions:' + code, ['statut', 'termine', 'donnees', JSON.stringify(donnees), 'sessions', JSON.stringify(sessions), 'session', session, 'bannis', JSON.stringify([])])
				res.status(200).json({ session: session, reponses: reponses, sessions: sessions })
			} else {
				await db.HSET('interactions:' + code, ['statut', 'termine', 'sessions', JSON.stringify(sessions), 'session', session, 'bannis', JSON.stringify([])])
				res.status(200).json({ session: session, reponses: reponses, sessions: sessions })
			}
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/se-connecter-interaction', async (req, res) => {
		if (!req.session.identifiant) {
			const identifiant = 'u' + Math.random().toString(16).slice(3)
			req.session.identifiant = identifiant
		}
		if (!req.session.hasOwnProperty('interactions')) {
			req.session.interactions = []
		}
		try {
			const code = parseInt(req.body.code)
			const motdepasse = req.body.motdepasse
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste !== 1) return res.status(400).send('erreur_code')
			let donneesInteraction = await db.HGETALL('interactions:' + code)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			const motdepasseCorrect = (motdepasse.trim() !== '' && motdepasse.trim() === donneesInteraction.motdepasse.trim())
			if (!motdepasseCorrect) return res.status(403).send('non_autorise')
			let digidrive = 0
			if (donneesInteraction.hasOwnProperty('digidrive')) {
				digidrive = parseInt(donneesInteraction.digidrive)
			}
			req.session.motdepasse = ''
			req.session.nom = ''
			req.session.email = ''
			if (!req.session.langue || req.session.langue === '') {
				req.session.langue = langueParDefaut
			}
			req.session.role = 'auteur'
			req.session.cookie.expires = new Date(Date.now() + dureeSession)
			req.session.interactions.push({ code: code, motdepasse: motdepasse })
			res.status(200).json({ code: code, identifiant: req.session.identifiant, nom: '', role: 'auteur', interactions: req.session.interactions, donnees: donneesInteraction.donnees, reponses: donneesInteraction.reponses, sessions: donneesInteraction.sessions, digidrive: digidrive })
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/recuperer-donnees-interaction-utilisateur', async (req, res) => {
		try {
			const code = parseInt(req.body.code)
			const identifiant = req.body.identifiant
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste !== 1) return res.status(404).send('interaction_inexistante')
			let donneesInteraction = await db.HGETALL('interactions:' + code)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			const type = donneesInteraction.type
			const titre = donneesInteraction.titre
			const statut = donneesInteraction.statut
			const session = parseInt(donneesInteraction.session)
			let donnees = {}
			let reponsesUtilisateurs = []
			const reponsesSession = []
			const donneesSession = []
			let bannis = []
			if (donneesInteraction.hasOwnProperty('bannis')) {
				bannis = parseJSON(donneesInteraction.bannis, [])
			}
			let banni = false
			let scoreTotal = 0
			let nomObligatoire = false
			let nomAleatoire = false
			const donneesJSON = parseJSON(donneesInteraction.donnees, {})
			if (donneesJSON && donneesJSON.hasOwnProperty('options') && donneesJSON.options.hasOwnProperty('nom') && donneesJSON.options.nom === 'obligatoire') {
				nomObligatoire = true
			} else if (donneesJSON && donneesJSON.hasOwnProperty('options') && donneesJSON.options.hasOwnProperty('nom') && donneesJSON.options.nom === 'aleatoire') {
				nomAleatoire = true
			}
			if (bannis.includes(identifiant)) {
				banni = true
			}
			if (statut === 'ouvert' || statut === 'nuage-affiche' || statut === 'verrouille') {
				if (donneesJSON && donneesJSON.hasOwnProperty('options') && ((donneesJSON.options.hasOwnProperty('questionsAleatoires') && donneesJSON.options.questionsAleatoires === true) || donneesJSON.options.hasOwnProperty('itemsAleatoires') && donneesJSON.options.itemsAleatoires === true)) {
					donnees = parseJSON(donneesInteraction.sessions, {})[session].donnees
				} else {
					donnees = donneesJSON
				}
				const reponses = parseJSON(donneesInteraction.reponses, {})
				if (reponses[session]) {
					reponsesUtilisateurs = reponses[session]
				}
				reponsesUtilisateurs.forEach((item) => {
					if (item.identifiant === identifiant) {
						reponsesSession.push(item)
					}
				})
				if (type === 'Questionnaire') {
					if (reponsesSession[0] && reponsesSession[0].reponse) {
						reponsesSession[0].reponse.forEach((item, index) => {
							const question = donnees.questions[index]
							const reponseCorrecte = definirReponseCorrecte(question, item).reponseCorrecte
							let itemsCorrects = []
							if (donnees.options.reponses === true || donnees.options.reponses === 'oui') {
								itemsCorrects = definirReponseCorrecte(question, item).itemsCorrects
							} else if (donnees.options.reponses === 'utilisateur') {
								itemsCorrects = definirReponseCorrecte(question, item).itemsCorrects
								itemsCorrects = itemsCorrects.filter((element) => {
									return item.includes(element)
								})
							}
							let retroaction = ''
							if (donnees.options.retroaction === true && reponseCorrecte && question.hasOwnProperty('retroaction') && question.retroaction.correcte !== '') {
								retroaction = question.retroaction.correcte
							} else if (donnees.options.retroaction === true && !reponseCorrecte && question.hasOwnProperty('retroaction') && question.retroaction.incorrecte !== '') {
								retroaction = question.retroaction.incorrecte
							}
							donneesSession.push({ reponseCorrecte: reponseCorrecte, itemsCorrects: itemsCorrects, retroaction: retroaction })
						})
						scoreTotal = calculerScoreTotal(reponsesSession[0], donnees.options, donnees.questions)
					}
					donnees.questions.forEach((question) => {
						if (question.hasOwnProperty('reponses')) {
							delete question.reponses
						}
						if (question.hasOwnProperty('retroaction')) {
							delete question.retroaction
						}
						if (question.hasOwnProperty('items')) {
							question.items.forEach((item) => {
								if (item.hasOwnProperty('reponse')) {
									delete item.reponse
								}
							})
						}
					})
				}
			}
			res.status(200).json({ type: type, titre: titre, donnees: donnees, reponsesSession: reponsesSession, donneesSession: donneesSession, banni: banni, statut: statut, session: session, scoreTotal: scoreTotal, nomObligatoire: nomObligatoire, nomAleatoire: nomAleatoire })
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/telecharger-informations-interaction', async (req, res) => {
		const identifiant = req.body.identifiant
		const code = parseInt(req.body.code)
		if (!req.session.identifiant || req.session.identifiant !== identifiant || !req.session.hasOwnProperty('interactions') || !req.session.interactions.map(item => item.code).includes(code)) return res.status(403).send('non_autorise')
		try {
			const motdepasse = req.body.motdepasse
			const type = req.body.type
			const titre = req.body.titre
			const domaine = req.body.domaine
			const doc = new PDFDocument()
			const buffers = []
			doc.on('data', (buffer) => {
				buffers.push(buffer)
			})
			doc.on('error', () => {
				res.status(500).send('erreur')
			})
			doc.on('end', () => {
				const buffer = Buffer.concat(buffers).toString('base64')
				res.status(200).send(buffer)
			})
			doc.fontSize(16)
			if (type === 'Sondage') {
				doc.font('Helvetica-Bold').text(t[req.session.langue].sondage + ' - ' + titre)
			} else if (type === 'Questionnaire') {
				doc.font('Helvetica-Bold').text(t[req.session.langue].questionnaire + ' - ' + titre)
			} else if (type === 'Remue-méninges') {
				doc.font('Helvetica-Bold').text(t[req.session.langue].remueMeninges + ' - ' + titre)
			} else if (type === 'Nuage-de-mots') {
				doc.font('Helvetica-Bold').text(t[req.session.langue].nuageDeMots + ' - ' + titre)
			}
			doc.moveDown()
			doc.fontSize(12)
			doc.font('Helvetica').text(t[req.session.langue].code + ' ' + code)
			doc.moveDown()
			doc.font('Helvetica').text(t[req.session.langue].lien).text(domaine + '/p/' + code, {
				link: domaine + '/p/' + code,
				underline: true
			})
			doc.moveDown()
			doc.font('Helvetica').text(t[req.session.langue].lienAdmin).text(domaine + '/c/' + code, {
				link: domaine + '/c/' + code,
				underline: true
			})
			doc.moveDown()
			doc.font('Helvetica').text(t[req.session.langue].motdepasse + ' ' + motdepasse)
			doc.moveDown()
			doc.end()
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/ajouter-favori', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) return res.status(401).send('non_connecte')
		try {
			const interaction = parseInt(req.body.code)
			if (await verifierAdmin(interaction, identifiant, req.session) === false) return res.status(403).send('non_autorise')
			await db.SADD('favoris:' + identifiant, interaction.toString())
			res.status(200).send('favori_ajoute')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/supprimer-favori', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) return res.status(401).send('non_connecte')
		try {
			const interaction = parseInt(req.body.code)
			if (await verifierAdmin(interaction, identifiant, req.session) === false) return res.status(403).send('non_autorise')
			await db.SREM('favoris:' + identifiant, interaction.toString())
			res.status(200).send('favori_supprime')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/deplacer-interaction', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) {
			supprimerSession(req)
			return res.status(401).send('non_connecte')
		}
		try {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return res.status(500).send('erreur')
			if (comparerHash(req.session.motdepasse, donneesUtilisateur.motdepasse) === false) return res.status(403).send('non_autorise')
			const code = parseInt(req.body.code)
			const destination = req.body.destination
			const dossiers = parseJSON(donneesUtilisateur.dossiers, [])
			dossiers.forEach((dossier, indexDossier) => {
				if (dossier.contenus.includes(code)) {
					const index = dossier.contenus.indexOf(code)
					dossiers[indexDossier].contenus.splice(index, 1)
				}
				if (dossier.id === destination) {
					dossiers[indexDossier].contenus.push(code)
				}
			})
			await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
			res.status(200).send('interaction_deplacee')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/mettre-a-la-corbeille', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) return res.status(401).send('non_connecte')
		try {
			const interaction = parseInt(req.body.code)
			if (await verifierAdmin(interaction, identifiant, req.session) === false) return res.status(403).send('non_autorise')
			await db.multi()
				.SADD('interactions-supprimees:' + identifiant, interaction.toString())
				.SREM('interactions-creees:' + identifiant, interaction.toString())
				.exec()
			res.status(200).send('interaction_supprimee')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/restaurer-interaction', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) return res.status(401).send('non_connecte')
		try {
			const interaction = parseInt(req.body.code)
			if (await verifierAdmin(interaction, identifiant, req.session) === false) return res.status(403).send('non_autorise')
			await db.multi()
				.SREM('interactions-supprimees:' + identifiant, interaction.toString())
				.SADD('interactions-creees:' + identifiant, interaction.toString())
				.exec()
			res.status(200).send('interaction_restauree')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/dupliquer-interaction', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) return res.status(401).send('non_connecte')
		try {
			const interaction = parseInt(req.body.code)
			const interactionExiste = await db.EXISTS('interactions:' + interaction)
			if (interactionExiste !== 1) return res.status(400).send('erreur_code')
			let donneesInteraction = await db.HGETALL('interactions:' + interaction)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return res.redirect(302, '/')
			if (donneesInteraction.identifiant !== identifiant || comparerHash(req.session.motdepasse, donneesUtilisateur.motdepasse) === false) return res.status(403).send('non_autorise')
			const code = Math.floor(1000000 + Math.random() * 9000000)
			const date = dayjs().format()
			const nouvelleInteractionExiste = await db.EXISTS('interactions:' + code)
			if (nouvelleInteractionExiste !== 0) return res.status(409).send('existe_deja')
			await db.multi()
				.HSET('interactions:' + code, ['type', donneesInteraction.type, 'titre', t[req.session.langue].copieDe + donneesInteraction.titre, 'code', code, 'identifiant', identifiant, 'motdepasse', '', 'donnees', donneesInteraction.donnees, 'reponses', JSON.stringify({}), 'sessions', JSON.stringify({}), 'statut', '', 'session', 1, 'date', date, 'digidrive', 0])
				.SADD('interactions-creees:' + identifiant, code.toString())
				.exec()
			if (stockage === 'fs' && await fs.pathExists(path.join(__dirname, '..', '/static/fichiers/' + interaction))) {
				await fs.copy(path.join(__dirname, '..', '/static/fichiers/' + interaction.toString()), path.join(__dirname, '..', '/static/fichiers/' + code.toString()))
			} else if (stockage === 's3') {
				const listeObjets = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: interaction + '/' }))
				if (listeObjets && listeObjets.Contents) {
					const promessesCopiesS3 = listeObjets.Contents.map((objet) => {
						const nCle = code + '/' + objet.Key.replace(interaction + '/', '')
						return s3Client.send(new CopyObjectCommand(definirParametresCopierS3(nCle, '/' + bucket + '/' + objet.Key)))
					})
					await Promise.all(promessesCopiesS3)
				}
			}
			const destination = req.body.dossier
			if (destination !== '') {
				const dossiers = parseJSON(donneesUtilisateur.dossiers, [])
				dossiers.forEach((dossier, indexDossier) => {
					if (dossier.id === destination) {
						dossiers[indexDossier].contenus.push(code)
					}
				})
				await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
			}
			res.status(200).json({ type: donneesInteraction.type, titre: t[req.session.langue].copieDe + donneesInteraction.titre, code: code, identifiant: identifiant, motdepasse: '', donnees: parseJSON(donneesInteraction.donnees, {}), reponses: {}, sessions: {}, statut: '', session: 1, date: date })
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/exporter-interaction', async (req, res) => {
		try {
			const identifiant = req.body.identifiant
			const motdepasseAdmin = req.body.admin
			let admin = false
			if (verifierMotDePasseAdmin(motdepasseAdmin)) {
				admin = true
			}
			const utilisateurConnecte = ((req.session.identifiant && req.session.identifiant === identifiant && ((req.session.role === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') || req.session.role === 'auteur')) || admin)
			if (!utilisateurConnecte) return res.status(401).send('non_connecte')
			const code = parseInt(req.body.code)
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste !== 1) return res.status(400).send('erreur_code')
			let donneesInteraction = await db.HGETALL('interactions:' + code)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			const donnees = parseJSON(donneesInteraction.donnees, {})
			if (Object.keys(donnees).length === 0) return res.status(400).send('erreur_donnees')
			let identifiantInteraction = ''
			if (donneesInteraction.hasOwnProperty('identifiant')) {
				identifiantInteraction = donneesInteraction.identifiant
			}
			if (!admin && await verifierAdmin(code, identifiantInteraction, req.session) === false) return res.status(403).send('non_autorise')
			const dossier = path.join(__dirname, '..', '/static/temp', code.toString())
			const dossierFichiers = path.join(dossier, 'fichiers')
			await fs.mkdirp(dossierFichiers)
			await fs.writeFile(path.join(dossier, 'donnees.json'), JSON.stringify(donneesInteraction, '', 4), 'utf8')
			const promessesFichiers = []
			const fichiers = definirListeFichiers(donneesInteraction.type, donnees)
			for (const fichier of fichiers) {
				promessesFichiers.push(
					copierFichierExport({ chemin: path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + fichier), cleS3: code.toString() + '/' + fichier }, path.join(dossierFichiers, fichier))
				)
			}
			await Promise.all(promessesFichiers)
			const archiveId = Math.floor((Math.random() * 100000) + 1)
			const nomArchive = code + '_' + archiveId + '.zip'
			const cheminArchive = path.join(path.dirname(dossier), nomArchive)
			const sortie = fs.createWriteStream(cheminArchive)
			const archive = archiver('zip', { zlib: { level: 9 } })
			sortie.on('finish', async () => {
				await fs.remove(dossier)
				res.status(200).send(nomArchive)
			})
			sortie.on('error', async (err) => {
				console.error(err.stack)
				try { await fs.remove(dossier) } catch {}
				res.status(500).send('erreur')
			})
			archive.pipe(sortie)
			archive.directory(dossier, false)
			archive.on('error', async (err) => {
				console.error(err.stack)
				try { await fs.remove(dossier) } catch {}
				res.status(500).send('erreur')
			})
			archive.finalize()
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/importer-interaction', async (req, res) => {
		if (!req.session.identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) {
			supprimerSession(req)
			return res.status(401).send('non_connecte')
		}
		try {
			const identifiant = req.session.identifiant
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return res.status(400).send('erreur_import')
			if (comparerHash(req.session.motdepasse, donneesUtilisateur.motdepasse) === false) return res.status(403).send('non_autorise')
			televerserArchive(req, res, async (err) => {
				if (err) return res.status(500).send('erreur_import')
				if (!req.file) return res.status(500).send('erreur_import')
				const source = path.join(__dirname, '..', '/static/temp/' + req.file.filename)
				const dossierTemporaire = path.join(__dirname, '..', '/static/temp/archive-' + Math.floor((Math.random() * 100000) + 1))
				try {
					await extraireArchive(source, dossierTemporaire)
					const donnees = await fs.readJson(path.normalize(dossierTemporaire + '/donnees.json'))
					if (typeof req.body.parametres !== 'string') throw new Error('parametres_invalides')
					const parametres = parseJSON(req.body.parametres, null)
					if (parametres === null) throw new Error('parametres_invalides')
					// Vérification des clés des données
					const structureValide = (donnees.hasOwnProperty('type') && donnees.hasOwnProperty('titre') && donnees.hasOwnProperty('code') && donnees.hasOwnProperty('motdepasse') && donnees.hasOwnProperty('donnees') && donnees.hasOwnProperty('reponses') && donnees.hasOwnProperty('sessions') && donnees.hasOwnProperty('statut') && donnees.hasOwnProperty('session') && donnees.hasOwnProperty('date'))
					if (!structureValide) throw new Error('structure_invalide')
					const code = Math.floor(1000000 + Math.random() * 9000000)
					const date = dayjs().format()
					const interactionExiste = await db.EXISTS('interactions:' + code)
					if (interactionExiste !== 0) return res.status(409).send('existe_deja')
					if (parametres.resultats === true) {
						await db.HSET('interactions:' + code, ['type', donnees.type, 'titre', donnees.titre, 'code', code, 'identifiant', identifiant, 'motdepasse', '', 'donnees', donnees.donnees, 'reponses', donnees.reponses, 'sessions', donnees.sessions, 'statut', '', 'session', donnees.session, 'date', date, 'digidrive', 0])
					} else {
						await db.HSET('interactions:' + code, ['type', donnees.type, 'titre', donnees.titre, 'code', code, 'identifiant', identifiant, 'motdepasse', '', 'donnees', donnees.donnees, 'reponses', JSON.stringify({}), 'sessions', JSON.stringify({}), 'statut', '', 'session', 1, 'date', date, 'digidrive', 0])
					}
					await db.SADD('interactions-creees:' + identifiant, code.toString())
					const promessesFichiers = []
					const fichiers = definirListeFichiers(donnees.type, parseJSON(donnees.donnees, {}))
					const dossierDestination = path.join(__dirname, '..', '/static/fichiers/' + code.toString())
					for (const fichier of fichiers) {
						promessesFichiers.push(televerserFichierArchive(dossierTemporaire, dossierDestination, fichier, code))
					}
					await Promise.all(promessesFichiers)
					await supprimerArchives(source, dossierTemporaire)
					if (parametres.resultats === true) {
						res.status(200).json({ type: donnees.type, titre: donnees.titre, code: code, identifiant: identifiant, motdepasse: '', donnees: parseJSON(donnees.donnees, {}), reponses: parseJSON(donnees.reponses, {}), sessions: parseJSON(donnees.sessions, {}), statut: '', session: donnees.session, date: date })
					} else {
						res.status(200).json({ type: donnees.type, titre: donnees.titre, code: code, identifiant: identifiant, motdepasse: '', donnees: parseJSON(donnees.donnees, {}), reponses: {}, sessions: {}, statut: '', session: 1, date: date })
					}
				} catch (err) {
					console.error(err.stack)
					await supprimerArchives(source, dossierTemporaire)
					if (err.message === 'structure_invalide') {
						return res.status(400).send('donnees_corrompues')
					}
					res.status(500).send('erreur_import')
				}
			})
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/supprimer-interaction', async (req, res) => {
		try {
			const code = parseInt(req.body.code)
			const identifiant = req.body.identifiant
			const motdepasseAdmin = req.body.admin
			let admin = false
			if (verifierMotDePasseAdmin(motdepasseAdmin)) {
				admin = true
			}
			const utilisateurConnecte = ((req.session.identifiant && req.session.identifiant === identifiant && ((req.session.role === 'utilisateur' && req.session.hasOwnProperty('motdepasse') && req.session.motdepasse !== '') || req.session.role === 'auteur')) || admin)
			if (!utilisateurConnecte) {
				supprimerSession(req)
				return res.status(401).send('non_connecte')
			}
			let suppressionFichiers = true
			if (req.body.hasOwnProperty('suppressionFichiers')) {
				suppressionFichiers = req.body.suppressionFichiers
			}
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste !== 1) return res.status(400).send('erreur_code')
			let donneesInteraction = await db.HGETALL('interactions:' + code)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			let identifiantInteraction = ''
			if (donneesInteraction.hasOwnProperty('identifiant')) {
				identifiantInteraction = donneesInteraction.identifiant
			}
			if (!admin && await verifierAdmin(code, identifiantInteraction, req.session) === false) return res.status(403).send('non_autorise')
			await db.multi()
				.UNLINK('interactions:' + code)
				.SREM('interactions-creees:' + identifiant, code.toString())
				.SREM('favoris:' + identifiant, code.toString())
				.SREM('interactions-supprimees:' + identifiant, code.toString())
				.exec()
			if (stockage === 'fs' && suppressionFichiers === true) {
				await fs.remove(path.join(__dirname, '..', '/static/fichiers/' + code.toString()))
			} else if (stockage === 's3' && suppressionFichiers === true) {
				const listeObjets = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: code + '/' }))
				if (listeObjets && listeObjets.Contents) {
					const promessesCopiesS3 = listeObjets.Contents.map((objet) => {
						return s3Client.send(new DeleteObjectCommand(definirParametresSupprimerS3(objet.Key)))
					})
					await Promise.all(promessesCopiesS3)
				}
			}
			res.status(200).send('interaction_supprimee')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/vider-corbeille', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) return res.status(401).send('non_connecte')
		try {
			const contenus = Array.isArray(req.body.contenus) ? req.body.contenus.map((code) => parseInt(code)) : []
			await Promise.all(contenus.map(async (code) => {
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				if (donneesInteraction.identifiant !== identifiant) return
				await db.multi()
					.UNLINK('interactions:' + code)
					.SREM('interactions-creees:' + identifiant, code.toString())
					.SREM('favoris:' + identifiant, code.toString())
					.SREM('interactions-supprimees:' + identifiant, code.toString())
					.exec()
				if (stockage === 'fs') {
					await fs.remove(path.join(__dirname, '..', '/static/fichiers/' + code.toString()))
				} else if (stockage === 's3') {
					const listeObjets = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: code + '/' }))
					if (listeObjets && listeObjets.Contents) {
						const promessesCopiesS3 = listeObjets.Contents.map((objet) => {
							return s3Client.send(new DeleteObjectCommand(definirParametresSupprimerS3(objet.Key)))
						})
						await Promise.all(promessesCopiesS3)
					}
				}
			}))
			res.status(200).send('corbeille_videe')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/exporter-resultat', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant) return res.status(403).send('non_autorise')
		try {
			const code = parseInt(req.body.code)
			let donneesInteraction = await db.HGETALL('interactions:' + code)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			let identifiantInteraction = ''
			if (donneesInteraction.hasOwnProperty('identifiant')) {
				identifiantInteraction = donneesInteraction.identifiant
			}
			if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return res.status(403).send('non_autorise')
			const type = req.body.type
			const titre = req.body.titre
			const donnees = req.body.donnees
			const reponses = req.body.reponses
			const dateDebut = req.body.dateDebut
			const dateFin = req.body.dateFin
			const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
			let bannis = []
			if (req.body.bannis && req.body.bannis.length) {
				bannis = req.body.bannis
			} else if (donnees.hasOwnProperty('bannis')) {
				bannis = donnees.bannis
			}
			const doc = new PDFDocument()
			const buffers = []
			doc.on('data', (buffer) => {
				buffers.push(buffer)
			})
			doc.on('error', () => {
				res.status(500).send('erreur')
			})
			doc.on('end', () => {
				const buffer = Buffer.concat(buffers).toString('base64')
				res.status(200).send(buffer)
			})
			doc.fontSize(16)
			if (type === 'Sondage') {
				doc.font('Helvetica-Bold').text(t[req.session.langue].sondage + ' - ' + titre)
			} else if (type === 'Questionnaire') {
				doc.font('Helvetica-Bold').text(t[req.session.langue].questionnaire + ' - ' + titre)
			} else if (type === 'Remue-méninges') {
				doc.font('Helvetica-Bold').text(t[req.session.langue].remueMeninges + ' - ' + titre)
			} else if (type === 'Nuage-de-mots') {
				doc.font('Helvetica-Bold').text(t[req.session.langue].nuageDeMots + ' - ' + titre)
			}
			doc.fontSize(10)
			doc.moveDown()
			if (type === 'Sondage' && typeof donnees === 'object' && donnees !== null && donnees.hasOwnProperty('questions')) {
				const statistiques = definirStatistiquesQuestions(donnees.questions, reponses, bannis)
				if (dateDebut !== '' && dateFin !== '') {
					doc.fontSize(8)
					doc.font('Helvetica').text(formaterDate(dateDebut, t[req.session.langue].demarre, req.session.langue) + ' - ' + formaterDate(dateFin, t[req.session.langue].termine, req.session.langue))
					doc.moveDown()
				}
				if (donnees.options.progression === 'libre') {
					doc.font('Helvetica').text(t[req.session.langue].progression + ' ' + t[req.session.langue].progressionLibre)
				} else {
					doc.font('Helvetica').text(t[req.session.langue].progression + ' ' + t[req.session.langue].progressionAnimateur)
				}
				doc.moveDown()
				doc.moveDown()
				if (donnees.description !== '') {
					doc.fontSize(12)
					doc.font('Helvetica-Bold').text(t[req.session.langue].description, { underline: true })
					doc.fontSize(10)
					doc.moveDown()
					doc.font('Helvetica').text(donnees.description)
				}
				if (donnees.description !== '' && Object.keys(donnees.support).length > 0) {
					doc.fontSize(12)
					doc.moveDown()
				}
				await afficherSupportPrincipalPDF(doc, donnees, code, req, true)
				if (donnees.description !== '' || Object.keys(donnees.support).length > 0) {
					doc.fontSize(12)
					doc.moveDown()
					doc.moveDown()
				}
				for (let i = 0; i < donnees.questions.length; i++) {
					doc.fontSize(14)
					doc.font('Helvetica-Bold').fillColor('black').text(t[req.session.langue].question + ' ' + (i + 1))
					doc.fontSize(10)
					doc.font('Helvetica').text('-----------------------------------------------')
					doc.fontSize(14)
					doc.moveDown()
					doc.fontSize(12)
					doc.font('Helvetica-Bold').text(t[req.session.langue].question, { underline: true })
					if (donnees.questions[i].question !== '') {
						doc.moveDown()
						doc.font('Helvetica-Bold').text(donnees.questions[i].question)
					}
					await afficherSupportQuestionPDF(doc, donnees.questions[i], code, req)
					doc.moveDown()
					doc.moveDown()
					doc.fontSize(12)
					doc.font('Helvetica-Bold').text(t[req.session.langue].reponses + ' (' + definirReponses(reponses, i, bannis) + ')', { underline: true })
					doc.moveDown()
					if (donnees.questions[i].option === 'choix-unique' || donnees.questions[i].option === 'choix-multiples') {
						for (let j = 0; j < donnees.questions[i].items.length; j++) {
							if (donnees.questions[i].items[j].texte !== '') {
								doc.fontSize(10)
								doc.font('Helvetica').text(alphabet[j] + '. ' + donnees.questions[i].items[j].texte + ' (' + statistiques[i].pourcentages[j] + '% - ' + statistiques[i].personnes[j] + ')')
								if (donnees.questions[i].items[j].hasOwnProperty('image') && donnees.questions[i].items[j].image !== '') {
									let image = ''
									if (stockage === 'fs') {
										const cheminImage = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + donnees.questions[i].items[j].image)
										if (await fs.pathExists(cheminImage)) {
											image = await fs.readFile(cheminImage)
										}
									} else if (stockage === 's3') {
										image = await lireFichierS3(code + '/' + donnees.questions[i].items[j].image)
									}
									if (image !== '' && image !== 'erreur' && magic.includes(image.toString('hex', 0, 4)) === true) {
										doc.image(image, { fit: [75, 75] })
									}
								} else if (donnees.questions[i].items[j].hasOwnProperty('audio') && donnees.questions[i].items[j].audio !== '') {
									doc.fontSize(10)
									doc.font('Helvetica').text(t[req.session.langue].fichierAudio + ' ' + donnees.questions[i].items[j].audio)
								}
							} else if (donnees.questions[i].items[j].hasOwnProperty('image') && donnees.questions[i].items[j].image !== '') {
								doc.fontSize(10)
								let image = ''
								if (stockage === 'fs') {
									const cheminImage = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + donnees.questions[i].items[j].image)
									if (await fs.pathExists(cheminImage)) {
										image = await fs.readFile(cheminImage)
									}
								} else if (stockage === 's3') {
									image = await lireFichierS3(code + '/' + donnees.questions[i].items[j].image)
								}
								if (image !== '' && image !== 'erreur' && magic.includes(image.toString('hex', 0, 4)) === true) {
									doc.font('Helvetica').text(alphabet[j] + '. (' + statistiques[i].pourcentages[j] + '% - ' + statistiques[i].personnes[j] + ')').image(image, { fit: [75, 75] })
								} else {
									doc.font('Helvetica').text(alphabet[j] + '. ' + donnees.questions[i].items[j].alt + ' (' + statistiques[i].pourcentages[j] + '% - ' + statistiques[i].personnes[j] + ')')
								}
							} else if (donnees.questions[i].items[j].hasOwnProperty('audio') && donnees.questions[i].items[j].audio !== '') {
								doc.fontSize(10)
								doc.font('Helvetica').text(alphabet[j] + '. ' + t[req.session.langue].fichierAudio + ' ' + donnees.questions[i].items[j].audio + ' (' + statistiques[i].pourcentages[j] + '% - ' + statistiques[i].personnes[j] + ')')
							}
							doc.moveDown()
						}
					} else if (donnees.questions[i].option === 'texte-court') {
						const itemsTexte = []
						reponses.forEach((donnees) => {
							if (!bannis.includes(donnees.identifiant)) {
								donnees.reponse[i].forEach((reponse) => {
									if (!itemsTexte.includes(reponse.toString().trim())) {
										itemsTexte.push(reponse.toString().trim())
									}
								})
							}
						})
						itemsTexte.forEach((item, index) => {
							doc.fontSize(10)
							doc.font('Helvetica').text((index + 1) + '. ' + item + ' (' + statistiques[i].pourcentages[index] + '% - ' + statistiques[i].personnes[index] + ')')
							doc.moveDown()
						})
					} else if (donnees.questions[i].option === 'etoiles') {
						let totalPoints = 0
						let totalPersonnes = 0
						statistiques[i].personnes.forEach((stat, indexStat) => {
							totalPoints = totalPoints + (stat * (indexStat + 1))
							totalPersonnes = totalPersonnes + stat
						})
						const moyenne = (Math.round((totalPoints / totalPersonnes) * 10) / 10) || 0
						doc.fontSize(10)
						doc.font('Helvetica').text(t[req.session.langue].moyenne + moyenne + '/' + donnees.questions[i].etoiles)
						doc.moveDown()
						for (let k = 0; k < donnees.questions[i].etoiles; k++) {
							doc.fontSize(10)
							doc.font('Helvetica').text((k + 1) + '/' + donnees.questions[i].etoiles + ' (' + statistiques[i].pourcentages[k] + '% - ' + statistiques[i].personnes[k] + ')')
							doc.moveDown()
						}
					}
					doc.moveDown()
					doc.moveDown()
				}
			} else if (type === 'Questionnaire' && typeof donnees === 'object' && donnees !== null && donnees.hasOwnProperty('questions')) {
				const statistiques = definirStatistiquesQuestions(donnees.questions, reponses, bannis)
				const classement = req.body.classement
				if (dateDebut !== '' && dateFin !== '') {
					doc.fontSize(8)
					doc.font('Helvetica').text(formaterDate(dateDebut, t[req.session.langue].demarre, req.session.langue) + ' - ' + formaterDate(dateFin, t[req.session.langue].termine, req.session.langue))
					doc.moveDown()
				}
				if (donnees.options.progression === 'libre') {
					doc.font('Helvetica').text(t[req.session.langue].progression + ' ' + t[req.session.langue].progressionLibre)
				} else {
					doc.font('Helvetica').text(t[req.session.langue].progression + ' ' + t[req.session.langue].progressionAnimateur)
				}
				doc.moveDown()
				doc.moveDown()
				if (donnees.description !== '') {
					doc.fontSize(12)
					doc.font('Helvetica-Bold').text(t[req.session.langue].description, { underline: true })
					doc.fontSize(10)
					doc.moveDown()
					doc.font('Helvetica').text(donnees.description)
				}
				if (donnees.description !== '' && Object.keys(donnees.support).length > 0) {
					doc.fontSize(12)
					doc.moveDown()
				}
				await afficherSupportPrincipalPDF(doc, donnees, code, req, false)
				if (donnees.description !== '' || Object.keys(donnees.support).length > 0) {
					doc.fontSize(12)
					doc.moveDown()
					doc.moveDown()
				}
				for (let i = 0; i < donnees.questions.length; i++) {
					doc.fontSize(14)
					doc.font('Helvetica-Bold').fillColor('black').text(t[req.session.langue].question + ' ' + (i + 1))
					doc.fontSize(10)
					doc.font('Helvetica').text('-----------------------------------------------')
					doc.fontSize(14)
					doc.moveDown()
					doc.fontSize(12)
					doc.font('Helvetica-Bold').text(t[req.session.langue].question, { underline: true })
					if (donnees.questions[i].question !== '') {
						doc.moveDown()
						doc.font('Helvetica-Bold').text(donnees.questions[i].question)
					}
					await afficherSupportQuestionPDF(doc, donnees.questions[i], code, req)
					doc.moveDown()
					doc.moveDown()
					doc.fontSize(12)
					doc.font('Helvetica-Bold').text(t[req.session.langue].reponses + ' (' + definirReponses(reponses, i, bannis) + ')', { underline: true })
					doc.moveDown()
					if (donnees.questions[i].option !== 'texte-court') {
						for (let j = 0; j < donnees.questions[i].items.length; j++) {
							if (donnees.questions[i].items[j].texte !== '') {
								doc.fontSize(10)
								if (donnees.questions[i].items[j].reponse === true) {
									doc.font('Helvetica').fillColor('#00a695').text(alphabet[j] + '. ' + donnees.questions[i].items[j].texte + ' (' + statistiques[i].pourcentages[j] + '% - ' + statistiques[i].personnes[j] + ') - ' + t[req.session.langue].bonneReponse)
								} else {
									doc.font('Helvetica').fillColor('grey').text(alphabet[j] + '. ' + donnees.questions[i].items[j].texte + ' (' + statistiques[i].pourcentages[j] + '% - ' + statistiques[i].personnes[j] + ')')
								}
								if (donnees.questions[i].items[j].hasOwnProperty('image') && donnees.questions[i].items[j].image !== '') {
									let image = ''
									if (stockage === 'fs') {
										const cheminImage = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + donnees.questions[i].items[j].image)
										if (await fs.pathExists(cheminImage)) {
											image = await fs.readFile(cheminImage)
										}
									} else if (stockage === 's3') {
										image = await lireFichierS3(code + '/' + donnees.questions[i].items[j].image)
									}
									if (image !== '' && image !== 'erreur' && magic.includes(image.toString('hex', 0, 4)) === true) {
										doc.image(image, { fit: [75, 75] })
									}
								} else if (donnees.questions[i].items[j].hasOwnProperty('audio') && donnees.questions[i].items[j].audio !== '') {
									doc.fontSize(10)
									doc.font('Helvetica').text(t[req.session.langue].fichierAudio + ' ' + donnees.questions[i].items[j].audio)
								}
							} else if (donnees.questions[i].items[j].hasOwnProperty('image') && donnees.questions[i].items[j].image !== '') {
								doc.fontSize(10)
								let image = ''
								if (stockage === 'fs') {
									const cheminImage = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + donnees.questions[i].items[j].image)
									if (await fs.pathExists(cheminImage)) {
										image = await fs.readFile(cheminImage)
									}
								} else if (stockage === 's3') {
									image = await lireFichierS3(code + '/' + donnees.questions[i].items[j].image)
								}
								if (image !== '' && image !== 'erreur' && magic.includes(image.toString('hex', 0, 4)) === true) {
									if (donnees.questions[i].items[j].reponse === true) {
										doc.font('Helvetica').fillColor('#00a695').text(alphabet[j] + '. (' + statistiques[i].pourcentages[j] + '% - ' + statistiques[i].personnes[j] + ') - ' + t[req.session.langue].bonneReponse).image(image, { fit: [75, 75] })
									} else {
										doc.font('Helvetica').fillColor('grey').text(alphabet[j] + '. (' + statistiques[i].pourcentages[j] + '% - ' + statistiques[i].personnes[j] + ')').image(image, { fit: [75, 75] })
									}
								} else if (donnees.questions[i].items[j].reponse === true) {
									doc.font('Helvetica').fillColor('#00a695').text(alphabet[j] + '. ' + donnees.questions[i].items[j].alt + ' (' + statistiques[i].pourcentages[j] + '% - ' + statistiques[i].personnes[j] + ') - ' + t[req.session.langue].bonneReponse)
								} else {
									doc.font('Helvetica').fillColor('grey').text(alphabet[j] + '. ' + donnees.questions[i].items[j].alt + ' (' + statistiques[i].pourcentages[j] + '% - ' + statistiques[i].personnes[j] + ')')
								}
							} else if (donnees.questions[i].items[j].hasOwnProperty('audio') && donnees.questions[i].items[j].audio !== '') {
								doc.fontSize(10)
								if (donnees.questions[i].items[j].reponse === true) {
									doc.font('Helvetica').fillColor('#00a695').text(alphabet[j] + '. ' + t[req.session.langue].fichierAudio + ' ' + donnees.questions[i].items[j].audio + ' (' + statistiques[i].pourcentages[j] + '% - ' + statistiques[i].personnes[j] + ') - ' + t[req.session.langue].bonneReponse)
								} else {
									doc.font('Helvetica').fillColor('grey').text(alphabet[j] + '. ' + t[req.session.langue].fichierAudio + ' ' + donnees.questions[i].items[j].audio + ' (' + statistiques[i].pourcentages[j] + '% - ' + statistiques[i].personnes[j] + ')')
								}
							}
							doc.moveDown()
						}
					} else {
						const itemsTexte = []
						reponses.forEach((donnees) => {
							if (!bannis.includes(donnees.identifiant)) {
								donnees.reponse[i].forEach((reponse) => {
									if (!itemsTexte.includes(reponse.toString().trim())) {
										itemsTexte.push(reponse.toString().trim())
									}
								})
							}
						})
						const reponsesTexte = donnees.questions[i].reponses.split('|')
						reponsesTexte.forEach((item, index) => {
							reponsesTexte[index] = item.trim()
						})
						itemsTexte.forEach((item, index) => {
							doc.fontSize(10)
							if (reponsesTexte.includes(item) === true) {
								doc.font('Helvetica').fillColor('#00a695').text((index + 1) + '. ' + item + ' (' + statistiques[i].pourcentages[index] + '% - ' + statistiques[i].personnes[index] + ') - ' + t[req.session.langue].bonneReponse)
							} else {
								doc.font('Helvetica').fillColor('grey').text((index + 1) + '. ' + item + ' (' + statistiques[i].pourcentages[index] + '% - ' + statistiques[i].personnes[index] + ')')
							}
							doc.moveDown()
						})
					}
					doc.moveDown()
					doc.moveDown()
				}
				if (classement.length > 0 && donnees.hasOwnProperty('options') && donnees.options.nom === 'obligatoire') {
					doc.fontSize(14)
					doc.font('Helvetica-Bold').fillColor('black').text(t[req.session.langue].classement)
					doc.fontSize(10)
					doc.font('Helvetica').text('-----------------------------------------------')
					doc.fontSize(14)
					doc.moveDown()
					doc.fontSize(12)
					classement.forEach((utilisateur, indexUtilisateur) => {
						doc.font('Helvetica').text((indexUtilisateur + 1) + '. ' + utilisateur.nom + ' (' + (Math.round(utilisateur.score * 10) / 10) + ' ' + t[req.session.langue].points + ')')
						doc.moveDown()
					})
				}
			} else if (type === 'Remue-méninges' && typeof donnees === 'object' && donnees !== null) {
				let categories = []
				if (donnees.hasOwnProperty('categories')) {
					categories = donnees.categories.filter((categorie) => {
						return categorie.texte !== '' || categorie.image !== ''
					})
				}
				const messages = definirMessagesRemueMeninges(categories, reponses, bannis)
				if (dateDebut !== '' && dateFin !== '') {
					doc.fontSize(8)
					doc.font('Helvetica').text(formaterDate(dateDebut, t[req.session.langue].demarre, req.session.langue) + ' - ' + formaterDate(dateFin, t[req.session.langue].termine, req.session.langue))
					doc.moveDown()
				}
				doc.moveDown()
				doc.fontSize(12)
				doc.font('Helvetica-Bold').text(t[req.session.langue].question, { underline: true })
				doc.moveDown()
				doc.font('Helvetica-Bold').text(donnees.question)
				if (Object.keys(donnees.support).length > 0) {
					doc.fontSize(10)
					doc.moveDown()
					doc.moveDown()
					doc.fontSize(12)
					doc.font('Helvetica-Bold').text(t[req.session.langue].support, { underline: true })
					doc.fontSize(10)
					doc.moveDown()
					if (donnees.support.type === 'image' && donnees.support.fichier !== '') {
						let support = ''
						if (stockage === 'fs') {
							const cheminSupport = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + donnees.support.fichier)
							if (await fs.pathExists(cheminSupport)) {
								support = await fs.readFile(cheminSupport)
							}
						} else if (stockage === 's3') {
							support = await lireFichierS3(code + '/' + donnees.support.fichier)
						}
						if (support !== '' && support !== 'erreur' && magic.includes(support.toString('hex', 0, 4)) === true) {
							doc.image(support, { fit: [120, 120] })
							doc.moveDown()
						} else {
							doc.font('Helvetica').text(t[req.session.langue].image + ' ' + donnees.support.alt)
							doc.moveDown()
						}
					} else if (donnees.support.type === 'audio') {
						doc.font('Helvetica').text(t[req.session.langue].fichierAudio + ' ' + donnees.support.alt)
						doc.moveDown()
					} else if (donnees.support.type === 'video') {
						doc.font('Helvetica').text(t[req.session.langue].video, {
							link: donnees.support.lien,
							underline: true
						})
						doc.moveDown()
					}
				}
				doc.moveDown()
				doc.fontSize(12)
				// Messages visibles
				if (categories.length > 0) {
					let totalMessagesVisibles = 0
					messages.visibles.forEach((categorie) => {
						totalMessagesVisibles = totalMessagesVisibles + categorie.length
					})
					doc.font('Helvetica-Bold').text(t[req.session.langue].reponses + ' (' + totalMessagesVisibles + ')', { underline: true })
					doc.moveDown()
					for (let i = 0; i < categories.length; i++) {
						if (categories[i].texte !== '') {
							doc.fontSize(10)
							doc.font('Helvetica-Bold').text((i + 1) + '. ' + categories[i].texte + ' (' + messages.visibles[i].length + ')')
							if (categories[i].image !== '') {
								let image = ''
								if (stockage === 'fs') {
									const cheminImage = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + categories[i].image)
									if (await fs.pathExists(cheminImage)) {
										image = await fs.readFile(cheminImage)
									}
								} else if (stockage === 's3') {
									image = await lireFichierS3(code + '/' + categories[i].image)
								}
								if (image !== '' && image !== 'erreur' && magic.includes(image.toString('hex', 0, 4)) === true) {
									doc.image(image, { fit: [40, 40] })
									doc.moveDown()
								} else {
									doc.fontSize(10)
									doc.font('Helvetica').text(categories[i].alt)
									doc.moveDown()
								}
							}
							messages.visibles[i].forEach((message) => {
								doc.fontSize(9)
								doc.font('Helvetica').text('• ' + message.reponse.texte)
							})
						} else if (categories[i].image !== '') {
							doc.fontSize(10)
							let image = ''
							if (stockage === 'fs') {
								const cheminImage = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + categories[i].image)
								if (await fs.pathExists(cheminImage)) {
									image = await fs.readFile(cheminImage)
								}
							} else if (stockage === 's3') {
								image = await lireFichierS3(code + '/' + categories[i].image)
							}
							if (image !== '' && image !== 'erreur' && magic.includes(image.toString('hex', 0, 4)) === true) {
								doc.font('Helvetica-Bold').text((i + 1) + '. (' + messages.visibles[i].length + ')').image(image, { fit: [40, 40] })
								doc.moveDown()
							} else {
								doc.font('Helvetica-Bold').text((i + 1) + '. ' + categories[i].alt + ' (' + messages.visibles[i].length + ')')
							}
							messages.visibles[i].forEach((message) => {
								doc.fontSize(9)
								doc.font('Helvetica').text('• ' + message.reponse.texte)
							})
						}
						doc.moveDown()
					}
				} else {
					doc.font('Helvetica-Bold').text(t[req.session.langue].reponses + ' (' + messages.visibles.length + ')', { underline: true })
					doc.moveDown()
					messages.visibles.forEach((message) => {
						doc.fontSize(9)
						doc.font('Helvetica').text('• ' + message.reponse.texte)
					})
				}
				// Messages supprimés
				if (messages.supprimes.length > 0) {
					doc.moveDown()
					doc.fontSize(12)
					if (categories.length > 0) {
						let totalMessagesSupprimes = 0
						messages.supprimes.forEach((categorie) => {
							totalMessagesSupprimes = totalMessagesSupprimes + categorie.length
						})
						doc.font('Helvetica-Bold').text(t[req.session.langue].messagesSupprimes + ' (' + totalMessagesSupprimes + ')', { underline: true })
						doc.moveDown()
						for (let i = 0; i < categories.length; i++) {
							if (categories[i].texte !== '') {
								doc.fontSize(10)
								doc.font('Helvetica-Bold').text((i + 1) + '. ' + categories[i].texte + ' (' + messages.supprimes[i].length + ')')
								if (categories[i].image !== '') {
									let image = ''
									if (stockage === 'fs') {
										const cheminImage = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + categories[i].image)
										if (await fs.pathExists(cheminImage)) {
											image = await fs.readFile(cheminImage)
										}
									} else if (stockage === 's3') {
										image = await lireFichierS3(code + '/' + categories[i].image)
									}
									if (image !== '' && image !== 'erreur' && magic.includes(image.toString('hex', 0, 4)) === true) {
										doc.image(image, { fit: [40, 40] })
										doc.moveDown()
									} else {
										doc.fontSize(10)
										doc.font('Helvetica').text(categories[i].alt)
										doc.moveDown()
									}
								}
								messages.supprimes[i].forEach((message) => {
									doc.fontSize(9)
									doc.font('Helvetica').text('• ' + message.reponse.texte)
								})
							} else if (categories[i].image !== '') {
								doc.fontSize(10)
								let image = ''
								if (stockage === 'fs') {
									const cheminImage = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + categories[i].image)
									if (await fs.pathExists(cheminImage)) {
										image = await fs.readFile(cheminImage)
									}
								} else if (stockage === 's3') {
									image = await lireFichierS3(code + '/' + categories[i].image)
								}
								if (image !== '' && image !== 'erreur' && magic.includes(image.toString('hex', 0, 4)) === true) {
									doc.font('Helvetica-Bold').text((i + 1) + '. (' + messages.supprimes[i].length + ')').image(image, { fit: [40, 40] })
									doc.moveDown()
								} else {
									doc.font('Helvetica-Bold').text((i + 1) + '. ' + categories[i].alt + ' (' + messages.supprimes[i].length + ')')
									doc.moveDown()
								}
								messages.supprimes[i].forEach((message) => {
									doc.fontSize(9)
									doc.font('Helvetica').text('• ' + message.reponse.texte)
								})
							}
							doc.moveDown()
						}
					} else {
						doc.font('Helvetica-Bold').text(t[req.session.langue].messagesSupprimes + ' (' + messages.supprimes.length + ')', { underline: true })
						doc.moveDown()
						messages.supprimes.forEach((message) => {
							doc.fontSize(9)
							doc.font('Helvetica').text('• ' + message.reponse.texte)
						})
					}
				}
			} else if (type === 'Nuage-de-mots' && typeof donnees === 'object' && donnees !== null) {
				const mots = definirMotsNuageDeMots(reponses, bannis)
				if (dateDebut !== '' && dateFin !== '') {
					doc.fontSize(8)
					doc.font('Helvetica').text(formaterDate(dateDebut, t[req.session.langue].demarre, req.session.langue) + ' - ' + formaterDate(dateFin, t[req.session.langue].termine, req.session.langue))
					doc.moveDown()
				}
				doc.moveDown()
				doc.fontSize(12)
				doc.font('Helvetica-Bold').text(t[req.session.langue].question, { underline: true })
				doc.moveDown()
				doc.font('Helvetica-Bold').text(donnees.question)
				if (Object.keys(donnees.support).length > 0) {
					doc.fontSize(10)
					doc.moveDown()
					doc.moveDown()
					doc.fontSize(12)
					doc.font('Helvetica-Bold').text(t[req.session.langue].support, { underline: true })
					doc.fontSize(10)
					doc.moveDown()
					if (donnees.support.type === 'image' && donnees.support.fichier !== '') {
						let support = ''
						if (stockage === 'fs') {
							const cheminSupport = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + donnees.support.fichier)
							if (await fs.pathExists(cheminSupport)) {
								support = await fs.readFile(cheminSupport)
							}
						} else if (stockage === 's3') {
							support = await lireFichierS3(code + '/' + donnees.support.fichier)
						}
						if (support !== '' && support !== 'erreur' && magic.includes(support.toString('hex', 0, 4)) === true) {
							doc.image(support, { fit: [120, 120] })
							doc.moveDown()
						} else {
							doc.font('Helvetica').text(t[req.session.langue].image + ' ' + donnees.support.alt)
							doc.moveDown()
						}
					} else if (donnees.support.type === 'audio') {
						doc.font('Helvetica').text(t[req.session.langue].fichierAudio + ' ' + donnees.support.alt)
						doc.moveDown()
					} else if (donnees.support.type === 'video') {
						doc.font('Helvetica').text(t[req.session.langue].video, {
							link: donnees.support.lien,
							underline: true
						})
						doc.moveDown()
					}
				}
				doc.moveDown()
				doc.fontSize(12)
				doc.font('Helvetica-Bold').text(t[req.session.langue].reponses + ' (' + mots.visibles.length + ')', { underline: true })
				doc.moveDown()
				mots.visibles.forEach((mot) => {
					doc.fontSize(9)
					doc.font('Helvetica').text('• ' + mot.reponse.texte)
				})
				if (mots.supprimes.length > 0) {
					doc.moveDown()
					doc.fontSize(12)
					doc.font('Helvetica-Bold').text(t[req.session.langue].motsSupprimes + ' (' + mots.supprimes.length + ')', { underline: true })
					doc.moveDown()
					mots.supprimes.forEach((mot) => {
						doc.fontSize(9)
						doc.font('Helvetica').text('• ' + mot.reponse.texte)
					})
				}
			}
			doc.end()
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/supprimer-resultat', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant) return res.status(403).send('non_autorise')
		try {
			const code = parseInt(req.body.code)
			const session = parseInt(req.body.session)
			const interactionExiste = await db.EXISTS('interactions:' + code)
			if (interactionExiste !== 1) return res.status(400).send('erreur_code')
			let donneesInteraction = await db.HGETALL('interactions:' + code)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			let identifiantInteraction = ''
			if (donneesInteraction.hasOwnProperty('identifiant')) {
				identifiantInteraction = donneesInteraction.identifiant
			}
			if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return res.status(403).send('non_autorise')
			const reponses = parseJSON(donneesInteraction.reponses, {})
			const sessions = parseJSON(donneesInteraction.sessions, {})
			if (reponses[session]) {
				delete reponses[session]
			}
			if (sessions[session]) {
				delete sessions[session]
			}
			await db.HSET('interactions:' + code, ['reponses', JSON.stringify(reponses), 'sessions', JSON.stringify(sessions)])
			res.status(200).json({ reponses: reponses, sessions: sessions })
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/ajouter-dossier', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) return res.status(401).send('non_connecte')
		try {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return res.status(500).send('erreur')
			if (comparerHash(req.session.motdepasse, donneesUtilisateur.motdepasse) === false) return res.status(403).send('non_autorise')
			const nom = req.body.dossier
			let dossiers = []
			if (donneesUtilisateur.hasOwnProperty('dossiers')) {
				dossiers = parseJSON(donneesUtilisateur.dossiers, [])
			}
			const id = Math.random().toString(36).substring(2)
			dossiers.push({ id: id, nom: nom, contenus: [] })
			await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
			res.status(200).json({ id: id, nom: nom, contenus: [] })
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/modifier-dossier', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) return res.status(401).send('non_connecte')
		try {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return res.status(500).send('erreur')
			if (comparerHash(req.session.motdepasse, donneesUtilisateur.motdepasse) === false) return res.status(403).send('non_autorise')
			const nom = req.body.dossier
			const dossierId = req.body.dossierId
			const dossiers = parseJSON(donneesUtilisateur.dossiers, [])
			dossiers.forEach((dossier, index) => {
				if (dossier.id === dossierId) {
					dossiers[index].nom = nom
				}
			})
			await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
			res.status(200).send('dossier_modifie')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/supprimer-dossier', async (req, res) => {
		const identifiant = req.body.identifiant
		if (!req.session.identifiant || req.session.identifiant !== identifiant || req.session.role !== 'utilisateur' || !req.session.hasOwnProperty('motdepasse') || (req.session.hasOwnProperty('motdepasse') && req.session.motdepasse === '')) return res.status(401).send('non_connecte')
		try {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return res.status(500).send('erreur')
			if (comparerHash(req.session.motdepasse, donneesUtilisateur.motdepasse) === false) return res.status(403).send('non_autorise')
			const dossierId = req.body.dossierId
			const dossiers = parseJSON(donneesUtilisateur.dossiers, [])
			dossiers.forEach((dossier, index) => {
				if (dossier.id === dossierId) {
					dossiers.splice(index, 1)
				}
			})
			await db.HSET('utilisateurs:' + identifiant, 'dossiers', JSON.stringify(dossiers))
			res.status(200).send('dossier_supprime')
		} catch (err) {
			console.error(err.stack)
			res.status(500).send('erreur')
		}
	})

	app.post('/api/televerser-image', (req, res) => {
		const identifiant = req.session.identifiant
		if (!identifiant) return res.status(401).send('non_connecte')
		const buffersImage = []
		let nomFichier
		const donneesFormulaire = new Map()
		let erreurBusboy = false
		let fichierTropVolumineux = false
		const busboy = Busboy({ headers: req.headers, limits: { fileSize: limiteTeleversement } })
		busboy.on('field', (champ, valeur) => {
			donneesFormulaire.set(champ, valeur)
		})
		busboy.on('file', async (champ, fichier, meta) => {
			nomFichier = definirNomFichier(meta.filename)
			fichier.on('data', (donnees) => {
				buffersImage.push(donnees)
			})
			fichier.on('limit', () => {
				fichierTropVolumineux = true
			})
		})
		busboy.on('error', (err) => {
			console.error(err.stack)
			erreurBusboy = true
			res.status(500).send('erreur_televersement')
		})
		busboy.on('finish', async () => {
			if (erreurBusboy) return
			if (fichierTropVolumineux) return res.status(413).send('fichier_trop_volumineux')
			const bufferImage = Buffer.concat(buffersImage)
			if (!bufferImage || !nomFichier) return res.status(422).send('erreur_televersement')
			const code = donneesFormulaire.get('code')
			const alt = path.parse(donneesFormulaire.get('nomfichier')).name
			const extensionFichier = path.parse(nomFichier).ext.toLowerCase()
			let bufferOptimise = null
			try {
				if (extensionFichier === '.jpg' || extensionFichier === '.jpeg') {
					bufferOptimise = await sharp(bufferImage, { failOnError: false })
						.withMetadata()
						.rotate()
						.jpeg({
							quality: 90,
							progressive: true
						})
						.resize(1000, 1000, { fit: sharp.fit.inside, withoutEnlargement: true })
						.toBuffer()
				} else {
					bufferOptimise = await sharp(bufferImage, { failOnError: false })
						.withMetadata()
						.resize(1000, 1000, { fit: sharp.fit.inside, withoutEnlargement: true })
						.toBuffer()
				}
				if (!bufferOptimise) return res.status(422).send('erreur_televersement')
				if (stockage === 's3') {
					await s3Client.send(new PutObjectCommand(definirParametresTeleverserS3(code + '/' + nomFichier, bufferOptimise)))
					res.status(200).json({ image: nomFichier, alt: alt })
				} else {
					const cheminFichier = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + nomFichier)
					await fs.ensureDir(path.dirname(cheminFichier))
					await fs.writeFile(cheminFichier, bufferOptimise)
					res.status(200).json({ image: nomFichier, alt: alt })
				}
			} catch (err) {
				console.error(err.stack)
				res.status(422).send('erreur_televersement')
			}
		})
		req.pipe(busboy)
	})

	app.post('/api/dupliquer-medias', async (req, res) => {
		if (!req.session.identifiant) return res.status(403).send('non_autorise')
		const code = parseInt(req.body.code)
		if (!Number.isInteger(code) || code <= 0) return res.status(400).send('erreur')
		const medias = req.body.medias
		if (!Array.isArray(medias)) return res.status(400).send('erreur')
		const mediasFiltres = medias.filter((m) => {
			return typeof m === 'string' && m !== '' && !/[/\\]/.test(m) && !m.includes('..')
		})
		try {
			await Promise.all(mediasFiltres.map(async (media) => {
				if (stockage === 'fs' && await fs.pathExists(path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + media))) {
					await fs.copy(path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + media), path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/dup-' + media))
				} else if (stockage === 's3') {
					const nouvelleCle = code + '/dup-' + media
					await s3Client.send(new CopyObjectCommand(definirParametresCopierS3(nouvelleCle, '/' + bucket + '/' + code + '/' + media)))
				}
			}))
			res.status(200).send('medias_dupliques')
		} catch (e) {
			res.status(500).send('erreur')
		}
	})

	app.post('/api/televerser-media', (req, res) => {
		const identifiant = req.session.identifiant
		if (!identifiant) return res.status(401).send('non_connecte')
		const buffersFichier = []
		let nomFichier
		const donneesFormulaire = new Map()
		let erreurBusboy = false
		let fichierTropVolumineux = false
		const busboy = Busboy({ headers: req.headers, limits: { fileSize: limiteTeleversement } })
		busboy.on('field', (champ, valeur) => {
			donneesFormulaire.set(champ, valeur)
		})
		busboy.on('file', async (champ, fichier, meta) => {
			nomFichier = definirNomFichier(meta.filename)
			fichier.on('data', (donnees) => {
				buffersFichier.push(donnees)
			})
			fichier.on('limit', () => {
				fichierTropVolumineux = true
			})
		})
		busboy.on('error', (err) => {
			console.error(err.stack)
			erreurBusboy = true
			res.status(500).send('erreur_televersement')
		})
		busboy.on('finish', async () => {
			if (erreurBusboy) return
			if (fichierTropVolumineux) return res.status(413).send('fichier_trop_volumineux')
			const bufferFichier = Buffer.concat(buffersFichier)
			if (!bufferFichier || !nomFichier) return res.status(422).send('erreur_televersement')
			const code = donneesFormulaire.get('code')
			const alt = path.parse(donneesFormulaire.get('nomfichier')).name
			const extensionFichier = path.parse(nomFichier).ext.toLowerCase()
			let bufferOptimise = null
			let typeFichier
			try {
				if (extensionFichier === '.jpg' || extensionFichier === '.jpeg') {
					bufferOptimise = await sharp(bufferFichier, { failOnError: false })
						.withMetadata()
						.rotate()
						.jpeg({
							quality: 90,
							progressive: true
						})
						.resize(1000, 1000, { fit: sharp.fit.inside, withoutEnlargement: true })
						.toBuffer()
					typeFichier = 'image'
				} else if (extensionFichier === '.png' || extensionFichier === '.gif') {
					bufferOptimise = await sharp(bufferFichier, { failOnError: false })
						.withMetadata()
						.resize(1000, 1000, { fit: sharp.fit.inside, withoutEnlargement: true })
						.toBuffer()
					typeFichier = 'image'
				} else {
					bufferOptimise = bufferFichier
					typeFichier = 'audio'
				}
				if (!bufferOptimise) return res.status(422).send('erreur_televersement')
				if (stockage === 's3') {
					await s3Client.send(new PutObjectCommand(definirParametresTeleverserS3(code + '/' + nomFichier, bufferOptimise)))
					res.status(200).json({ fichier: nomFichier, alt: alt, type: typeFichier })
				} else {
					const cheminFichier = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + nomFichier)
					await fs.ensureDir(path.dirname(cheminFichier))
					await fs.writeFile(cheminFichier, bufferOptimise)
					res.status(200).json({ fichier: nomFichier, alt: alt, type: typeFichier })
				}
			} catch (err) {
				console.error(err.stack)
				res.status(422).send('erreur_televersement')
			}
		})
		req.pipe(busboy)
	})

	app.post('/api/supprimer-fichiers', async (req, res) => {
		if (!req.session.identifiant) return res.status(403).send('non_connecte')
		const code = req.body.code
		const fichiers = req.body.fichiers
		if (!Array.isArray(fichiers)) return res.status(500).send('erreur')
		await Promise.all(fichiers.map((fichier) => supprimerFichier(code, fichier)))
		res.status(200).send('fichiers_supprimes')
	})

	app.post('/api/ladigitale', async (req, res) => {
		const tokenApi = req.body.token
		const domaine = req.headers.host
		const lienCible = req.body.lien
		const actionRequise = req.body.action
		if (production && !verifierURL(lienCible, ['https'])) return res.status(500).send('erreur')
		const urlCible = new URL(lienCible)
		const hoteCible = urlCible.hostname.toLowerCase()
		if (verifierHoteBloque(hoteCible)) return res.status(500).send('erreur')
		const params = new URLSearchParams()
		params.append('token', tokenApi)
		params.append('domaine', domaine)
		try {
			const reponseExterne = await axios.post(lienCible, params, { timeout: 5000 })
			const statutExterne = reponseExterne.data
			if (statutExterne === 'non_autorise' || statutExterne === 'erreur') return res.status(401).send('erreur_token')
			if (statutExterne !== 'token_autorise') return res.status(500).send('erreur')
			// ACTION : CRÉER
			if (actionRequise === 'creer') {
				const titre = req.body.nom
				const type = req.body.interaction
				const code = Math.floor(1000000 + Math.random() * 9000000)
				const motdepasse = req.body.motdepasse
				const date = dayjs().format()
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 0) return res.status(500).send('erreur')
				await db.HSET('interactions:' + code, ['type', type, 'titre', titre, 'code', code, 'motdepasse', motdepasse, 'donnees', JSON.stringify({}), 'reponses', JSON.stringify({}), 'sessions', JSON.stringify({}), 'statut', '', 'session', 1, 'date', date, 'digidrive', 1])
				if (stockage === 'fs') {
					const chemin = path.join(__dirname, '..', '/static/fichiers/' + code.toString())
					await fs.mkdirp(chemin)
				}
				return res.status(200).send(code.toString())
			}
			// ACTION : MODIFIER TITRE
			else if (actionRequise === 'modifier-titre') {
				const code = req.body.id
				const titre = req.body.titre
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return res.status(404).send('contenu_inexistant')
				await db.HSET('interactions:' + code, 'titre', titre)
				return res.status(200).send('titre_modifie')
			}
			// ACTION : MODIFIER (mot de passe + titre)
			else if (actionRequise === 'modifier') {
				const code = req.body.id
				const titre = req.body.titre
				const ancienmotdepasse = req.body.ancienmotdepasse
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return res.status(404).send('contenu_inexistant')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				if (!donneesInteraction.hasOwnProperty('motdepasse') || ancienmotdepasse !== donneesInteraction.motdepasse) return res.status(403).send('non_autorise')
				const motdepasse = req.body.motdepasse
				await db.HSET('interactions:' + code, ['titre', titre, 'motdepasse', motdepasse])
				return res.status(200).send('contenu_modifie')
			}
			// ACTION : AJOUTER (Lier au compte)
			else if (actionRequise === 'ajouter') {
				const identifiant = req.body.identifiant
				const motdepasse = req.body.motdepasse
				const code = parseInt(req.body.id)
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return res.status(404).send('contenu_inexistant')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				if (donneesInteraction.hasOwnProperty('motdepasse') && motdepasse === donneesInteraction.motdepasse) return res.status(200).json({ titre: donneesInteraction.titre, identifiant: identifiant })
				if (!donneesInteraction.hasOwnProperty('motdepasse') || donneesInteraction.motdepasse !== '') return res.status(403).send('non_autorise')
				const utilisateurExiste = await db.EXISTS('utilisateurs:' + donneesInteraction.identifiant)
				if (utilisateurExiste !== 1) return res.status(500).send('erreur')
				let donneesUtilisateur = await db.HGETALL('utilisateurs:' + donneesInteraction.identifiant)
				donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
				const autorisation = (motdepasse.trim() !== '' && donneesUtilisateur.hasOwnProperty('motdepasse') && donneesUtilisateur.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, donneesUtilisateur.motdepasse))
				if (!autorisation) return res.status(403).send('non_autorise')
				await db.HSET('interactions:' + code, 'digidrive', 1)
				return res.status(200).json({ titre: donneesInteraction.titre, identifiant: donneesInteraction.identifiant })
			}
			// ACTION : DUPLIQUER
			else if (actionRequise === 'dupliquer') {
				const identifiant = req.body.identifiant
				const motdepasse = req.body.motdepasse
				const interaction = parseInt(req.body.id)
				const interactionExiste = await db.EXISTS('interactions:' + interaction)
				if (interactionExiste !== 1) return res.status(404).send('contenu_inexistant')
				let donneesInteraction = await db.HGETALL('interactions:' + interaction)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				if (donneesInteraction.hasOwnProperty('motdepasse') && motdepasse.trim() === donneesInteraction.motdepasse) {
					const code = Math.floor(1000000 + Math.random() * 9000000)
					const nouveaumotdepasse = req.body.nouveaumotdepasse
					const date = dayjs().format()
					const nouvelleInteractionExiste = await db.EXISTS('interactions:' + code)
					if (nouvelleInteractionExiste !== 0) return res.status(500).send('erreur')
					await db.HSET('interactions:' + code, ['type', donneesInteraction.type, 'titre', 'Copie de ' + donneesInteraction.titre, 'code', code, 'motdepasse', nouveaumotdepasse, 'donnees', donneesInteraction.donnees, 'reponses', JSON.stringify({}), 'sessions', JSON.stringify({}), 'statut', '', 'session', 1, 'date', date, 'digidrive', 1])
					if (stockage === 'fs' && await fs.pathExists(path.join(__dirname, '..', '/static/fichiers/' + interaction.toString()))) {
						await fs.copy(path.join(__dirname, '..', '/static/fichiers/' + interaction.toString()), path.join(__dirname, '..', '/static/fichiers/' + code.toString()))
					} else if (stockage === 's3') {
						const listeObjets = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: interaction + '/' }))
						if (listeObjets && listeObjets.Contents) {
							const promessesCopiesS3 = listeObjets.Contents.map((objet) => {
								const nCle = code + '/' + objet.Key.replace(interaction + '/', '')
								return s3Client.send(new CopyObjectCommand(definirParametresCopierS3(nCle, '/' + bucket + '/' + objet.Key)))
							})
							await Promise.all(promessesCopiesS3)
						}
					}
					return res.status(200).send(code.toString())
				} else if (donneesInteraction.hasOwnProperty('motdepasse') && donneesInteraction.motdepasse === '') {
					const utilisateurExiste = await db.EXISTS('utilisateurs:' + identifiant)
					if (utilisateurExiste !== 1) return res.status(500).send('erreur')
					let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
					donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
					const autorisation = (motdepasse.trim() !== '' && donneesUtilisateur.hasOwnProperty('motdepasse') && donneesUtilisateur.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, donneesUtilisateur.motdepasse))
					if (!autorisation) return res.status(403).send('non_autorise')
					const code = Math.floor(1000000 + Math.random() * 9000000)
					const date = dayjs().format()
					const nouvelleInteractionExiste = await db.EXISTS('interactions:' + code)
					if (nouvelleInteractionExiste !== 0) return res.status(500).send('erreur')
					await db.multi()
						.HSET('interactions:' + code, ['type', donneesInteraction.type, 'titre', 'Copie de ' + donneesInteraction.titre, 'code', code, 'identifiant', identifiant, 'motdepasse', '', 'donnees', donneesInteraction.donnees, 'reponses', JSON.stringify({}), 'sessions', JSON.stringify({}), 'statut', '', 'session', 1, 'date', date, 'digidrive', 1])
						.SADD('interactions-creees:' + identifiant, code.toString())
						.exec()
					if (stockage === 'fs' && await fs.pathExists(path.join(__dirname, '..', '/static/fichiers/' + interaction.toString()))) {
						await fs.copy(path.join(__dirname, '..', '/static/fichiers/' + interaction.toString()), path.join(__dirname, '..', '/static/fichiers/' + code.toString()))
					} else if (stockage === 's3') {
						const listeObjets = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: interaction + '/' }))
						if (listeObjets && listeObjets.Contents) {
							const promessesCopiesS3 = listeObjets.Contents.map((objet) => {
								const nCle = code + '/' + objet.Key.replace(interaction + '/', '')
								return s3Client.send(new CopyObjectCommand(definirParametresCopierS3(nCle, '/' + bucket + '/' + objet.Key)))
							})
							await Promise.all(promessesCopiesS3)
						}
					}
					return res.status(200).send(code.toString())
				} else {
					return res.status(403).send('non_autorise')
				}
			}
			// ACTION : EXPORTER
			else if (actionRequise === 'exporter') {
				const identifiant = req.body.identifiant
				const motdepasse = req.body.motdepasse
				const code = parseInt(req.body.id)
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return res.status(404).send('contenu_inexistant')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				const dossier = path.join(__dirname, '..', '/static/temp', code.toString())
				const dossierFichiers = path.join(dossier, 'fichiers')
				const promessesFichiers = []
				let exportAutorise = false
				if (donneesInteraction.hasOwnProperty('motdepasse') && donneesInteraction.motdepasse === motdepasse) {
					exportAutorise = true
				} else if (donneesInteraction.hasOwnProperty('motdepasse') && donneesInteraction.motdepasse === '') {
					const utilisateurExiste = await db.EXISTS('utilisateurs:' + identifiant)
					if (utilisateurExiste !== 1) return res.status(500).send('erreur')
					let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
					donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
					if (motdepasse.trim() !== '' && donneesUtilisateur.hasOwnProperty('motdepasse') && donneesUtilisateur.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, donneesUtilisateur.motdepasse)) {
						exportAutorise = true
					}
				}
				if (!exportAutorise) return res.status(403).send('non_autorise')
				await fs.mkdirp(dossierFichiers)
				await fs.writeFile(path.join(dossier, 'donnees.json'), JSON.stringify(donneesInteraction, '', 4), 'utf8')
				const donnees = parseJSON(donneesInteraction.donnees, {})
				if (Object.keys(donnees).length === 0) return res.status(500).send('erreur')
				const fichiers = definirListeFichiers(donneesInteraction.type, donnees)
				for (const fichier of fichiers) {
					promessesFichiers.push(
						copierFichierExport({ chemin: path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + fichier), cleS3: code.toString() + '/' + fichier }, path.join(dossierFichiers, fichier))
					)
				}
				await Promise.all(promessesFichiers)
				const archiveId = Math.floor((Math.random() * 100000) + 1)
				const nomArchive = code + '_' + archiveId + '.zip'
				const cheminArchive = path.join(path.dirname(dossier), nomArchive)
				const sortie = fs.createWriteStream(cheminArchive)
				const archive = archiver('zip', { zlib: { level: 9 } })
				sortie.on('finish', async () => {
					await fs.remove(dossier)
					res.status(200).send(nomArchive)
				})
				sortie.on('error', async (err) => {
					console.error(err.stack)
					try { await fs.remove(dossier) } catch {}
					res.status(500).send('erreur')
				})
				archive.pipe(sortie)
				archive.directory(dossier, false)
				archive.on('error', async (err) => {
					console.error(err.stack)
					try { await fs.remove(dossier) } catch {}
					res.status(500).send('erreur')
				})
				archive.finalize()
				return
			}
			// ACTION : SUPPRIMER
			else if (actionRequise === 'supprimer') {
				const identifiant = req.body.identifiant
				const motdepasse = req.body.motdepasse
				const code = parseInt(req.body.id)
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return res.status(200).send('contenu_supprime')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				if (donneesInteraction.hasOwnProperty('motdepasse') && motdepasse === donneesInteraction.motdepasse) {
					await db.UNLINK('interactions:' + code)
					if (stockage === 'fs') {
						await fs.remove(path.join(__dirname, '..', '/static/fichiers/' + code.toString()))
					} else if (stockage === 's3') {
						const listeObjets = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: code + '/' }))
						if (listeObjets && listeObjets.Contents) {
							const promessesCopiesS3 = listeObjets.Contents.map((objet) => {
								return s3Client.send(new DeleteObjectCommand(definirParametresSupprimerS3(objet.Key)))
							})
							await Promise.all(promessesCopiesS3)
						}
					}
					return res.status(200).send('contenu_supprime')
				} else if (donneesInteraction.hasOwnProperty('motdepasse') && donneesInteraction.motdepasse === '') {
					const utilisateurExiste = await db.EXISTS('utilisateurs:' + identifiant)
					if (utilisateurExiste !== 1) return res.status(500).send('erreur')
					let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
					donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
					const autorisation = (motdepasse.trim() !== '' && donneesUtilisateur.hasOwnProperty('motdepasse') && donneesUtilisateur.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, donneesUtilisateur.motdepasse))
					if (!autorisation) return res.status(403).send('non_autorise')
					await db.multi()
						.UNLINK('interactions:' + code)
						.SREM('interactions-creees:' + identifiant, code.toString())
						.exec()
					if (stockage === 'fs') {
						await fs.remove(path.join(__dirname, '..', '/static/fichiers/' + code.toString()))
					} else if (stockage === 's3') {
						const listeObjets = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: code + '/' }))
						if (listeObjets && listeObjets.Contents) {
							const promessesCopiesS3 = listeObjets.Contents.map((objet) => {
								return s3Client.send(new DeleteObjectCommand(definirParametresSupprimerS3(objet.Key)))
							})
							await Promise.all(promessesCopiesS3)
						}
					}
					return res.status(200).send('contenu_supprime')
				} else {
					return res.status(403).send('non_autorise')
				}
			}
			// Action non reconnue
			return res.status(500).send('erreur')
		} catch (err) {
			console.error(err.stack)
			return res.status(500).send('erreur')
		}
	})

	app.post('/api/ladigitale/importer', (req, res) => {
		televerserArchive(req, res, async (err) => {
			if (err) return res.status(500).send('erreur')
			if (!req.file) return res.status(500).send('erreur')
			const source = path.join(__dirname, '..', '/static/temp/' + req.file.filename)
			const dossierTemporaire = path.join(__dirname, '..', '/static/temp/archive-' + Math.floor((Math.random() * 100000) + 1))
			try {
				const tokenApi = req.body.token
				const domaine = req.headers.host
				const lienCible = req.body.lien
				if (production && !verifierURL(lienCible, ['https'])) return res.status(500).send('erreur')
				const urlCible = new URL(lienCible)
				const hoteCible = urlCible.hostname.toLowerCase()
				if (verifierHoteBloque(hoteCible)) return res.status(500).send('erreur')
				const params = new URLSearchParams()
				params.append('token', tokenApi)
				params.append('domaine', domaine)
				const reponseApi = await axios.post(lienCible, params, { timeout: 5000 })
				if (reponseApi.data === 'non_autorise' || reponseApi.data === 'erreur') return res.status(401).send('erreur_token')
				if (reponseApi.data !== 'token_autorise' || !req.body.action || req.body.action !== 'importer') return res.status(500).send('erreur')
				const titre = req.body.titre
				const motdepasse = req.body.motdepasse
				await extraireArchive(source, dossierTemporaire)
				const donnees = await fs.readJson(path.normalize(dossierTemporaire + '/donnees.json'))
				if (typeof req.body.parametres !== 'string') throw new Error('parametres_invalides')
				const parametres = parseJSON(req.body.parametres, null)
				if (parametres === null) throw new Error('parametres_invalides')
				// Vérification des clés des données
				const structureValide = (donnees.hasOwnProperty('type') && donnees.hasOwnProperty('titre') && donnees.hasOwnProperty('code') && donnees.hasOwnProperty('motdepasse') && donnees.hasOwnProperty('donnees') && donnees.hasOwnProperty('reponses') && donnees.hasOwnProperty('sessions') && donnees.hasOwnProperty('statut') && donnees.hasOwnProperty('session') && donnees.hasOwnProperty('date'))
				if (!structureValide) throw new Error('structure_invalide')
				const code = Math.floor(1000000 + Math.random() * 9000000)
				const date = dayjs().format()
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 0) return res.status(500).send('erreur')
				if (parametres.resultats === true) {
					await db.HSET('interactions:' + code, ['type', donnees.type, 'titre', titre, 'code', code, 'motdepasse', motdepasse, 'donnees', donnees.donnees, 'reponses', donnees.reponses, 'sessions', donnees.sessions, 'statut', '', 'session', donnees.session, 'date', date, 'digidrive', 1])
				} else {
					await db.HSET('interactions:' + code, ['type', donnees.type, 'titre', titre, 'code', code, 'motdepasse', motdepasse, 'donnees', donnees.donnees, 'reponses', JSON.stringify({}), 'sessions', JSON.stringify({}), 'statut', '', 'session', 1, 'date', date, 'digidrive', 1])
				}
				const promessesFichiers = []
				const fichiers = definirListeFichiers(donnees.type, parseJSON(donnees.donnees, {}))
				const dossierDestination = path.join(__dirname, '..', '/static/fichiers/' + code.toString())
				for (const fichier of fichiers) {
					promessesFichiers.push(televerserFichierArchive(dossierTemporaire, dossierDestination, fichier, code))
				}
				await Promise.all(promessesFichiers)
				await supprimerArchives(source, dossierTemporaire)
				res.status(200).send(code.toString())
			} catch (err) {
				console.error(err.stack)
				await supprimerArchives(source, dossierTemporaire)
				if (err.message === 'structure_invalide' || err.message === 'parametres_invalides') {
					return res.status(400).send('donnees_corrompues')
				}
				res.status(500).send('erreur')
			}
		})
	})

	app.use((req, res) => {
		res.redirect(302, '/')
	})

	app.use((err, req, res, next) => {
		console.error(err.stack)
		if (res.headersSent) return next(err)
		if (req.path.startsWith('/api/')) {
			res.status(500).send('erreur')
		} else {
			res.redirect(302, '/')
		}
	})

	const port = process.env.PORT || 3000
	httpServer.listen(port)

	const io = new Server(httpServer, {
		wsEngine: eiows.Server,
		cors: {
			origin: hoteWs
		},
		pingInterval: 120000,
		pingTimeout: 100000,
		maxHttpBufferSize: 1e7,
		cookie: false,
		perMessageDeflate: false
	})
	if (cluster === true) {
		io.adapter(createAdapter())
	}
	const wrap = middleware => (socket, next) => middleware(socket.request, {}, next)
	io.use(wrap(sessionMiddleware))
	// Rate limit pour les sockets : 100 actions par seconde par worker
	const compteurSocket = new Map()
	io.use((socket, next) => {
		const identifiant = socket.request.session?.identifiant || socket.handshake.address
		if (!compteurSocket.has(identifiant)) {
			compteurSocket.set(identifiant, { n: 0, intervalle: setInterval(() => {
				compteurSocket.get(identifiant).n = 0
			}, 1000) })
		}
		socket.use((paquet, suivant) => {
			let etat = compteurSocket.get(identifiant)
			if (!etat) {
				etat = { n: 0, intervalle: setInterval(() => {
					const e = compteurSocket.get(identifiant)
					if (e) e.n = 0
				}, 1000) }
				compteurSocket.set(identifiant, etat)
			}
			etat.n++
			if (etat.n > 100) {
				return suivant(new Error('connexions_trop_nombreuses'))
			}
			suivant()
		})
		socket.on('disconnect', () => {
			const io_sockets = [...io.sockets.sockets.values()]
			const autreSockets = io_sockets.filter((s) => {
				return s.id !== socket.id && (s.request.session?.identifiant || s.handshake.address) === identifiant
			})
			if (autreSockets.length === 0) {
				const etat = compteurSocket.get(identifiant)
				if (etat) {
					clearInterval(etat.intervalle)
					compteurSocket.delete(identifiant)
				}
			}
		})
		next()
	})

	io.on('connection', (socket) => {
		const req = socket.request
		socket.use((__, next) => {
			req.session.reload((err) => {
				if (err) return socket.disconnect()
				next()
			})
		})

		socket.on('connexion', async (donnees) => {
			try {
				const code = donnees.code
				const identifiant = donnees.identifiant
				let nom = donnees.nom
				if (donnees.nomAleatoire === true) {
					const generateur = new NameForgeJS()
					const noms = generateur.generateNames()
					nom = noms[0].replace(/(^\w{1})|(\s+\w{1})/g, lettre => lettre.toUpperCase())
					req.session.nom = nom
					await sauvegarderSession(req)
				}
				socket.data.identifiant = identifiant
				socket.data.nom = nom
				socket.join(code)
				const clients = await io.to(code).fetchSockets()
				const utilisateurs = []
				if (clients.length > 0) {
					for (let i = 0; i < clients.length; i++) {
						if (clients[i].data.identifiant === identifiant && utilisateurs.map((e) => { return e.identifiant }).includes(identifiant) === true) {
							const nouvelIdentifiant = 'u' + Math.random().toString(16).slice(3)
							clients[i].data.identifiant = nouvelIdentifiant
							socket.data.identifiant = nouvelIdentifiant
							req.session.identifiant = nouvelIdentifiant
							await sauvegarderSession(req)
						}
						utilisateurs.push({ identifiant: clients[i].data.identifiant, nom: clients[i].data.nom })
					}
				}
				const utilisateursConnectes = utilisateurs.filter((v, i, a) => a.findIndex(t => (t.identifiant === v.identifiant && t.nom === v.nom)) === i)
				io.to(code).emit('connexion', utilisateursConnectes)
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('deconnexion', (code) => {
			socket.leave(code)
			socket.to(code).emit('deconnexion', req.session.identifiant)
		})

		socket.on('disconnecting', () => {
			if (req.session.identifiant !== '') {
				socket.rooms.forEach((room) => {
					io.to(room).emit('deconnexion', req.session.identifiant)
				})
			}
		})

		socket.on('interactionouverte', async (donnees) => {
			try {
				const clients = await io.to(donnees.code).fetchSockets()
				const utilisateurs = []
				for (let i = 0; i < clients.length; i++) {
					utilisateurs.push({ identifiant: clients[i].data.identifiant, nom: clients[i].data.nom })
				}
				const utilisateursConnectes = utilisateurs.filter((v, i, a) => a.findIndex(t => (t.identifiant === v.identifiant && t.nom === v.nom)) === i)
				socket.emit('connexion', utilisateursConnectes)
				socket.to(donnees.code).emit('interactionouverte', donnees)
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('interactionenattente', async (donnees) => {
			const clients = await io.to(donnees.code).fetchSockets()
			let utilisateurs = []
			for (let i = 0; i < clients.length; i++) {
				utilisateurs.push({ identifiant: clients[i].data.identifiant, nom: clients[i].data.nom })
			}
			utilisateurs = utilisateurs.filter((valeur, index, self) =>
				index === self.findIndex((t) => (
					t.identifiant === valeur.identifiant && t.nom === valeur.nom
				))
			)
			socket.emit('connexion', utilisateurs)
			socket.to(donnees.code).emit('interactionenattente', donnees)
		})

		socket.on('interactionverrouillee', (code) => {
			socket.to(code).emit('interactionverrouillee')
		})

		socket.on('interactiondeverrouillee', (code) => {
			socket.to(code).emit('interactiondeverrouillee')
		})

		socket.on('interactionfermee', (code) => {
			socket.to(code).emit('interactionfermee')
		})

		socket.on('utilisateursbannis', async (donnees) => {
			try {
				const code = parseInt(donnees.code)
				const utilisateursBannis = donnees.utilisateursBannis
				const identifiant = donnees.identifiant
				const type = donnees.type
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return socket.emit('erreurcode')
				await db.HSET('interactions:' + code, 'bannis', JSON.stringify(utilisateursBannis))
				if (type === 'banni') {
					socket.to(donnees.code).emit('utilisateurbanni', identifiant)
				} else {
					socket.to(donnees.code).emit('utilisateurautorise', identifiant)
				}
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('nuageaffiche', (donnees) => {
			socket.to(donnees.code).emit('nuageaffiche', donnees.reponses)
		})

		socket.on('nuagemasque', (code) => {
			socket.to(code).emit('nuagemasque')
		})

		socket.on('questionsuivante', (donnees) => {
			socket.to(donnees.code).emit('questionsuivante', donnees)
		})

		socket.on('classement', (code, donnees) => {
			socket.to(code).emit('classement', donnees)
		})

		socket.on('modifiernom', async (donnees) => {
			try {
				socket.to(donnees.code).emit('modifiernom', donnees)
				req.session.nom = donnees.nom
				await sauvegarderSession(req)
				if (donnees.nom !== '') {
					const code = parseInt(donnees.code)
					const session = parseInt(donnees.session)
					const interactionExiste = await db.EXISTS('interactions:' + code)
					if (interactionExiste === 1) {
						const donneesInteraction = await db.HGETALL('interactions:' + code)
						const reponses = parseJSON(donneesInteraction.reponses, {})
						let reponseModifiee = false
						if (reponses[session]) {
							reponses[session].forEach((item) => {
								if (item.identifiant === donnees.identifiant && item.nom !== donnees.nom) {
									item.nom = donnees.nom
									reponseModifiee = true
								}
							})
						}
						if (reponseModifiee === true) {
							await db.HSET('interactions:' + code, 'reponses', JSON.stringify(reponses))
						}
					}
				}
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('reponse', async (reponse) => {
			try {
				const code = parseInt(reponse.code)
				const session = parseInt(reponse.session)
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return socket.emit('erreurcode')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				const type = donneesInteraction.type
				let reponses = parseJSON(donneesInteraction.reponses, {})
				if (!reponses[session]) {
					reponses[session] = []
				}
				if (type === 'Sondage') {
					if (reponses[session].map((e) => { return e.identifiant }).includes(reponse.donnees.identifiant) === true) {
						reponses[session].forEach((item) => {
							if (item.identifiant === reponse.donnees.identifiant) {
								item.reponse = reponse.donnees.reponse
								if (item.nom !== reponse.donnees.nom && reponse.donnees.nom !== '') {
									item.nom = reponse.donnees.nom
								}
							}
						})
					} else {
						reponses[session].push(reponse.donnees)
					}
				} else if (type === 'Questionnaire') {
					if (reponses[session].map((e) => { return e.identifiant }).includes(reponse.donnees.identifiant) === true) {
						reponses[session].forEach((item) => {
							if (item.identifiant === reponse.donnees.identifiant) {
								item.reponse = reponse.donnees.reponse
								if (reponse.donnees.hasOwnProperty('temps')) {
									item.temps = reponse.donnees.temps
								}
								if (item.nom !== reponse.donnees.nom && reponse.donnees.nom !== '') {
									item.nom = reponse.donnees.nom
								}
							}
						})
					} else {
						reponses[session].push(reponse.donnees)
					}
				} else if (type === 'Remue-méninges' || type === 'Nuage-de-mots') {
					reponses[session].push(reponse.donnees)
				}
				await db.HSET('interactions:' + code, 'reponses', JSON.stringify(reponses))
				socket.to(reponse.code).emit('reponse', reponse)
				socket.emit('reponseenvoyee', reponse)
				let reponsesSession = []
				const donneesSession = []
				let scoreTotal = 0
				if (req.session.identifiant === reponse.donnees.identifiant) {
					reponses[session].forEach((item) => {
						if (item.identifiant === reponse.donnees.identifiant) {
							reponsesSession.push(item)
						}
					})
					if (type === 'Questionnaire' && reponsesSession[0] && reponsesSession[0].reponse) {
						let donnees = parseJSON(donneesInteraction.donnees, {})
						if (donnees && donnees.hasOwnProperty('options') && ((donnees.options.hasOwnProperty('questionsAleatoires') && donnees.options.questionsAleatoires === true) || donnees.options.hasOwnProperty('itemsAleatoires') && donnees.options.itemsAleatoires === true)) {
							try {
								donnees = parseJSON(donneesInteraction.sessions, {})[session].donnees
							} catch (e) {
								console.error(e.message)
							}
						}
						reponsesSession[0].reponse.forEach((item, index) => {
							const question = donnees.questions[index]
							const reponseCorrecte = definirReponseCorrecte(question, item).reponseCorrecte
							let itemsCorrects = []
							if (donnees.options.reponses === true || donnees.options.reponses === 'oui') {
								itemsCorrects = definirReponseCorrecte(question, item).itemsCorrects
							} else if (donnees.options.reponses === 'utilisateur') {
								itemsCorrects = definirReponseCorrecte(question, item).itemsCorrects
								itemsCorrects = itemsCorrects.filter((element) => {
									return item.includes(element)
								})
							}
							let retroaction = ''
							if (donnees.options.retroaction === true && reponseCorrecte && question.hasOwnProperty('retroaction') && question.retroaction.correcte !== '') {
								retroaction = question.retroaction.correcte
							} else if (donnees.options.retroaction === true && !reponseCorrecte && question.hasOwnProperty('retroaction') && question.retroaction.incorrecte !== '') {
								retroaction = question.retroaction.incorrecte
							}
							donneesSession.push({ reponseCorrecte: reponseCorrecte, itemsCorrects: itemsCorrects, retroaction: retroaction })
						})
						scoreTotal = calculerScoreTotal(reponsesSession[0], donnees.options, donnees.questions)
					}
				} else {
					reponsesSession = reponses[session]
				}
				socket.emit('reponses', { code: reponse.code, session: reponse.session, reponsesSession: reponsesSession, donneesSession: donneesSession, scoreTotal: scoreTotal })
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				await sauvegarderSession(req)
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('modifiermessage', async (donnees) => {
			try {
				const code = parseInt(donnees.code)
				const session = parseInt(donnees.session)
				const id = donnees.id
				const texte = donnees.texte
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return socket.emit('erreurcode')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				let identifiantInteraction = ''
				if (donneesInteraction.hasOwnProperty('identifiant')) {
					identifiantInteraction = donneesInteraction.identifiant
				}
				if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return socket.emit('erreur')
				let reponses = parseJSON(donneesInteraction.reponses, {})
				if (!reponses[session]) return socket.emit('erreur')
				reponses[session].forEach((item) => {
					if (item.reponse.id === id) {
						item.reponse.texteoriginal = item.reponse.texte
						item.reponse.texte = texte
					}
				})
				await db.HSET('interactions:' + code, 'reponses', JSON.stringify(reponses))
				io.to(donnees.code).emit('reponses', { code: donnees.code, session: donnees.session, reponsesSession: reponses[session] })
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('supprimermessage', async (donnees) => {
			try {
				const code = parseInt(donnees.code)
				const session = parseInt(donnees.session)
				const id = donnees.id
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return socket.emit('erreurcode')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				let identifiantInteraction = ''
				if (donneesInteraction.hasOwnProperty('identifiant')) {
					identifiantInteraction = donneesInteraction.identifiant
				}
				if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return socket.emit('erreur')
				let reponses = parseJSON(donneesInteraction.reponses, {})
				if (!reponses[session]) return socket.emit('erreur')
				reponses[session].forEach((item) => {
					if (item.reponse.id === id) {
						item.reponse.visible = false
					}
				})
				await db.HSET('interactions:' + code, 'reponses', JSON.stringify(reponses))
				io.to(donnees.code).emit('reponses', { code: donnees.code, session: donnees.session, reponsesSession: reponses[session] })
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('reorganisermessages', async (donnees) => {
			try {
				const code = parseInt(donnees.code)
				const session = parseInt(donnees.session)
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return socket.emit('erreurcode')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				let identifiantInteraction = ''
				if (donneesInteraction.hasOwnProperty('identifiant')) {
					identifiantInteraction = donneesInteraction.identifiant
				}
				if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return socket.emit('erreur')
				let reponses = parseJSON(donneesInteraction.reponses, {})
				if (!reponses[session]) return socket.emit('erreur')
				reponses[session] = donnees.reponses
				await db.HSET('interactions:' + code, 'reponses', JSON.stringify(reponses))
				io.to(donnees.code).emit('reponses', { code: donnees.code, session: donnees.session, reponsesSession: reponses[session] })
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				await sauvegarderSession(req)
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('modifiercouleurmot', async (donnees) => {
			try {
				const code = parseInt(donnees.code)
				const session = parseInt(donnees.session)
				const mot = donnees.mot
				const couleur = donnees.couleur
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return socket.emit('erreurcode')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				let identifiantInteraction = ''
				if (donneesInteraction.hasOwnProperty('identifiant')) {
					identifiantInteraction = donneesInteraction.identifiant
				}
				if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return socket.emit('erreur')
				let reponses = parseJSON(donneesInteraction.reponses, {})
				if (!reponses[session]) return socket.emit('erreur')
				reponses[session].forEach((item) => {
					if (item.reponse.texte === mot) {
						item.reponse.couleur = couleur
					}
				})
				await db.HSET('interactions:' + code, 'reponses', JSON.stringify(reponses))
				socket.emit('modifiercouleurmot', { code: donnees.code, session: donnees.session, reponsesSession: reponses[session] })
				req.session.cookie.expires = new Date(Date.now() + dureeSession)
				await sauvegarderSession(req)
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('modifiermot', async (donnees) => {
			try {
				const code = parseInt(donnees.code)
				const session = parseInt(donnees.session)
				const mot = donnees.mot
				const nouveaumot = donnees.nouveaumot
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return socket.emit('erreurcode')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				let identifiantInteraction = ''
				if (donneesInteraction.hasOwnProperty('identifiant')) {
					identifiantInteraction = donneesInteraction.identifiant
				}
				if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return socket.emit('erreur')
				let reponses = parseJSON(donneesInteraction.reponses, {})
				if (!reponses[session]) return socket.emit('erreur')
				reponses[session].forEach((item) => {
					if (item.reponse.texte === mot) {
						item.reponse.texteoriginal = mot
						item.reponse.texte = nouveaumot
					}
				})
				await db.HSET('interactions:' + code, 'reponses', JSON.stringify(reponses))
				io.to(donnees.code).emit('reponses', { code: donnees.code, session: donnees.session, reponsesSession: reponses[session] })
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('modifiermots', async (donnees) => {
			try {
				const code = parseInt(donnees.code)
				const session = parseInt(donnees.session)
				const mots = donnees.mots
				const nouveaumot = donnees.nouveaumot
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return socket.emit('erreurcode')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				let identifiantInteraction = ''
				if (donneesInteraction.hasOwnProperty('identifiant')) {
					identifiantInteraction = donneesInteraction.identifiant
				}
				if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return socket.emit('erreur')
				let reponses = parseJSON(donneesInteraction.reponses, {})
				if (!reponses[session]) return socket.emit('erreur')
				reponses[session].forEach((item) => {
					if (mots.includes(item.reponse.texte) === true) {
						item.reponse.texteoriginal = item.reponse.texte
						item.reponse.texte = nouveaumot
					}
				})
				await db.HSET('interactions:' + code, 'reponses', JSON.stringify(reponses))
				socket.to(donnees.code).emit('reponses', { code: donnees.code, session: donnees.session, reponsesSession: reponses[session] })
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('supprimermot', async (donnees) => {
			try {
				const code = parseInt(donnees.code)
				const session = parseInt(donnees.session)
				const mot = donnees.mot
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return socket.emit('erreurcode')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				let identifiantInteraction = ''
				if (donneesInteraction.hasOwnProperty('identifiant')) {
					identifiantInteraction = donneesInteraction.identifiant
				}
				if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return socket.emit('erreur')
				let reponses = parseJSON(donneesInteraction.reponses, {})
				if (!reponses[session]) return socket.emit('erreur')
				reponses[session].forEach((item) => {
					if (item.reponse.texte === mot) {
						item.reponse.visible = false
					}
				})
				await db.HSET('interactions:' + code, 'reponses', JSON.stringify(reponses))
				io.to(donnees.code).emit('reponses', { code: donnees.code, session: donnees.session, reponsesSession: reponses[session] })
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('supprimermots', async (donnees) => {
			try {
				const code = parseInt(donnees.code)
				const session = parseInt(donnees.session)
				const mots = donnees.mots
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return socket.emit('erreurcode')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				let identifiantInteraction = ''
				if (donneesInteraction.hasOwnProperty('identifiant')) {
					identifiantInteraction = donneesInteraction.identifiant
				}
				if (await verifierAdmin(code, identifiantInteraction, req.session) === false) return socket.emit('erreur')
				let reponses = parseJSON(donneesInteraction.reponses, {})
				if (!reponses[session]) return socket.emit('erreur')
				reponses[session].forEach((item) => {
					if (mots.includes(item.reponse.texte) === true) {
						item.reponse.visible = false
					}
				})
				await db.HSET('interactions:' + code, 'reponses', JSON.stringify(reponses))
				socket.to(donnees.code).emit('reponses', { code: donnees.code, session: donnees.session, reponsesSession: reponses[session] })
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('recupererdonneesnuage', async (donnees) => {
			try {
				const code = parseInt(donnees.code)
				const session = parseInt(donnees.session)
				const interactionExiste = await db.EXISTS('interactions:' + code)
				if (interactionExiste !== 1) return socket.emit('erreurcode')
				let donneesInteraction = await db.HGETALL('interactions:' + code)
				donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
				let reponses = parseJSON(donneesInteraction.reponses, {})
				if (!reponses[session]) return socket.emit('erreur')
				socket.emit('nuageaffiche', reponses[session])
			} catch (err) {
				console.error(err.stack)
				socket.emit('erreur')
			}
		})

		socket.on('modifierlangue', async (langue) => {
			req.session.langue = langue
			await sauvegarderSession(req)
		})
	})

	async function verifierAcces (code, identifiant, motdepasse) {
		const interactionExiste = await db.EXISTS('interactions:' + code)
		if (interactionExiste !== 1) { return { acces: 'erreur', utilisateur: {} } }
		let donneesInteraction = await db.HGETALL('interactions:' + code)
		donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
		if (donneesInteraction.hasOwnProperty('motdepasse') && motdepasse !== '' && motdepasse === donneesInteraction.motdepasse) {
			if (!donneesInteraction.hasOwnProperty('digidrive') || parseInt(donneesInteraction.digidrive) === 0) {
				await db.HSET('interactions:' + code, 'digidrive', 1)
			}
			return { acces: 'interaction_debloquee', utilisateur: {} }
		} else if (identifiant === donneesInteraction.identifiant && donneesInteraction.hasOwnProperty('motdepasse') && donneesInteraction.motdepasse === '') {
			const utilisateurExiste = await db.EXISTS('utilisateurs:' + identifiant)
			if (utilisateurExiste !== 1) return { acces: 'erreur', utilisateur: {} }
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (motdepasse.trim() !== '' && donneesUtilisateur.hasOwnProperty('motdepasse') && donneesUtilisateur.motdepasse.trim() !== '' && await bcrypt.compare(motdepasse, donneesUtilisateur.motdepasse)) {
				if (!donneesInteraction.hasOwnProperty('digidrive') || parseInt(donneesInteraction.digidrive) === 0) {
					await db.HSET('interactions:' + code, 'digidrive', 1)
				}
				return { acces: 'interaction_debloquee', utilisateur: donneesUtilisateur }
			}
		}
		return { acces: 'erreur', utilisateur: {} }
	}

	function comparerHash (h1, h2) {
		if (!h1 || !h2 || h1.length !== h2.length) return false
		return timingSafeEqual(Buffer.from(h1), Buffer.from(h2))
	}

	function verifierMotDePasseAdmin (valeur) {
		const motdepasse = process.env.ADMIN_PASSWORD || ''
		if (!valeur || valeur.length !== motdepasse.length) return false
		return timingSafeEqual(Buffer.from(valeur), Buffer.from(motdepasse))
	}

	function creerMotDePasse () {
		let motdepasse = ''
		const lettres = 'ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz1234567890@!'
		for (let i = 0; i < 8; i++) {
			motdepasse += lettres.charAt(Math.floor(Math.random() * lettres.length))
		}
		return motdepasse
	}

	function formaterDate (date, mot, langue) {
		let dateFormattee = ''
		switch (langue) {
		case 'fr':
			dateFormattee = mot + ' le ' + date
			break
		case 'en':
			dateFormattee = mot + ' on ' + date
			break
		case 'es':
			dateFormattee = mot + ' el ' + date
			break
		case 'it':
			dateFormattee = mot + ' il ' + date
			break
		case 'de':
			dateFormattee = mot + ' am ' + date
			break
		}
		return dateFormattee
	}

	async function afficherSupportPrincipalPDF (doc, donnees, code, req, verifierFichierNonVide) {
		if (Object.keys(donnees.support).length > 0) {
			doc.fontSize(12)
			doc.font('Helvetica-Bold').text(t[req.session.langue].support, { underline: true })
			doc.moveDown()
			if (donnees.support.type === 'image' && (!verifierFichierNonVide || donnees.support.fichier !== '')) {
				let support = ''
				if (stockage === 'fs') {
					const cheminSupport = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + donnees.support.fichier)
					if (await fs.pathExists(cheminSupport)) {
						support = await fs.readFile(cheminSupport)
					}
				} else if (stockage === 's3') {
					support = await lireFichierS3(code + '/' + donnees.support.fichier)
				}
				if (support !== '' && support !== 'erreur' && magic.includes(support.toString('hex', 0, 4)) === true) {
					doc.image(support, { fit: [120, 120] })
				} else {
					doc.fontSize(10)
					doc.font('Helvetica').text(t[req.session.langue].image + ' ' + donnees.support.alt)
				}
			} else if (donnees.support.type === 'audio') {
				doc.fontSize(10)
				doc.font('Helvetica').text(t[req.session.langue].fichierAudio + ' ' + donnees.support.alt)
			} else if (donnees.support.type === 'video') {
				doc.fontSize(10)
				doc.font('Helvetica').text(t[req.session.langue].video, {
					link: donnees.support.lien,
					underline: true
				})
			}
		}
	}

	async function afficherSupportQuestionPDF (doc, question, code, req) {
		if (Object.keys(question.support).length > 0 && question.support.hasOwnProperty('image') && question.support.image !== '') {
			doc.moveDown()
			let support = ''
			if (stockage === 'fs') {
				const cheminSupport = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + question.support.image)
				if (await fs.pathExists(cheminSupport)) {
					support = await fs.readFile(cheminSupport)
				}
			} else if (stockage === 's3') {
				support = await lireFichierS3(code + '/' + question.support.image)
			}
			if (support !== '' && support !== 'erreur' && magic.includes(support.toString('hex', 0, 4)) === true) {
				doc.image(support, { fit: [120, 120] })
			}
		} else if (Object.keys(question.support).length > 0 && question.support.hasOwnProperty('audio') && question.support.audio !== '') {
			doc.moveDown()
			doc.font('Helvetica').text(t[req.session.langue].fichierAudio + ' ' + question.support.audio)
		}
	}

	function definirReponseCorrecte (question, reponse) {
		const itemsCorrects = []
		const bonnesReponses = []
		const mauvaisesReponses = []
		if (question.option !== 'texte-court') {
			question.items.forEach((item) => {
				if (item.reponse === true && item.texte !== '') {
					itemsCorrects.push(item.texte)
				} else if (item.reponse === true && item.image && item.image !== '') {
					itemsCorrects.push(item.image)
				} else if (item.reponse === true && item.audio && item.audio !== '') {
					itemsCorrects.push(item.audio)
				}
			})
			question.items.forEach((item) => {
				if (item.reponse === true && (reponse.includes(item.texte) || (item.hasOwnProperty('image') && reponse.includes(item.image)) || (item.hasOwnProperty('audio') && reponse.includes(item.audio)))) {
					bonnesReponses.push(item)
				} else if (item.reponse === false && (reponse.includes(item.texte) || (item.hasOwnProperty('image') && reponse.includes(item.image)) || (item.hasOwnProperty('audio') && reponse.includes(item.audio)))) {
					mauvaisesReponses.push(item)
				}
			})
		} else {
			const reponsesTexte = question.reponses.split('|')
			reponsesTexte.forEach((item, index) => {
				reponsesTexte[index] = item.trim()
			})
			itemsCorrects.push(...reponsesTexte)
		}
		if ((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && itemsCorrects.every(i => reponse.includes(i)) === true && mauvaisesReponses.length === 0) || (question.option === 'texte-court' && itemsCorrects.includes(reponse.toString().trim()) === true && mauvaisesReponses.length === 0)) {
			return { reponseCorrecte: true, itemsCorrects: itemsCorrects }
		} else {
			return { reponseCorrecte: false, itemsCorrects: itemsCorrects }
		}
	}

	function calculerScoreTotal (reponsesSession, options, questions) {
		let score = 0
		let scoreTemps = []
		let temps = []
		const reponses = reponsesSession.reponse
		if (reponsesSession.hasOwnProperty('score') && options.points !== 'classique') {
			scoreTemps = reponsesSession.score
		}
		if (reponsesSession.hasOwnProperty('temps') && options.points !== 'classique') {
			temps = reponsesSession.temps
		}
		if (scoreTemps.length > 0) {
			scoreTemps.forEach((points) => {
				score = score + points
			})
		} else if (reponses.length > 0) {
			questions.forEach((question, indexQuestion) => {
				if (reponses[indexQuestion]) {
					const reponseCorrecte = []
					const bonnesReponses = []
					const mauvaisesReponses = []
					if (question.option !== 'texte-court') {
						question.items.forEach((item) => {
							if (item.reponse === true && item.texte !== '') {
								reponseCorrecte.push(item.texte)
							} else if (item.reponse === true && item.image && item.image !== '') {
								reponseCorrecte.push(item.image)
							} else if (item.reponse === true && item.audio && item.audio !== '') {
								reponseCorrecte.push(item.audio)
							}
						})
						question.items.forEach((item) => {
							if (item.reponse === true && (reponses[indexQuestion].includes(item.texte) || (item.hasOwnProperty('image') && reponses[indexQuestion].includes(item.image)) || (item.hasOwnProperty('audio') && reponses[indexQuestion].includes(item.audio)))) {
								bonnesReponses.push(item)
							} else if (item.reponse === false && (reponses[indexQuestion].includes(item.texte) || (item.hasOwnProperty('image') && reponses[indexQuestion].includes(item.image)) || (item.hasOwnProperty('audio') && reponses[indexQuestion].includes(item.audio)))) {
								mauvaisesReponses.push(item)
							}
						})
					} else {
						const reponsesTexte = question.reponses.split('|')
						reponsesTexte.forEach((item, index) => {
							reponsesTexte[index] = item.trim()
						})
						if (reponsesTexte.includes(reponses[indexQuestion].toString().trim()) === true) {
							bonnesReponses.push(reponses[indexQuestion].toString())
						}
						reponseCorrecte.push(question.reponses)
					}
					let multiplicateurSecondes = 10
					if (options.hasOwnProperty('multiplicateur') && options.multiplicateur > 0) {
						multiplicateurSecondes = options.multiplicateur
					}
					if (((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => reponses[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)) && options.points === 'classique' && question.hasOwnProperty('points')) {
						score = score + question.points
					} else if (((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => reponses[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)) && options.points === 'classique' && !question.hasOwnProperty('points')) {
						score = score + 1000
					} else if (((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => reponses[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)) && options.points !== 'classique' && question.hasOwnProperty('points')) {
						score = score + Math.round(question.points - (temps[indexQuestion] * multiplicateurSecondes))
					} else if (((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => reponses[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)) && options.points !== 'classique' && !question.hasOwnProperty('points')) {
						score = score + Math.round(1000 - (temps[indexQuestion] * multiplicateurSecondes))
					} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0 && options.points === 'classique' && question.hasOwnProperty('points')) {
						score = score + ((question.points / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
					} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0 && options.points === 'classique' && !question.hasOwnProperty('points')) {
						score = score + ((1000 / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
					} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0 && options.points !== 'classique' && question.hasOwnProperty('points')) {
						score = score + ((Math.round(question.points - (temps[indexQuestion] * multiplicateurSecondes)) / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
					} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0 && options.points !== 'classique' && !question.hasOwnProperty('points')) {
						score = score + ((Math.round(1000 - (temps[indexQuestion] * multiplicateurSecondes)) / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
					} else {
						score = score + 0
					}
				}
			})
		}
		return score
	}

	function definirMessagesRemueMeninges (categories, reponses, bannis) {
		const messagesVisibles = []
		const messagesSupprimes = []
		for (let i = 0; i < categories.length; i++) {
			messagesVisibles.push([])
			messagesSupprimes.push([])
		}
		if (messagesVisibles.length > 0) {
			reponses.forEach((item) => {
				let index = -1
				categories.forEach((categorie, indexCategorie) => {
					if (item.reponse.categorie === categorie.texte || item.reponse.categorie === categorie.image) {
						index = indexCategorie
					}
				})
				if (!bannis.includes(item.identifiant) && item.reponse.visible && index > -1) {
					messagesVisibles[index].push(item)
				} else if (index > -1) {
					messagesSupprimes[index].push(item)
				}
			})
		} else {
			reponses.forEach((item) => {
				if (!bannis.includes(item.identifiant) && item.reponse.visible) {
					messagesVisibles.push(item)
				} else {
					messagesSupprimes.push(item)
				}
			})
		}
		return { visibles: messagesVisibles, supprimes: messagesSupprimes }
	}

	function definirMotsNuageDeMots (reponses, bannis) {
		const messagesVisibles = []
		const messagesSupprimes = []
		reponses.forEach((item) => {
			if (!bannis.includes(item.identifiant) && item.reponse.visible) {
				messagesVisibles.push(item)
			} else {
				messagesSupprimes.push(item)
			}
		})
		return { visibles: messagesVisibles, supprimes: messagesSupprimes }
	}

	function definirStatistiquesQuestions (questions, reponses, bannis) {
		const statistiques = []
		questions.forEach((question, indexQuestion) => {
			const personnes = []
			const pourcentages = []
			if (question.hasOwnProperty('option') && (question.option === 'choix-unique' || question.option === 'choix-multiples') && question.hasOwnProperty('items')) {
				for (let i = 0; i < question.items.length; i++) {
					personnes.push(0)
					pourcentages.push(0)
				}
				question.items.forEach((item, index) => {
					let total = 0
					let nombreReponses = 0
					reponses.forEach((donnees) => {
						if (!bannis.includes(donnees.identifiant)) {
							donnees.reponse[indexQuestion].forEach((reponse) => {
								if (reponse === item.texte || (item.hasOwnProperty('image') && reponse === item.image) || (item.hasOwnProperty('audio') && reponse === item.audio)) {
									nombreReponses++
								}
							})
							total++
						}
					})
					if (nombreReponses > 0) {
						personnes[index] = nombreReponses
						const pourcentage = (nombreReponses / total) * 100
						pourcentages[index] = Math.round(pourcentage)
					}
				})
			} else if (question.hasOwnProperty('option') && question.option === 'texte-court') {
				let items = []
				reponses.forEach((donnees) => {
					donnees.reponse[indexQuestion].forEach((reponse) => {
						if (!bannis.includes(donnees.identifiant) && !items.includes(reponse.toString().trim())) {
							items.push(reponse.toString().trim())
						}
					})
				})
				for (let i = 0; i < items.length; i++) {
					personnes.push(0)
					pourcentages.push(0)
				}
				items.forEach((item, index) => {
					let total = 0
					let nombreReponses = 0
					reponses.forEach((donnees) => {
						if (!bannis.includes(donnees.identifiant)) {
							donnees.reponse[indexQuestion].forEach((reponse) => {
								if (item === reponse.toString().trim()) {
									nombreReponses++
								}
								total++
							})
						}
					})
					if (nombreReponses > 0) {
						personnes[index] = nombreReponses
						const pourcentage = (nombreReponses / total) * 100
						pourcentages[index] = Math.round(pourcentage)
					}
				})
			} else if (question.hasOwnProperty('option') && question.option === 'etoiles') {
				for (let i = 0; i < question.etoiles; i++) {
					personnes.push(0)
					pourcentages.push(0)
					let total = 0
					let nombreReponses = 0
					reponses.forEach((donnees) => {
						if (!bannis.includes(donnees.identifiant)) {
							donnees.reponse[indexQuestion].forEach((reponse) => {
								if (reponse === (i + 1)) {
									nombreReponses++
								}
								total++
							})
						}
					})
					if (nombreReponses > 0) {
						personnes[i] = nombreReponses
						const pourcentage = (nombreReponses / total) * 100
						pourcentages[i] = Math.round(pourcentage)
					}
				}
			}
			statistiques.push({ personnes: personnes, pourcentages: pourcentages })
		})
		return statistiques
	}

	function definirReponses (reponses, indexQuestion, bannis) {
		let total = 0
		reponses.forEach((item) => {
			if (!bannis.includes(item.identifiant) && item.hasOwnProperty('reponse') && item.reponse[indexQuestion].length > 0) {
				total++
			}
		})
		return total
	}

	function genererMotDePasse (longueur) {
		const randCrypto = (max) => randomBytes(4).readUInt32LE(0) % max
		const verifierMotDePasse = (motdepasse, regex, caracteres) => {
			if (!regex.test(motdepasse)) {
				const nouveauCaractere = caracteres.charAt(randCrypto(caracteres.length))
				const position = randCrypto(motdepasse.length + 1)
				motdepasse = motdepasse.slice(0, position) + nouveauCaractere + motdepasse.slice(position)
			}
			return motdepasse
		}
		const listeCaracteres = '123456789abcdefghijklmnopqrstuvwxyz'
		const caracteresSpeciaux = '!#$@*'
		const specialRegex = /[!#\$@*]/
		const majuscules = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
		const majusculesRegex = /[A-Z]/

		const caracteres = listeCaracteres.split('')
		let motdepasse = ''
		let index

		while (motdepasse.length < longueur) {
			index = randCrypto(caracteres.length)
			motdepasse += caracteres[index]
			caracteres.splice(index, 1)
		}
		motdepasse = verifierMotDePasse(motdepasse, specialRegex, caracteresSpeciaux)
		motdepasse = verifierMotDePasse(motdepasse, majusculesRegex, majuscules)
		return motdepasse
	}

	function verifierEmail (email) {
		const regexExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/gi
		return regexExp.test(email)
	}

	function melanger (array) {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1))
			const temp = array[i]
			array[i] = array[j]
			array[j] = temp
		}
		return array
	}

	function sauvegarderSession (req) {
		return new Promise((resolve, reject) => {
			req.session.save((err) => {
				if (err) reject(err)
				else resolve()
			})
		})
	}

	function supprimerSession (req) {
		if (req.hasOwnProperty('session')) {
			req.session.identifiant = ''
			req.session.motdepasse = ''
			req.session.nom = ''
			req.session.email = ''
			req.session.langue = ''
			req.session.role = ''
			req.session.interactions = []
			req.session.destroy()
		}
	}

	async function verifierAdmin (code, identifiant, session) {
		if (session.hasOwnProperty('identifiant') && session.hasOwnProperty('role') && session.role === 'utilisateur' && session.hasOwnProperty('motdepasse')) {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + session.identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (!donneesUtilisateur.hasOwnProperty('motdepasse')) return false
			return identifiant === session.identifiant && comparerHash(session.motdepasse, donneesUtilisateur.motdepasse)
		} else if (session.hasOwnProperty('role') && session.role === 'auteur' && session.hasOwnProperty('interactions') && session.interactions.map(item => item.code).includes(parseInt(code))) {
			return true
		}
		return false
	}

	function verifierHoteBloque (hote) {
		let h = hote.toLowerCase().trim()
		if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1)
		const bloques = ['0.0.0.0', '::', '::1', '::ffff:127.0.0.1', '0:0:0:0:0:0:0:1', '169.254.169.254']
		if (production) {
			bloques.push('localhost', '127.0.0.1')
		}
		if (bloques.includes(h)) return true
		// Plages IPv4 privées
		if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return true
		// IPv4-mapped IPv6 vers plages privées, notation décimale pointée (::ffff:10.x, ::ffff:127.x, ::ffff:169.254.x, ::ffff:192.168.x, ::ffff:172.16-31.x)
		if (/^::ffff:(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return true
		// IPv4-mapped IPv6 vers plages privées, notation hexadécimale compressée (ex : ::ffff:7f00:1 pour 127.0.0.1)
		const correspondanceHex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
		if (correspondanceHex) {
			const valeur = (parseInt(correspondanceHex[1], 16) << 16) + parseInt(correspondanceHex[2], 16)
			const octet1 = (valeur >>> 24) & 0xff
			const octet2 = (valeur >>> 16) & 0xff
			if (octet1 === 127 || octet1 === 10 || octet1 === 169 && octet2 === 254 || octet1 === 192 && octet2 === 168 || (octet1 === 172 && octet2 >= 16 && octet2 <= 31)) return true
		}
		// IPv6 link-local (fe80::/10) et unique-local (fc00::/7)
		if (/^(fe[89ab][0-9a-f]|f[cd][0-9a-f]{2}):/i.test(h)) return true
		return false
	}

	function verifierURL (s, protocoles) {
		try {
			const url = new URL(s)
			const liste = (Array.isArray(protocoles) && protocoles.length > 0) ? protocoles : ['https', 'http']
			return liste.map(x => `${x.toLowerCase()}:`).includes(url.protocol)
		} catch {
			return false
		}
	}

	function parseJSON (str, fallback) {
		try {
			return JSON.parse(str)
		} catch (e) {
			return fallback
		}
	}

	function definirParametresTeleverserS3 (cle, buffer) {
		return { Bucket: bucket, Key: cle.toString(), Body: buffer, ACL: 'public-read' }
	}

	function definirParametresCopierS3 (cle, source) {
		return { Bucket: bucket, Key: cle.toString(), CopySource: source.toString(), ACL: 'public-read' }
	}

	function definirParametresSupprimerS3 (cle) {
		return { Bucket: bucket, Key: cle.toString() }
	}

	async function lireFichierS3 (cle) {
		try {
			const donnees = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: cle.toString() }))
			const buffers = []
			for await (const buffer of donnees.Body) buffers.push(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer))
			return Buffer.concat(buffers)
		} catch (e) {
			return 'erreur'
		}
	}

	async function telechargerFichierS3 (cle, fichier) {
		try {
			const donnees = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: cle.toString() }))
			const writeStream = fs.createWriteStream(fichier)
			await pipeline(donnees.Body, writeStream)
		} catch {
			await fs.remove(fichier)
		}
	}

	function definirFichiersInteraction (type, donnees) {
		const fichiers = []
		if (Object.keys(donnees.support).length > 0) {
			if (donnees.support.hasOwnProperty('fichier') && donnees.support.fichier !== '') {
				fichiers.push(donnees.support.fichier)
			} else if (donnees.support.hasOwnProperty('image') && donnees.support.image !== '') {
				fichiers.push(donnees.support.image)
			}
		}
		if (type === 'Sondage' || type === 'Questionnaire') {
			donnees.questions.forEach((q) => {
				if (Object.keys(q.support).length > 0) {
					if (q.support.hasOwnProperty('fichier') && q.support.fichier !== '') {
						fichiers.push(q.support.fichier)
					} else if (q.support.hasOwnProperty('image') && q.support.image !== '') {
						fichiers.push(q.support.image)
					} else if (q.support.hasOwnProperty('audio') && q.support.audio !== '') {
						fichiers.push(q.support.audio)
					}
				}
				if (q.hasOwnProperty('items')) {
					q.items.forEach((item) => {
						if (item.hasOwnProperty('image') && item.image !== '') {
							fichiers.push(item.image)
						}
						if (item.hasOwnProperty('audio') && item.audio !== '') {
							fichiers.push(item.audio)
						}
					})
				}
			})
		} else if (type === 'Remue-méninges') {
			donnees.categories.forEach((categorie) => {
				if (categorie.image !== '') {
					fichiers.push(categorie.image)
				}
			})
		}
		return fichiers
	}

	function definirListeFichiers (type, donnees) {
		const fichiers = []
		if (Object.keys(donnees.support).length > 0) {
			if (donnees.support.hasOwnProperty('fichier')) {
				fichiers.push(donnees.support.fichier)
			} else if (donnees.support.hasOwnProperty('image')) {
				fichiers.push(donnees.support.image)
			}
		}
		if (type === 'Sondage' || type === 'Questionnaire') {
			donnees.questions.forEach((q) => {
				if (Object.keys(q.support).length > 0) {
					if (q.support.hasOwnProperty('fichier')) {
						fichiers.push(q.support.fichier)
					} else if (q.support.hasOwnProperty('image')) {
						fichiers.push(q.support.image)
					} else if (q.support.hasOwnProperty('audio')) {
						fichiers.push(q.support.audio)
					}
				}
				if (q.hasOwnProperty('items')) {
					q.items.forEach((item) => {
						if (item.hasOwnProperty('image') && item.image !== '') {
							fichiers.push(item.image)
						}
						if (item.hasOwnProperty('audio') && item.audio !== '') {
							fichiers.push(item.audio)
						}
					})
				}
			})
		} else if (type === 'Remue-méninges') {
			donnees.categories.forEach((categorie) => {
				if (categorie.image !== '') {
					fichiers.push(categorie.image)
				}
			})
		}
		return fichiers
	}

	async function copierFichierExport (sourceInfo, destination) {
		try {
			if (stockage === 'fs') {
				const fichierExiste = await fs.pathExists(sourceInfo.chemin)
				if (fichierExiste) {
					await fs.copy(sourceInfo.chemin, destination, { overwrite: true })
					return true
				}
			} else if (stockage === 's3') {
				try {
					const fichierMeta = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: sourceInfo.cleS3 }))
					if (fichierMeta && fichierMeta.hasOwnProperty('ContentLength')) {
						await telechargerFichierS3(sourceInfo.cleS3, destination)
						return true
					}
				} catch {}
			}
		} catch (err) {
			console.error(err.stack)
		}
		return false
	}

	async function extraireArchive (source, dir) {
		const zip = new AdmZip(source)
		await new Promise((resolve, reject) => {
			zip.extractAllToAsync(dir, true, false, (err) => {
				if (err) return reject(err)
				resolve()
			})
		})
	}

	async function supprimerArchives (source, cible) {
		try {
			await Promise.all([
				fs.remove(source),
				fs.remove(cible)
			])
		} catch (err) {
			console.error(err.stack)
		}
	}

	async function televerserFichierArchive (dossierTemporaire, dossierDestination, nomFichier, code) {
		if (!nomFichier || nomFichier === '') return
		const cheminSource = path.normalize(dossierTemporaire + '/fichiers/' + nomFichier)
		if (!await fs.pathExists(cheminSource)) return
		if (stockage === 'fs') {
			await fs.copy(cheminSource, path.normalize(dossierDestination + '/' + nomFichier), { overwrite: true })
		} else if (stockage === 's3') {
			const buffer = await fs.readFile(cheminSource)
			await s3Client.send(new PutObjectCommand(definirParametresTeleverserS3(code + '/' + nomFichier, buffer)))
		}
	}

	function definirNomFichier (fichier) {
		const info = path.parse(fichier)
		const extension = info.ext.toLowerCase()
		let nom = v.latinise(info.name.toLowerCase())
		nom = nom.replace(/\ /gi, '-')
		nom = nom.replace(/[^0-9a-z_\-]/gi, '')
		if (nom.length > 100) {
			nom = nom.substring(0, 100)
		}
		nom = nom + '_' + Math.random().toString(36).substring(2) + extension
		return nom
	}

	const televerserArchive = multer({
		limits: { fileSize: 200 * 1024 * 1024 },
		storage: multer.diskStorage({
			destination: (req, fichier, callback) => {
				const chemin = path.join(__dirname, '..', '/static/temp/')
				callback(null, chemin)
			},
			filename: (req, fichier, callback) => {
				const nom = definirNomFichier(fichier.originalname)
				callback(null, nom)
			}
		})
	}).single('fichier')

	async function recupererListeInteractions (cle) {
		const interactions = await db.SMEMBERS(cle)
		if (!interactions || interactions.length === 0) { return [] }
		return Promise.all(interactions.map(async (interaction) => {
			let donneesInteraction = await db.HGETALL('interactions:' + interaction)
			donneesInteraction = donneesInteraction ? { ...donneesInteraction } : {}
			return donneesInteraction
		}))
	}

	async function recupererDonnees (identifiant) {
		const [interactionsCreees, interactionsSupprimees, favoris] = await Promise.all([
			recupererListeInteractions('interactions-creees:' + identifiant),
			recupererListeInteractions('interactions-supprimees:' + identifiant),
			recupererListeInteractions('favoris:' + identifiant)
		])
		let filtre = 'date-desc'
		if (await db.EXISTS('utilisateurs:' + identifiant) === 1) {
			let donneesUtilisateur = await db.HGETALL('utilisateurs:' + identifiant)
			donneesUtilisateur = donneesUtilisateur ? { ...donneesUtilisateur } : {}
			if (donneesUtilisateur.hasOwnProperty('filtre')) {
				filtre = donneesUtilisateur.filtre
			}
		}
		return [interactionsCreees, interactionsSupprimees, favoris, filtre]
	}

	async function supprimerFichier (code, fichier) {
		if (!fichier || typeof fichier !== 'string' || fichier === '' || /[/\\]/.test(fichier) || fichier.includes('..')) return
		if (stockage === 'fs') {
			const chemin = path.join(__dirname, '..', '/static/fichiers/' + code.toString() + '/' + fichier)
			await fs.remove(chemin)
		} else if (stockage === 's3') {
			await s3Client.send(new DeleteObjectCommand(definirParametresSupprimerS3(code + '/' + fichier)))
		}
	}
}
