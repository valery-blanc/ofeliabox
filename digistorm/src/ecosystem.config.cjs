module.exports = {
	apps: [{
		name: 'Digistorm',
		script: './server/app.js',
		autorestart: true,
		max_restarts: 10,
		env: {
			'NODE_ENV': 'development'
		},
		env_production: {
			'NODE_ENV': 'production'
		}
	}]
}
