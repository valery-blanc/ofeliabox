<template>
	<div id="page">
		<div id="interaction" v-if="admin && (statut === '' || statut === 'termine')">
			<header>
				<div id="conteneur-header">
					<a id="logo" :href="hote" />

					<div id="titre" class="edition" :class="{'utilisateur': role === 'utilisateur'}" v-if="!viaDigidrive">
						<span class="titre" :tabindex="tabIndex" :aria-disabled="disabled" @click="afficherModaleTitre" @keydown.enter="afficherModaleTitre">{{ titre }}</span>
						<button type="button" class="modifier" :disabled="disabled" :title="$t('modifierTitre')" :aria-label="$t('modifierTitre')" @click="afficherModaleTitre"><i class="material-icons" aria-hidden="true">edit</i></button>
					</div>
					<div id="titre" :class="{'utilisateur': role === 'utilisateur'}" v-else>
						<span class="titre">{{ titre }}</span>
					</div>

					<div id="parametres">
						<a class="compte" :title="$t('monCompte')" :aria-label="$t('monCompte')" :href="'/u/' + identifiant" v-if="role === 'utilisateur'"><i class="material-icons" aria-hidden="true">account_circle</i></a>
						<button type="button" class="parametres" :disabled="disabled" :title="$t('afficherParametres')" :aria-label="$t('afficherParametres')" @click="afficherModaleParametres"><i class="material-icons" aria-hidden="true">settings</i></button>
						<button type="button" class="deconnexion" :disabled="disabled" :title="$t('seDeconnecter')" :aria-label="$t('seDeconnecter')" @click="seDeconnecter"><i class="material-icons" aria-hidden="true">power_settings_new</i></button>
					</div>
				</div>
			</header>

			<div id="conteneur" class="ascenseur">
				<div class="section">
					<div class="informations">
						<div class="code" :class="{'seul': role === 'utilisateur'}">
							<span>{{ $t('codeParticipants') }}:</span>
							<span class="information">{{ code }}</span>
							<button type="button" id="copier" class="icone" :disabled="disabled" :title="$t('copierLien')" :aria-label="$t('copierLien')"><i class="material-icons" aria-hidden="true">content_copy</i></button>
							<button type="button" id="afficher" class="icone" :disabled="disabled" :title="$t('afficherCodeQR')" :aria-label="$t('afficherCodeQR')" @click="afficherCodeQR"><i class="material-icons" aria-hidden="true">qr_code</i></button>
						</div>
						<div class="motdepasse" v-if="role === 'auteur' && motdepasse !== '' && !viaDigidrive">
							<span>{{ $t('motDePasseAdministration') }}:</span>
							<span class="information" v-if="visible">{{ motdepasse }}</span>
							<span class="information" v-else-if="!visible">
								<template v-for="caractere in motdepasse" :key="'caractere_' + caractere">*</template>
							</span>
							<button type="button" class="icone" :disabled="disabled" :title="visible ? $t('cacherMotDePasse') : $t('afficherMotDePasse')" :aria-label="visible ? $t('cacherMotDePasse') : $t('afficherMotDePasse')" @click="visible = !visible">
								<i class="material-icons" aria-hidden="true" v-if="visible">visibility</i>
								<i class="material-icons" aria-hidden="true" v-else>visibility_off</i>
							</button>
						</div>
					</div>
					<div class="telecharger" v-if="role === 'auteur' && motdepasse !== '' && !viaDigidrive">
						<button type="button" :disabled="disabled" @click="telecharger">{{ $t('telechargerCodeEtMotDePasse') }}</button>
					</div>
				</div>

				<SondageCreer :hote="hote" :code="code" :donnees="donnees" :statut="statut" :enregistrement="enregistrement" @enregistrement="enregistrerDonnees" @modale="modifierModaleComposant" v-if="type === 'Sondage'" />

				<QuestionnaireCreer :hote="hote" :code="code" :donnees="donnees" :statut="statut" :enregistrement="enregistrement" @enregistrement="enregistrerDonnees" @modale="modifierModaleComposant" v-else-if="type === 'Questionnaire'" />

				<RemueMeningesCreer :hote="hote" :code="code" :donnees="donnees" :enregistrement="enregistrement" @enregistrement="enregistrerDonnees" @modale="modifierModaleComposant" v-else-if="type === 'Remue-méninges'" />

				<NuageMotsCreer :hote="hote" :code="code" :donnees="donnees" :enregistrement="enregistrement" @enregistrement="enregistrerDonnees" @modale="modifierModaleComposant" v-else-if="type === 'Nuage-de-mots'" />
			</div>

			<footer>
				<div class="section">
					<div class="gauche">
						<button type="button" class="bouton mobile" :disabled="disabled" :title="$t('afficherResultats')" :aria-label="$t('afficherResultats')" @click="afficherModaleResultats" v-if="definirNombreReponses() > 0"><i class="material-icons" aria-hidden="true">equalizer</i><span>{{ $t('resultats') }}</span></button>
					</div>
					<div class="droite">
						<button type="button" class="bouton mobile" :disabled="disabled" @click="enregistrer('enregistrement')"><i class="material-icons" aria-hidden="true">save</i><span>{{ $t('enregistrer') }}</span></button>
						<button type="button" class="bouton" :disabled="disabled" @click="enregistrer('lancement')">{{ $t('lancer') }}</button>
					</div>
				</div>
			</footer>
		</div>

		<div id="interaction" v-else-if="admin">
			<header>
				<div id="conteneur-header">
					<a id="logo" :href="hote" />

					<div id="titre" :class="{'utilisateur': role === 'utilisateur'}">
						<span class="code">{{ code }}</span>
						<button type="button" id="copier" class="icone" :disabled="disabled" :title="$t('copierLien')" :aria-label="$t('copierLien')"><i class="material-icons" aria-hidden="true">content_copy</i></button>
						<button type="button" id="afficher" class="icone" :disabled="disabled" :title="$t('afficherCodeQR')" :aria-label="$t('afficherCodeQR')" @click="afficherCodeQR"><i class="material-icons" aria-hidden="true">qr_code</i></button>
						<button type="button" id="exporter-pdf" class="icone" :disabled="disabled" :title="$t('exporterResultats')" :aria-label="$t('exporterResultats')" @click="exporterResultat('')" v-if="reponsesSession.length > 0"><i class="material-icons" aria-hidden="true">get_app</i></button>
						<button type="button" id="exporter-csv" class="icone" :disabled="disabled" :title="$t('exporterResultatsIndividuels')" :aria-label="$t('exporterResultatsIndividuels')" @click="exporterResultatIndividuel('')" v-if="reponsesSession.length > 0"><i class="material-icons" aria-hidden="true">assignment_ind</i></button>
					</div>

					<div id="parametres">
						<a class="compte" :title="$t('monCompte')" :aria-label="$t('monCompte')" :href="'/u/' + identifiant" v-if="role === 'utilisateur'"><i class="material-icons" aria-hidden="true">account_circle</i></a>
						<button type="button" class="parametres" :disabled="disabled" :title="$t('afficherParametres')" :aria-label="$t('afficherParametres')" @click="afficherModaleParametres"><i class="material-icons" aria-hidden="true">settings</i></button>
						<button type="button" class="deconnexion" :disabled="disabled" :title="$t('seDeconnecter')" :aria-label="$t('seDeconnecter')" @click="seDeconnecter"><i class="material-icons" aria-hidden="true">power_settings_new</i></button>
					</div>
				</div>
			</header>

			<div id="conteneur" class="interaction-ouverte">
				<SondageAfficher :code="code" :donnees="donnees" :donneesSession="donneesSession" :reponses="reponsesSession" :statut="statut" :resultats="resultats" :utilisateursConnectes="utilisateursConnectes" :utilisateursBannis="utilisateursBannis" :bannis="bannis" :classement-resultats="classementResultats" :index-question="indexQuestion" @demarrer="demarrer" @index="modifierIndexQuestion" @modale="modifierModaleComposant" v-if="type === 'Sondage'" />

				<QuestionnaireAfficher :code="code" :donnees="donnees" :donneesSession="donneesSession" :reponses="reponsesSession" :statut="statut" :resultats="resultats" :utilisateursConnectes="utilisateursConnectes" :utilisateursBannis="utilisateursBannis" :bannis="bannis" :classement="classement" :index-question="indexQuestion" :reponse-visible="reponseVisible" :date="date" @demarrer="demarrer" @index="modifierIndexQuestion" @classement="afficherClassementCollectif" @tableau-resultats="modifierTableauResultats" @modale="modifierModaleComposant" @reponseVisible="afficherReponse" v-else-if="type === 'Questionnaire'" />

				<RemueMeningesAfficher :code="code" :donnees="donnees" :reponses="reponsesSession" :session="session" :bannis="bannis" @modale="modifierModaleComposant" v-else-if="type === 'Remue-méninges'" />

				<NuageMotsAfficher :code="code" :donnees="donnees" :reponses="reponsesSession" :session="session" :bannis="bannis" @modale="modifierModaleComposant" v-else-if="type === 'Nuage-de-mots'" />
			</div>

			<footer>
				<div class="section">
					<button type="button" class="utilisateurs" :disabled="disabled" :title="$t('afficherListeParticipants')" :aria-label="$t('afficherListeParticipants')" @click="afficherModaleUtilisateurs" v-if="((type === 'Sondage' || type === 'Questionnaire') && donnees.options.progression === 'animateur' && ((donnees.options.nom ==='obligatoire' && statut !== 'attente') || donnees.options.nom !=='obligatoire')) || (type !== 'Sondage' && type !== 'Questionnaire')">{{ utilisateursConnectes.length }} <i class="material-icons" aria-hidden="true">people</i></button>
					<span class="utilisateurs" v-else>{{ utilisateursConnectes.length }} <i class="material-icons" aria-hidden="true">people</i></span>

					<button type="button" class="bouton icone" :disabled="disabled" :title="$t('afficherReponse')" :aria-label="$t('afficherReponse')" @click="reponseVisible = !reponseVisible" v-if="type === 'Questionnaire' && donnees.options.progression === 'animateur' && statut === 'ouvert' && indexQuestion > -1 && !reponseVisible && !tableauResultats"><i class="material-icons" aria-hidden="true">unpublished</i></button>
					<button type="button" class="bouton icone affiche" :disabled="disabled" :title="$t('masquerReponse')" :aria-label="$t('masquerReponse')" @click="reponseVisible = !reponseVisible" v-else-if="type === 'Questionnaire' && donnees.options.progression === 'animateur' && statut === 'ouvert' && indexQuestion > -1 && reponseVisible && !tableauResultats"><i class="material-icons" aria-hidden="true">check_circle</i></button>

					<button type="button" class="bouton icone masque" :disabled="disabled" :title="$t('afficherResultats')" :aria-label="$t('afficherResultats')" @click="afficherResultats" v-if="(type === 'Sondage' || type === 'Questionnaire' && donnees.options.progression === 'animateur') && !resultats && !tableauResultats && indexQuestion > -1"><i class="material-icons" aria-hidden="true">visibility_off</i></button>
					<button type="button" class="bouton icone" :disabled="disabled" :title="$t('masquerResultats')" :aria-label="$t('masquerResultats')" @click="masquerResultats" v-else-if="(type === 'Sondage' || (type === 'Questionnaire' && donnees.options.progression === 'animateur' && statut !== 'attente')) && resultats && !tableauResultats && indexQuestion > -1"><i class="material-icons" aria-hidden="true">visibility</i></button>

					<button type="button" class="bouton icone" :disabled="disabled" :title="$t('trierResultats')" :aria-label="$t('trierResultats')" @click="classerResultats(true)" v-if="type === 'Sondage' && resultats && !classementResultats && indexQuestion > -1"><i class="material-icons" aria-hidden="true">equalizer</i></button>

					<button type="button" class="bouton icone masque" :disabled="disabled" :title="$t('masquerResultatsTries')" :aria-label="$t('masquerResultatsTries')" @click="classerResultats(false)" v-else-if="type === 'Sondage' && resultats && classementResultats && indexQuestion > -1"><i class="material-icons" aria-hidden="true">equalizer</i></button>

					<button type="button" class="bouton icone verrouille" :disabled="disabled" :title="$t('deverrouillerInteraction')" :aria-label="$t('deverrouillerInteraction')" @click="deverrouiller" v-if="statut === 'verrouille'"><i class="material-icons" aria-hidden="true">lock</i></button>

					<button type="button" class="bouton icone" :disabled="disabled" :title="$t('verrouillerInteraction')" :aria-label="$t('verrouillerInteraction')" @click="verrouiller" v-else-if="statut !== 'verrouille' && statut !== 'attente' && (type !== 'Questionnaire' || (type === 'Questionnaire' &&donnees.options.tempsReponse === false))"><i class="material-icons" aria-hidden="true">lock_open</i></button>

					<button type="button" class="bouton icone" :disabled="disabled" :title="$t('afficherClassement')" :aria-label="$t('afficherClassement')" @click="afficherClassement" v-if="type === 'Questionnaire' && donnees.options.progression === 'animateur' && donnees.options.nom === 'obligatoire' && donnees.options.classement === false && classement.length > 0"><i class="material-icons" aria-hidden="true">emoji_events</i></button>

					<button type="button" class="bouton icone masque" :disabled="disabled" :title="$t('masquerNuage')" :aria-label="$t('masquerNuage')" @click="masquerNuage" v-if="type === 'Nuage-de-mots' && statut === 'nuage-affiche'"><i class="material-icons" aria-hidden="true">visibility</i></button>
					<button type="button" class="bouton icone" :disabled="disabled" :title="$t('afficherNuage')" :aria-label="$t('afficherNuage')" @click="afficherNuage" v-if="type === 'Nuage-de-mots' && statut !== 'nuage-affiche'"><i class="material-icons" aria-hidden="true">visibility_off</i></button>

					<button type="button" class="bouton icone" :disabled="disabled" :title="$t('exporterNuage')" :aria-label="$t('exporterNuage')" @click="exporterNuage" v-if="type === 'Nuage-de-mots'"><i class="material-icons" aria-hidden="true">camera</i></button>

					<button type="button" class="bouton" :disabled="disabled" @click="quitter">{{ $t('quitter') }}</button>
				</div>
			</footer>
		</div>

		<div class="conteneur-modale" v-if="modale === 'titre'">
			<div id="modale-titre" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('modifierTitre') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModale"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('modifierTitre')">
						<label for="titre">{{ $t('titre') }}</label>
						<input id="titre" type="text" :value="titre" :disabled="disabledModale" @keydown.enter.prevent="modifierTitre">
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="modifierTitre">{{ $t('valider') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'parametres'">
			<div id="modale-parametres" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('parametres') }}</span>
					<button type="button" class="fermer" :disabled="disabledParametres" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModale"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu">
						<label>{{ $t('langue') }}</label>
						<div class="langue">
							<button type="button" :disabled="disabledParametres" title="Français" aria-label="Français" :class="{'selectionne': langue === 'fr'}" @click="modifierLangue('fr')">FR</button>
							<button type="button" :disabled="disabledParametres" title="Español" aria-label="Español" :class="{'selectionne': langue === 'es'}" @click="modifierLangue('es')">ES</button>
							<button type="button" :disabled="disabledParametres" title="Italiano" aria-label="Italiano" :class="{'selectionne': langue === 'it'}" @click="modifierLangue('it')">IT</button>
							<button type="button" :disabled="disabledParametres" title="Deutsch" aria-label="Deutsch" :class="{'selectionne': langue === 'de'}" @click="modifierLangue('de')">DE</button>
							<button type="button" :disabled="disabledParametres" title="English" aria-label="English" :class="{'selectionne': langue === 'en'}" @click="modifierLangue('en')">EN</button>
						</div>
						<label v-if="(statut === '' || statut === 'termine') && type === 'Sondage'">{{ $t('exporterSondage') }}</label>
						<label v-else-if="(statut === '' || statut === 'termine') && type === 'Questionnaire'">{{ $t('exporterQuestionnaire') }}</label>
						<label v-else-if="(statut === '' || statut === 'termine') && type === 'Remue-méninges'">{{ $t('exporterRemueMeninges') }}</label>
						<label v-else-if="(statut === '' || statut === 'termine') && type === 'Nuage-de-mots'">{{ $t('exporterNuageDeMots') }}</label>
						<p v-if="(statut === '' || statut === 'termine')">{{ $t('messageExport') }}</p>
						<div class="actions" v-if="(statut === '' || statut === 'termine')">
							<button type="button" class="bouton" :class="{'exporter': viaDigidrive}" :disabled="disabledParametres" @click="exporter">{{ $t('exporter') }}</button>
						</div>
						<label v-if="(statut === '' || statut === 'termine') && type === 'Sondage' && !viaDigidrive">{{ $t('supprimerSondage') }}</label>
						<label v-else-if="(statut === '' || statut === 'termine') && type === 'Questionnaire' && !viaDigidrive">{{ $t('supprimerQuestionnaire') }}</label>
						<label v-else-if="(statut === '' || statut === 'termine') && type === 'Remue-méninges' && !viaDigidrive">{{ $t('supprimerRemueMeninges') }}</label>
						<label v-else-if="(statut === '' || statut === 'termine') && type === 'Nuage-de-mots' && !viaDigidrive">{{ $t('supprimerNuageDeMots') }}</label>
						<div class="actions" v-if="(statut === '' || statut === 'termine') && !viaDigidrive">
							<button type="button" class="bouton supprimer" :disabled="disabledParametres" @click="afficherModaleConfirmation('supprimer-interaction', '')">{{ $t('supprimer') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'resultats'">
			<div id="modale-resultats" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('exporterResultats') }}</span>
					<button type="button" class="fermer" :disabled="disabledParametres" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModale"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu">
						<template v-for="(resultatsSession, numeroResultatsSession, indexResultatsSession) in reponses">
							<div class="resultat" v-if="resultatsSession.length > 0 && sessions.hasOwnProperty(numeroResultatsSession)" :key="'session_' + indexResultatsSession">
								<span class="session">{{ $t('sessionDu') }} {{ $formaterDate(sessions[numeroResultatsSession].debut, langue) }}</span>
								<span class="actions">
									<button type="button" :disabled="disabledParametres" @click="exporterResultat(numeroResultatsSession)" :title="$t('exporterResultats')" :aria-label="$t('exporterResultats')"><i class="material-icons" aria-hidden="true">get_app</i></button>
									<button type="button" :disabled="disabledParametres" @click="exporterResultatIndividuel(numeroResultatsSession)" :title="$t('exporterResultatsIndividuels')" :aria-label="$t('exporterResultatsIndividuels')"><i class="material-icons" aria-hidden="true">assignment_ind</i></button>
									<button type="button" :disabled="disabledParametres" @click="afficherModaleConfirmation('supprimer-resultat', numeroResultatsSession)" :title="$t('supprimer')" :aria-label="$t('supprimer')"><i class="material-icons supprimer" aria-hidden="true">delete</i></button>
								</span>
							</div>
						</template>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'utilisateurs'">
			<div id="modale-utilisateurs" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('listeParticipants') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModale"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu">
						<div class="legendes" v-if="indexQuestion > -1 && (type === 'Sondage' || type === 'Questionnaire') && donnees.hasOwnProperty('options') && donnees.options.nom === 'obligatoire'">
							<div class="legende">
								<span class="reponse" />
								<span>{{ $t('aRepondu') }}</span>
							</div>
							<div class="legende">
								<span class="sans-reponse" />
								<span>{{ $t('pasRepondu') }}</span>
							</div>
						</div>
						<div class="utilisateurs-connectes" v-if="utilisateursConnectes.length > 0">
							<div class="utilisateur" :class="{'reponse': verifierRepondants(utilisateur.identifiant) === true, 'sans-reponse': verifierRepondants(utilisateur.identifiant) === false }" v-for="(utilisateur, indexUtilisateur) in utilisateursConnectes" :key="'utilisateur_connecte_' + indexUtilisateur">
								<button type="button" class="bannir" :disabled="disabledModale" :title="$t('bannirParticipant')" :aria-label="$t('bannirParticipant')" @click="bannir(utilisateur.identifiant)"><i class="material-icons" aria-hidden="true">block</i></button>
								<span v-if="utilisateur.nom !== ''">{{ utilisateur.nom }}</span>
								<span v-else>{{ utilisateur.identifiant }}</span>
							</div>
						</div>
						<div class="vide" v-else>
							{{ $t('aucunParticipant') }}
						</div>
						<h2 v-if="utilisateursBannis.length > 0">{{ $t('listeParticipantsBannis') }}</h2>
						<div class="utilisateurs-bannis" v-if="utilisateursBannis.length > 0">
							<div class="utilisateur" v-for="(utilisateur, indexUtilisateur) in utilisateursBannis" :key="'utilisateur_banni_' + indexUtilisateur">
								<button type="button" class="bannir" :disabled="disabledModale" :title="$t('autoriserParticipant')" :aria-label="$t('autoriserParticipant')" @click="autoriser(utilisateur.identifiant)"><i class="material-icons" aria-hidden="true">check_circle</i></button>
								<span v-if="utilisateur.nom !== ''">{{ utilisateur.nom }}</span>
								<span v-else>{{ utilisateur.identifiant }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'classement'">
			<div id="modale-classement" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('classement') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModale"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu">
						<ul class="classement">
							<li v-for="(utilisateur, index) in classement" :key="'utilisateur_' + index">
								<div class="utilisateur">
									<span class="index">{{ index + 1 }}</span>
									<span class="nom">{{ utilisateur.nom }}</span>
								</div>
								<div class="score">{{ (Math.round(utilisateur.score * 10) / 10) }}</div>
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'classement-collectif'">
			<div id="modale-classement" class="modale avec-footer" role="dialog">
				<header>
					<span class="titre">{{ $t('classement') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModale"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu">
						<ul class="classement">
							<li v-for="(utilisateur, index) in classement" :key="'utilisateur_' + index">
								<div class="utilisateur">
									<span class="index">{{ index + 1 }}</span>
									<span class="nom">{{ utilisateur.nom }}</span>
								</div>
								<div class="score">{{ (Math.round(utilisateur.score * 10) / 10) }}</div>
							</li>
						</ul>
					</div>
				</div>
				<footer>
					<button type="button" class="bouton" :disabled="disabledModale" @click="modifierIndexQuestion(indexQuestion + 1)" v-if="indexQuestion < (donnees.questions.length - 1)">{{ $t('suivant') }}</button>
					<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModale" v-else>{{ $t('fermer') }}</button>
				</footer>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'code-qr'">
			<div id="modale-codeqr" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('codeQR') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModale"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu">
						<p class="code">{{ code }}</p>
						<div id="qr" />
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-if="modaleConfirmation !== ''">
			<div id="modale-confirmation" class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<p v-html="messageConfirmation" />
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleConfirmation">{{ $t('non') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="supprimerResultat" v-if="modaleConfirmation === 'supprimer-resultat'">{{ $t('oui') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="supprimer" v-if="modaleConfirmation === 'supprimer-interaction'">{{ $t('oui') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-if="!admin && pageChargee">
			<div id="se-connecter" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('consulterInteraction') }}</span>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('consulterInteraction')">
						<label for="code">{{ $t('codeInteraction') }}</label>
						<input id="code" type="text" disabled :value="code">
						<label for="motdepasse">{{ $t('motDePasseAdministration') }}</label>
						<div class="conteneur-motdepasse">
							<input id="motdepasse" type="password" maxlength="48" v-model="motDePasseInteraction" :disabled="disabledModale" @keydown.enter="seConnecterInteraction" v-if="!motDePasseVisible">
							<input id="motdepasse" type="text" maxlength="48" v-model="motDePasseInteraction" :disabled="disabledModale" @keydown.enter="seConnecterInteraction" v-else>
							<button type="button" class="icone" :disabled="disabledModale" :title="$t('cacherMotDePasse')" :aria-label="$t('cacherMotDePasse')" @click="modifierMotDePasseVisible(false)" v-if="motDePasseVisible"><i class="material-icons" aria-hidden="true">visibility_off</i></button>
							<button type="button" class="icone" :disabled="disabledModale" :title="$t('afficherMotDePasse')" :aria-label="$t('afficherMotDePasse')" @click="modifierMotDePasseVisible(true)" v-else><i class="material-icons" aria-hidden="true">visibility</i></button>
						</div>
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="seConnecterInteraction" v-if="!chargementModale">{{ $t('valider') }}</button>
							<div class="conteneur-chargement" v-else>
								<div class="chargement" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<Notification :notification="notification" @fermer="notification = ''" />

		<Message :message="message" @elementPrecedent="definirElementPrecedent" @fermer="fermerMessage" v-if="message !== ''" />

		<Chargement v-if="chargement" />

		<ChargementPage v-if="chargementPage" />
	</div>
</template>

<script>
import axios from 'axios'
import ClipboardJS from 'clipboard'
import fileSaver from 'file-saver'
const { saveAs } = fileSaver
import domtoimage from 'dom-to-image'
import ChargementPage from '#root/components/chargement-page.vue'
import Chargement from '#root/components/chargement.vue'
import Message from '#root/components/message.vue'
import Notification from '#root/components/notification.vue'
import SondageCreer from '#root/components/sondageCreer.vue'
import QuestionnaireCreer from '#root/components/questionnaireCreer.vue'
import RemueMeningesCreer from '#root/components/remueMeningesCreer.vue'
import NuageMotsCreer from '#root/components/nuageMotsCreer.vue'
import SondageAfficher from '#root/components/sondageAfficher.vue'
import QuestionnaireAfficher from '#root/components/questionnaireAfficher.vue'
import RemueMeningesAfficher from '#root/components/remueMeningesAfficher.vue'
import NuageMotsAfficher from '#root/components/nuageMotsAfficher.vue'

export default {
	name: 'DigistormCreer',
	provide () {
		return {
			parent: this
		}
	},
	components: {
		ChargementPage,
		Chargement,
		Message,
		Notification,
		SondageCreer,
		QuestionnaireCreer,
		RemueMeningesCreer,
		NuageMotsCreer,
		SondageAfficher,
		QuestionnaireAfficher,
		RemueMeningesAfficher,
		NuageMotsAfficher
	},
	data () {
		return {
			chargementPage: true,
			chargement: false,
			message: '',
			notification: '',
			admin: false,
			modale: '',
			visible: true,
			enregistrement: '',
			utilisateurs: [],
			resultats: true,
			classementResultats: false,
			tableauResultats: false,
			reponseVisible: false,
			reponsesSession: [],
			donneesSession: {},
			modaleConfirmation: '',
			messageConfirmation: '',
			numeroSession: 0,
			indexQuestion: -1,
			clipboard: null,
			codeqr: null,
			chargementModale: false,
			domaine: '',
			pageChargee: false,
			date: 0,
			elementPrecedent: null,
			modaleComposant: false,
			motDePasseInteraction: '',
			motDePasseVisible: false,
			hote: this.$pageContext.pageProps.hote,
			langues: this.$pageContext.pageProps.langues,
			identifiant: this.$pageContext.pageProps.identifiant,
			nom: this.$pageContext.pageProps.nom,
			langue: this.$pageContext.pageProps.langue,
			role: this.$pageContext.pageProps.role,
			interactions: this.$pageContext.pageProps.interactions,
			code: this.$pageContext.pageProps.code,
			type: this.$pageContext.pageProps.type,
			titre: this.$pageContext.pageProps.titre,
			motdepasse: this.$pageContext.pageProps.motdepasse,
			proprietaire: this.$pageContext.pageProps.proprietaire,
			donnees: this.$pageContext.pageProps.donnees,
			reponses: this.$pageContext.pageProps.reponses,
			sessions: this.$pageContext.pageProps.sessions,
			bannis: this.$pageContext.pageProps.bannis,
			statut: this.$pageContext.pageProps.statut,
			session: this.$pageContext.pageProps.session,
			digidrive: this.$pageContext.pageProps.digidrive
		}
	},
	computed: {
		tabIndex () {
			return this.modale === '' && this.message === '' && this.modaleConfirmation === '' && !this.modaleComposant ? 0 : -1
		},
		disabled () {
			return this.modale === '' && this.message === '' && this.modaleConfirmation === '' && !this.modaleComposant ? false : true
		},
		disabledParametres () {
			return this.modaleConfirmation === '' && this.message === '' ? false : true
		},
		disabledModale () {
			return this.message === '' ? false : true
		},
		viaDigidrive () {
			return this.role === 'auteur' && parseInt(this.digidrive) === 1
		},
		utilisateursConnectes () {
			const utilisateurs = []
			if (this.type === 'Questionnaire' && this.donnees.hasOwnProperty('options') && this.donnees.options.hasOwnProperty('modalite') && this.donnees.options.modalite === 'asynchrone') {
				this.reponsesSession.forEach((reponse) => {
					utilisateurs.push({ identifiant: reponse.identifiant, nom: reponse.nom })
				})
			} else {
				this.utilisateurs.forEach((utilisateur) => {
					if (utilisateur.connecte && !utilisateur.banni) {
						utilisateurs.push(utilisateur)
					}
				})
			}
			return utilisateurs
		},
		utilisateursBannis () {
			const utilisateurs = []
			this.utilisateurs.forEach((utilisateur) => {
				if (utilisateur.connecte && utilisateur.banni) {
					utilisateurs.push(utilisateur)
				}
			})
			return utilisateurs
		},
		classement () {
			const classement = []
			if (this.type === 'Questionnaire') {
				this.reponsesSession.forEach((item) => {
					let donnees = JSON.parse(JSON.stringify(this.donnees))
					if (this.donnees.hasOwnProperty('options') && ((this.donnees.options.hasOwnProperty('questionsAleatoires') && this.donnees.options.questionsAleatoires === true) || (this.donnees.options.hasOwnProperty('itemsAleatoires') && this.donnees.options.itemsAleatoires === true))) {
						donnees = JSON.parse(JSON.stringify(this.donneesSession))
					}
					const scoreTotal = this.definirScore(item, donnees)
					if (!this.bannis.includes(item.identifiant)) {
						classement.push({ identifiant: item.identifiant, nom: item.nom, score: scoreTotal })
					}
				})
				classement.sort((a, b) => {
					return b.score - a.score
				})
			}
			return classement
		}
	},
	watch: {
		indexQuestion () {
			this.reponseVisible = false
		},
		pageChargee (valeur) {
			if (valeur === true && this.admin) {
				this.initialiser()
			} else if (valeur === true && !this.admin) {
				document.querySelector('#motdepasse')?.focus()
			}
		}
	},
	async created () {
		const params = this.$pageContext.pageProps.params
		const identifiant = params.id
		const motdepasse = params.mdp
		if (identifiant && identifiant !== '' && motdepasse && motdepasse !== '') {
			window.history.replaceState({}, document.title, window.location.href.split('?')[0])
		}

		const langueNav = navigator.language.substring(0, 2)
		const langueParam = params.lang
		if (langueParam && langueParam !== '' && this.langues.includes(langueParam) === true) {
			this.langue = langueParam
			localStorage.setItem('digistorm_lang', langueParam)
		} else if (!langueParam && langueNav !== '' && this.langues.includes(langueNav) === true) {
			this.langue = langueNav
		} 
		if (localStorage.getItem('digistorm_lang')) {
			this.langue = localStorage.getItem('digistorm_lang')
		}
		this.$i18n.locale = this.langue
		if (this.langue !== this.$pageContext.pageProps.langue) {
			this.$socket.emit('modifierlangue', this.langue)
		}

		this.ecouterSocket()

		if (this.reponses && this.reponses[this.session]) {
			this.reponsesSession = this.reponses[this.session]
		}

		if (this.sessions[this.session] && this.sessions[this.session].hasOwnProperty('donnees')) {
			this.donneesSession = this.sessions[this.session].donnees
		}

		if (this.type === 'Sondage' || this.type === 'Questionnaire') {
			this.indexQuestion = parseInt(this.donnees.indexQuestion)
		}

		if ((this.role === 'auteur' && this.interactions.map(item => item.code).includes(parseInt(this.code))) || (this.role === 'utilisateur' && this.proprietaire === this.identifiant)) {
			this.admin = true
			this.$socket.emit('connexion', { code: this.code, identifiant: this.identifiant, nom: this.nom, nomAleatoire: false })
		}

		this.pageChargee = true
	},
	mounted () {
		document.getElementsByTagName('html')[0].setAttribute('lang', this.langue)

		this.chargementPage = false

		if (this.type === 'Questionnaire' && this.statut === 'ouvert' && this.donnees.options.progression === 'animateur' && this.donnees.options.hasOwnProperty('tempsReponse') && this.donnees.options.tempsReponse === true && localStorage.getItem('date')) {
			this.date = parseInt(localStorage.getItem('date'))
		}

		document.addEventListener('keydown', this.gererClavier, false)
	},
	beforeUnmount () {
		this.clipboard?.destroy()
		this.codeqr?.clear()
		document.removeEventListener('keydown', this.gererClavier, false)
	},
	methods: {
		initialiser () {
			const lien = this.hote + '/p/' + this.code
			this.clipboard = new ClipboardJS('#copier', {
				text: () => {
					return lien
				}
			})
			this.clipboard.on('success', () => {
				document.querySelector('#copier')?.focus()
				this.notification = this.$t('lienCopie')
			})

			this.domaine = window.location.href.split('/c/')[0]
		},
		modifierMotDePasseVisible (valeur) {
			this.motDePasseVisible = valeur
			this.$nextTick(() => {
				document.querySelector('.conteneur-motdepasse .icone')?.focus()
			})
		},
		modifierModaleComposant (valeur) {
			this.modaleComposant = valeur
		},
		afficherCodeQR () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'code-qr'
			this.$nextTick(() => {
				const lien = this.hote + '/p/' + this.code
				this.codeqr = new QRCode('qr', {
					text: lien,
					width: 360,
					height: 360,
					colorDark: '#000000',
					colorLight: '#ffffff',
					correctLevel: QRCode.CorrectLevel.H
				})
				fitty('#modale-codeqr p', {
					minSize: 20,
					maxSize: 100,
					multiLine: false
				})
				document.querySelector('.modale .fermer')?.focus()
			})
		},
		fermerModale () {
			if (this.codeqr) {
				this.codeqr.clear()
				this.codeqr = null
			}
			this.modale = ''
			this.gererFocus()
		},
		afficherModaleTitre () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'titre'
			this.$nextTick(() => {
				document.querySelector('#modale-titre input')?.focus()
			})
		},
		modifierTitre () {
			const titre = document.querySelector('#modale-titre input').value
			if (titre !== '') {
				this.titre = titre
				this.fermerModale()
			}
		},
		afficherModaleParametres () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'parametres'
			this.$nextTick(() => {
				document.querySelector('.modale .fermer')?.focus()
			})
		},
		afficherModaleUtilisateurs () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'utilisateurs'
			this.$nextTick(() => {
				document.querySelector('.modale .fermer')?.focus()
			})
		},
		modifierLangue (langue) {
			if (this.langue !== langue) {
				this.chargement = true
				axios.post(this.hote + '/api/modifier-langue', {
					langue: langue
				}).then(() => {
					this.chargement = false
					this.$i18n.locale = langue
					document.getElementsByTagName('html')[0].setAttribute('lang', langue)
					this.langue = langue
					this.notification = this.$t('langueModifiee')
					localStorage.setItem('digistorm_lang', langue)
				}).catch((err) => {
					this.chargement = false
					if (err.response?.data === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		telecharger () {
			this.chargement = true
			axios.post(this.hote + '/api/telecharger-informations-interaction', {
				identifiant: this.identifiant,
				code: this.code,
				motdepasse: this.motdepasse,
				type: this.type,
				titre: this.titre,
				domaine: this.domaine
			}).then((reponse) => {
				this.chargement = false
				const donnees = reponse.data
				const fichier = this.code + '.pdf'
				const blob = new Blob([Uint8Array.from(atob(donnees), char => char.charCodeAt(0))], { type: 'application/pdf' })
				saveAs(blob, fichier)
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		enregistrer (type) {
			this.enregistrement = type
		},
		enregistrerDonnees (donneesInteraction) {
			this.chargement = true
			if (this.type === 'Questionnaire' && donneesInteraction.options.pointsPersonnalises === true) {
				donneesInteraction.questions.forEach((question, index) => {
					if (isNaN(question.points) === true || question.points === '' || question.points === null) {
						donneesInteraction.questions[index].points = 1000
					}
				})
			} else if (this.type === 'Questionnaire' && donneesInteraction.options.pointsPersonnalises === false) {
				donneesInteraction.questions.forEach((question, index) => {
					donneesInteraction.questions[index].points = 1000
				})
			}
			if (this.type === 'Questionnaire' && donneesInteraction.options.tempsReponse === true) {
				donneesInteraction.questions.forEach((question, index) => {
					if (isNaN(question.temps) === true || question.temps === '' || question.temps === null) {
						donneesInteraction.questions[index].temps = 20
					}
				})
			}
			if (this.type === 'Questionnaire' || this.type === 'Sondage') {
				donneesInteraction.questions.forEach((question) => {
					if ((question.option === 'texte-court' || question.option === 'etoiles') && question.hasOwnProperty('items')) {
						delete question.items
					} else if (question.option !== 'etoiles' && question.hasOwnProperty('etoiles')) {
						delete question.etoiles
					}
				})
			}
			axios.post(this.hote + '/api/modifier-interaction', {
				identifiant: this.identifiant,
				code: this.code,
				titre: this.titre,
				donnees: donneesInteraction
			}).then(() => {
				this.donnees = donneesInteraction
				if (this.enregistrement === 'enregistrement') {
					this.chargement = false
					if (this.type === 'Sondage') {
						this.notification = this.$t('sondageEnregistre')
					} else if (this.type === 'Questionnaire') {
						this.notification = this.$t('questionnaireEnregistre')
					} else if (this.type === 'Remue-méninges') {
						this.notification = this.$t('remueMeningesEnregistre')
					} else if (this.type === 'Nuage-de-mots') {
						this.notification = this.$t('nuageDeMotsEnregistre')
					}
					document.title = this.titre + ' - Digistorm by La Digitale'
				} else if (this.enregistrement === 'lancement') {
					this.lancer()
				}
				this.enregistrement = 'termine'
			}).catch((err) => {
				this.chargement = false
				this.enregistrement = ''
				if (err.response?.data === 'erreur_code') {
					this.message = this.$t('codeNonValide')
				} else if (err.response?.data === 'non_autorise') {
					if (this.type === 'Sondage') {
						this.message = this.$t('pasAutoriseModifierSondage')
					} else if (this.type === 'Questionnaire') {
						this.message = this.$t('pasAutoriseModifierQuestionnaire')
					} else if (this.type === 'Remue-méninges') {
						this.message = this.$t('pasAutoriseModifierRemueMeninges')
					} else if (this.type === 'Nuage-de-mots') {
						this.message = this.$t('pasAutoriseModifierNuageDeMots')
					}
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		bannir (identifiant) {
			if (!this.bannis.includes(identifiant)) {
				this.bannis.push(identifiant)
				this.utilisateurs.forEach((utilisateur) => {
					if (utilisateur.identifiant === identifiant) {
						utilisateur.banni = true
					}
				})
				this.$socket.emit('utilisateursbannis', { code: this.code, utilisateursBannis: this.bannis, identifiant: identifiant, type: 'banni' })
			}
		},
		autoriser (identifiant) {
			if (this.bannis.includes(identifiant)) {
				const index = this.bannis.indexOf(identifiant)
				this.bannis.splice(index, 1)
				this.utilisateurs.forEach((utilisateur) => {
					if (utilisateur.identifiant === identifiant) {
						utilisateur.banni = false
					}
				})
				this.$socket.emit('utilisateursbannis', { code: this.code, utilisateursBannis: this.bannis, identifiant: identifiant, type: 'autorise' })
			}
		},
		verifierDonnees (donnees) {
			if (this.type === 'Sondage') {
				let donneesQuestions = true
				for (let i = 0; i < donnees.questions.length; i++) {
					let donneesQuestion = false
					let donneesSupport = false
					let items = 0
					const itemsTexte = []
					if (donnees.questions[i].question !== '') {
						donneesQuestion = true
					}
					if (Object.keys(donnees.questions[i].support).length > 0) {
						donneesSupport = true
					}
					if (!donneesQuestion && !donneesSupport) {
						donneesQuestions = { erreur: 'aucune-question', index: i }
						break
					}
					if (donnees.questions[i].option !== 'texte-court' && donnees.questions[i].option !== 'etoiles') {
						donnees.questions[i].items.forEach((item) => {
							if (item.texte !== '' || item.image !== '') {
								items++
							}
							if (item.texte !== '') {
								itemsTexte.push(item.texte)
							}
						})
					}
					if ((new Set(itemsTexte)).size !== itemsTexte.length) {
						donneesQuestions = { erreur: 'doublons-texte', index: i }
						break
					}
					if (items < 2 && donnees.questions[i].option !== 'texte-court' && donnees.questions[i].option !== 'etoiles') {
						donneesQuestions = { erreur: 'aucun-item', index: i }
						break
					}
				}
				return donneesQuestions
			} else if (this.type === 'Questionnaire') {
				let donneesQuestions = true
				for (let i = 0; i < donnees.questions.length; i++) {
					let donneesQuestion = false
					let donneesSupport = false
					let items = 0
					let reponses = 0
					const itemsTexte = []
					if (donnees.questions[i].question !== '') {
						donneesQuestion = true
					}
					if (Object.keys(donnees.questions[i].support).length > 0) {
						donneesSupport = true
					}
					if (!donneesQuestion && !donneesSupport) {
						donneesQuestions = { erreur: 'aucune-question', index: i }
						break
					}
					if (donnees.questions[i].option !== 'texte-court') {
						donnees.questions[i].items.forEach((item) => {
							if (item.texte !== '' || item.image !== '') {
								items++
							}
							if (item.texte !== '') {
								itemsTexte.push(item.texte)
							}
							if (item.reponse) {
								reponses++
							}
						})
					} else if (donnees.questions[i].reponses !== '') {
						reponses++
					}
					if ((new Set(itemsTexte)).size !== itemsTexte.length) {
						donneesQuestions = { erreur: 'doublons-texte', index: i }
						break
					}
					if (items < 2 && donnees.questions[i].option !== 'texte-court') {
						donneesQuestions = { erreur: 'aucun-item', index: i }
						break
					}
					if (reponses === 0) {
						donneesQuestions = { erreur: 'aucune-reponse', index: i }
						break
					}
				}
				return donneesQuestions
			} else if (this.type === 'Remue-méninges') {
				let donneesQuestion = false
				let donneesSupport = false
				const categories = []
				if (donnees.question !== '') {
					donneesQuestion = true
				}
				if (Object.keys(donnees.support).length > 0) {
					donneesSupport = true
				}
				donnees.categories.forEach((categorie) => {
					if (categorie.texte !== '') {
						categories.push(categorie.texte)
					} else if (categorie.image !== '') {
						categories.push(categorie.image)
					}
				})
				if ((new Set(categories)).size !== categories.length) {
					return 'doublons-categorie'
				}
				if (donneesQuestion || donneesSupport) {
					return true
				} else {
					return false
				}
			} else if (this.type === 'Nuage-de-mots') {
				let donneesQuestion = false
				let donneesSupport = false
				if (donnees.question !== '') {
					donneesQuestion = true
				}
				if (Object.keys(donnees.support).length > 0) {
					donneesSupport = true
				}
				if (donneesQuestion || donneesSupport) {
					return true
				} else {
					return false
				}
			}
		},
		lancer () {
			const verificationDonnees = this.verifierDonnees(this.donnees)
			if (Object.keys(this.donnees).length > 0 && verificationDonnees === true) {
				let statut = 'ouvert'
				if ((this.type === 'Questionnaire' || this.type === 'Sondage') && this.donnees.options.progression === 'animateur') {
					statut = 'attente'
				}
				axios.post(this.hote + '/api/modifier-statut-interaction', {
					identifiant: this.identifiant,
					code: this.code,
					statut: statut
				}).then((reponse) => {
					this.chargement = false
					this.enregistrement = ''
					const resultat = reponse.data
					this.statut = statut
					if (this.type === 'Sondage' && this.donnees.hasOwnProperty('options') && this.donnees.options.progression === 'libre') {
						this.notification = this.$t('sondageOuvert')
					} else if (this.type === 'Sondage' && this.donnees.hasOwnProperty('options') && this.donnees.options.progression === 'animateur') {
						this.notification = this.$t('questionnaireEnAttente')
					} else if (this.type === 'Questionnaire' && this.donnees.hasOwnProperty('options') && this.donnees.options.progression === 'libre') {
						this.notification = this.$t('questionnaireOuvert')
					} else if (this.type === 'Questionnaire' && this.donnees.hasOwnProperty('options') && this.donnees.options.progression === 'animateur') {
						this.notification = this.$t('questionnaireEnAttente')
					} else if (this.type === 'Remue-méninges') {
						this.notification = this.$t('remueMeningesOuvert')
					} else if (this.type === 'Nuage-de-mots') {
						this.notification = this.$t('nuageDeMotsOuvert')
					}
					let nomAleatoire = false
					if (this.donnees.hasOwnProperty('options') && this.donnees.options.hasOwnProperty('nom') && this.donnees.options.nom === 'aleatoire') {
						nomAleatoire = true
					}
					let donnees = JSON.parse(JSON.stringify(this.donnees))
					if ((this.type === 'Questionnaire' || this.type === 'Sondage') && this.donnees.hasOwnProperty('options') && ((this.donnees.options.hasOwnProperty('questionsAleatoires') && this.donnees.options.questionsAleatoires === true) || (this.donnees.options.hasOwnProperty('itemsAleatoires') && this.donnees.options.itemsAleatoires === true))) {
						donnees = resultat.donnees
						this.donneesSession = resultat.donnees
						if (!this.sessions[this.session]) {
							this.sessions[this.session] = {}
						}
						this.sessions[this.session].donnees = resultat.donnees
					}
					if ((this.type === 'Questionnaire' || this.type === 'Sondage') && this.donnees.hasOwnProperty('options') && this.donnees.options.progression === 'animateur') {
						this.indexQuestion = this.donnees.copieIndexQuestion
						this.$socket.emit('interactionenattente', { code: this.code, donnees: this.donnees, nomAleatoire: nomAleatoire })
					} else if (this.type === 'Sondage' && this.donnees.hasOwnProperty('options') && this.donnees.options.progression === 'libre') {
						this.indexQuestion = this.donnees.copieIndexQuestion
						this.$socket.emit('interactionouverte', { code: this.code, session: this.session, titre: this.titre, donnees: donnees, nomAleatoire: nomAleatoire })
					} else {
						this.$socket.emit('interactionouverte', { code: this.code, session: this.session, titre: this.titre, donnees: donnees, nomAleatoire: nomAleatoire })
					}
				}).catch((err) => {
					this.chargement = false
					this.enregistrement = ''
					if (err.response?.data?.message === 'erreur_code') {
						this.message = this.$t('codeNonValide')
					} else if (err.response?.data?.message === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			} else {
				this.chargement = false
				if (this.type === 'Sondage' || this.type === 'Questionnaire') {
					if (Object.keys(this.donnees).length === 0) {
						if (this.type === 'Sondage') {
							this.message = this.$t('sondageSansContenu')
						} else {
							this.message = this.$t('questionnaireSansContenu')
						}
					} else if (verificationDonnees.erreur === 'doublons-texte') {
						this.message = this.$t('questionDoublons', { question: verificationDonnees.index + 1 })
					} else if (verificationDonnees.erreur === 'aucune-question') {
						this.message = this.$t('questionSansQuestion', { question: verificationDonnees.index + 1 })
					} else if (verificationDonnees.erreur === 'aucun-item') {
						this.message = this.$t('questionSansReponse', { question: verificationDonnees.index + 1 })
					} else if (verificationDonnees.erreur === 'aucune-reponse') {
						this.message = this.$t('questionSansBonneReponse', { question: verificationDonnees.index + 1 })
					}
				} else if (this.type === 'Remue-méninges') {
					if (Object.keys(this.donnees).length === 0 || (this.donnees.question === '' && Object.keys(this.donnees.support).length === 0)) {
						this.message = this.$t('remueMeningesSansContenu')
					} else if (verificationDonnees === 'doublons-categorie') {
						this.message = this.$t('remueMeningesDoublons')
					}
				} else if (this.type === 'Nuage-de-mots') {
					if (Object.keys(this.donnees).length === 0 || (this.donnees.question === '' && Object.keys(this.donnees.support).length === 0)) {
						this.message = this.$t('nuageDeMotsSansContenu')
					}
				}
			}
		},
		demarrer () {
			this.chargement = true
			axios.post(this.hote + '/api/modifier-statut-interaction', {
				identifiant: this.identifiant,
				code: this.code,
				statut: 'ouvert'
			}).then((reponse) => {
				this.chargement = false
				const resultat = reponse.data
				const date = new Date().getTime()
				this.statut = 'ouvert'
				if (this.type === 'Sondage') {
					this.notification = this.$t('sondageOuvert')
				} else if (this.type === 'Questionnaire') {
					this.notification = this.$t('questionnaireOuvert')
				}
				let donnees = JSON.parse(JSON.stringify(this.donnees))
				if (this.donnees.hasOwnProperty('options') && ((this.donnees.options.hasOwnProperty('questionsAleatoires') && this.donnees.options.questionsAleatoires === true) || (this.donnees.options.hasOwnProperty('itemsAleatoires') && this.donnees.options.itemsAleatoires === true))) {
					donnees = resultat.donnees
					this.donneesSession = resultat.donnees
					if (!this.sessions[this.session]) {
						this.sessions[this.session] = {}
					}
					this.sessions[this.session].donnees = resultat.donnees
				}
				if (this.type === 'Questionnaire' && this.donnees.hasOwnProperty('options') && this.donnees.options.progression === 'animateur' && this.donnees.options.hasOwnProperty('tempsReponse') && this.donnees.options.tempsReponse === true) {
					this.date = date
					localStorage.setItem('date', date)
				}
				this.$socket.emit('interactionouverte', { code: this.code, session: this.session, titre: this.titre, donnees: donnees, date: date })
				this.$nextTick(() => {
					window.typesetMathJax()
				})
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data?.message === 'erreur_code') {
					this.message = this.$t('codeNonValide')
				} else if (err.response?.data?.message === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		modifierIndexQuestion (indexQuestion) {
			if (this.modale === 'classement-collectif') {
				this.modale = ''
			}
			if (this.type === 'Sondage' && this.donnees.options.progression === 'libre') {
				this.indexQuestion = indexQuestion
			} else {
				this.chargement = true
				axios.post(this.hote + '/api/modifier-index-question', {
					identifiant: this.identifiant,
					code: this.code,
					indexQuestion: indexQuestion
				}).then(() => {
					this.chargement = false
					this.indexQuestion = indexQuestion
					if (this.sessions[this.session] && this.sessions[this.session].hasOwnProperty('donnees')) {
						this.sessions[this.session].donnees.indexQuestion = indexQuestion
					}
					const date = new Date().getTime()
					if (this.type === 'Questionnaire' && this.donnees.hasOwnProperty('options') && this.donnees.options.progression === 'animateur' && this.donnees.options.hasOwnProperty('tempsReponse') && this.donnees.options.tempsReponse === true) {
						this.date = date
						localStorage.setItem('date', date)
					}
					this.$socket.emit('questionsuivante', { code: this.code, date: date, index: indexQuestion })
				}).catch((err) => {
					this.chargement = false
					if (err.response?.data === 'erreur_code') {
						this.message = this.$t('codeNonValide')
					} else if (err.response?.data === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		modifierTableauResultats (bool) {
			this.tableauResultats = bool
		},
		afficherClassement () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'classement'
			this.$nextTick(() => {
				document.querySelector('.modale .fermer')?.focus()
			})
		},
		afficherClassementCollectif () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'classement-collectif'
			this.$nextTick(() => {
				document.querySelector('.modale .fermer')?.focus()
			})
			this.$socket.emit('classement', this.code, this.classement)
		},
		afficherResultats () {
			this.resultats = true
		},
		masquerResultats () {
			this.resultats = false
			this.classementResultats = false
		},
		classerResultats (bool) {
			this.classementResultats = bool
		},
		afficherReponse () {
			this.reponseVisible = true
		},
		verrouiller () {
			this.chargement = true
			const statut = 'verrouille'
			axios.post(this.hote + '/api/modifier-statut-interaction', {
				identifiant: this.identifiant,
				code: this.code,
				statut: statut
			}).then(() => {
				this.chargement = false
				this.statut = statut
				if (this.type === 'Remue-méninges') {
					this.notification = this.$t('remueMeningesVerrouille')
				} else if (this.type === 'Nuage-de-mots') {
					this.notification = this.$t('nuageDeMotsVerrouille')
				} else if (this.type === 'Sondage') {
					this.notification = this.$t('sondageVerrouille')
				} else if (this.type === 'Questionnaire') {
					this.notification = this.$t('questionnaireVerrouille')
				}
				this.$socket.emit('interactionverrouillee', this.code)
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data?.message === 'erreur_code') {
					this.message = this.$t('codeNonValide')
				} else if (err.response?.data?.message === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		deverrouiller () {
			this.chargement = true
			const statut = 'ouvert'
			axios.post(this.hote + '/api/modifier-statut-interaction', {
				identifiant: this.identifiant,
				code: this.code,
				statut: statut
			}).then(() => {
				this.chargement = false
				this.statut = statut
				if (this.type === 'Remue-méninges') {
					this.notification = this.$t('remueMeningesDeverrouille')
				} else if (this.type === 'Nuage-de-mots') {
					this.notification = this.$t('nuageDeMotsDeverrouille')
				} else if (this.type === 'Sondage') {
					this.notification = this.$t('sondageDeverrouille')
				} else if (this.type === 'Questionnaire') {
					this.notification = this.$t('questionnaireDeverrouille')
				}
				this.$socket.emit('interactiondeverrouillee', this.code)
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data?.message === 'erreur_code') {
					this.message = this.$t('codeNonValide')
				} else if (err.response?.data?.message === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		afficherNuage () {
			this.chargement = true
			const statut = 'nuage-affiche'
			axios.post(this.hote + '/api/modifier-statut-interaction', {
				identifiant: this.identifiant,
				code: this.code,
				statut: statut
			}).then(() => {
				this.chargement = false
				this.statut = statut
				this.notification = this.$t('nuageDeMotsAffiche')
				this.$socket.emit('nuageaffiche', { code: this.code, reponses: this.reponsesSession })
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data?.message === 'erreur_code') {
					this.message = this.$t('codeNonValide')
				} else if (err.response?.data?.message === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		masquerNuage () {
			this.chargement = true
			const statut = 'ouvert'
			axios.post(this.hote + '/api/modifier-statut-interaction', {
				identifiant: this.identifiant,
				code: this.code,
				statut: statut
			}).then(() => {
				this.chargement = false
				this.statut = statut
				this.notification = this.$t('nuageDeMotsMasque')
				this.$socket.emit('nuagemasque', this.code)
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data?.message === 'erreur_code') {
					this.message = this.$t('codeNonValide')
				} else if (err.response?.data?.message === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		exporterNuage () {
			this.chargement = true
			domtoimage.toPng(document.querySelector('#conteneur-nuage div'), { bgcolor: '#fff' }).then((image) => {
				saveAs(image, this.code + '_' + this.session + '_' + Date.now() + '.png')
				this.chargement = false
			})
		},
		verifierRepondants (identifiant) {
			if (this.indexQuestion > -1 && (this.type === 'Sondage' || this.type === 'Questionnaire') && this.donnees.hasOwnProperty('options') && this.donnees.options.nom === 'obligatoire' && this.reponsesSession.map((e) => { return e.identifiant }).includes(identifiant) === true) {
				let reponse = false
				this.reponsesSession.forEach((item) => {
					if (item.identifiant === identifiant && item.reponse[this.indexQuestion].toString() !== '') {
						reponse = true
					}
				})
				return reponse
			} else if (this.indexQuestion > -1 && (this.type === 'Sondage' || this.type === 'Questionnaire') && this.donnees.hasOwnProperty('options') && this.donnees.options.nom === 'obligatoire' && this.reponsesSession.map((e) => { return e.identifiant }).includes(identifiant) === false) {
				return false
			} else {
				return ''
			}
		},
		quitter () {
			if (this.type === 'Nuage-de-mots') {
				this.chargement = true
				domtoimage.toPng(document.querySelector('#conteneur-nuage div'), { bgcolor: '#fff' }).then((image) => {
					if (this.reponsesSession.length > 0) {
						saveAs(image, this.code + '_' + this.session + '_' + Date.now() + '.png')
					}
					axios.post(this.hote + '/api/fermer-interaction', {
						identifiant: this.identifiant,
						code: this.code,
						classement: this.classement
					}).then((reponse) => {
						this.chargement = false
						const donnees = reponse.data
						this.statut = 'termine'
						this.reponsesSession = []
						this.donneesSession = {}
						this.session = donnees.session
						this.reponses = donnees.reponses
						this.sessions = donnees.sessions
						this.bannis = []
						this.utilisateurs = []
						this.notification = this.$t('nuageDeMotsFerme')
						this.$socket.emit('interactionfermee', this.code)
					}).catch((err) => {
						this.chargement = false
						if (err.response?.data === 'erreur_code') {
							this.message = this.$t('codeNonValide')
						} else if (err.response?.data === 'non_autorise') {
							this.message = this.$t('actionNonAutorisee')
						} else {
							this.message = this.$t('erreurCommunicationServeur')
						}
					})
				})
			} else {
				this.chargement = true
				axios.post(this.hote + '/api/fermer-interaction', {
					identifiant: this.identifiant,
					code: this.code,
					classement: this.classement
				}).then((reponse) => {
					this.chargement = false
					const donnees = reponse.data
					this.statut = 'termine'
					this.reponsesSession = []
					this.donneesSession = {}
					this.session = donnees.session
					this.reponses = donnees.reponses
					this.sessions = donnees.sessions
					this.bannis = []
					this.utilisateurs = []
					if (this.type === 'Sondage') {
						this.notification = this.$t('sondageFerme')
					} else if (this.type === 'Questionnaire') {
						this.date = 0
						if (localStorage.getItem('date')) {
							localStorage.removeItem('date')
						}
						this.notification = this.$t('questionnaireFerme')
					} else if (this.type === 'Remue-méninges') {
						this.notification = this.$t('remueMeningesFerme')
					}
					this.$socket.emit('interactionfermee', this.code)
				}).catch((err) => {
					this.chargement = false
					if (err.response?.data === 'erreur') {
						this.message = this.$t('erreurCommunicationServeur')
					} else if (err.response?.data === 'erreur_code') {
						this.message = this.$t('codeNonValide')
					} else if (err.response?.data === 'non_autorise') {
						if (this.type === 'Sondage') {
							this.message = this.$t('pasAutoriseModifierSondage')
						} else if (this.type === 'Questionnaire') {
							this.message = this.$t('pasAutoriseModifierQuestionnaire')
						} else if (this.type === 'Remue-méninges') {
							this.message = this.$t('pasAutoriseModifierRemueMeninges')
						}
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		definirNombreReponses () {
			if (Object.keys(this.reponses).length > 0) {
				let nombreSessions = 0
				for (const reponse in this.reponses) {
					if (this.sessions.hasOwnProperty(reponse)) {
						nombreSessions++
					}
				}
				return nombreSessions
			} else {
				return 0
			}
		},
		afficherModaleResultats () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'resultats'
			this.$nextTick(() => {
				document.querySelector('.modale .fermer')?.focus()
			})
		},
		exporterResultat (session) {
			this.chargement = true
			let classement = []
			if (this.type === 'Questionnaire' && session === '') {
				classement = this.classement
			} else if (this.type === 'Questionnaire' && session !== '') {
				classement = this.sessions[session].classement
			}
			let dateDebut = ''
			let dateFin = ''
			let donnees
			let reponses
			if (session === '') {
				if (this.sessions[this.session] && this.sessions[this.session].hasOwnProperty('donnees')) {
					donnees = this.sessions[this.session].donnees
				} else {
					donnees = this.donnees
				}
				reponses = this.reponsesSession
			} else {
				donnees = this.sessions[session].donnees
				reponses = this.reponses[session]
				dateDebut = this.$formaterDate(this.sessions[session].debut, this.langue)
				dateFin = this.$formaterDate(this.sessions[session].fin, this.langue)
			}
			axios.post(this.hote + '/api/exporter-resultat', {
				identifiant: this.identifiant,
				code: this.code,
				type: this.type,
				titre: this.titre,
				donnees: donnees,
				reponses: reponses,
				classement: classement,
				dateDebut: dateDebut,
				dateFin: dateFin,
				bannis: this.bannis
			}).then((reponse) => {
				this.chargement = false
				const donnees = reponse.data
				const fichier = this.code + '_' + session + '.pdf'
				const blob = new Blob([Uint8Array.from(atob(donnees), char => char.charCodeAt(0))], { type: 'application/pdf' })
				saveAs(blob, fichier)
				this.notification = this.$t('resultatsExportes')
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		exporterResultatIndividuel (session) {
			let texte = ''
			let reponses
			if (session === '') {
				reponses = this.reponsesSession
			} else {
				reponses = this.reponses[session]
			}
			let donnees
			if (session === '') {
				donnees = JSON.parse(JSON.stringify(this.donnees))
				if (this.donnees.hasOwnProperty('options') && ((this.donnees.options.hasOwnProperty('questionsAleatoires') && this.donnees.options.questionsAleatoires === true) || (this.donnees.options.hasOwnProperty('itemsAleatoires') && this.donnees.options.itemsAleatoires === true))) {
					donnees = JSON.parse(JSON.stringify(this.donneesSession))
				}
			} else {
				donnees = JSON.parse(JSON.stringify(this.sessions[session].donnees))
			}
			const utilisateurs = []
			reponses.forEach((item) => {
				let banni = false
				if (this.bannis.includes(item.identifiant)) {
					banni = true
				}
				if (this.type === 'Questionnaire') {
					const score = this.definirScores(item, donnees)
					utilisateurs.push({ identifiant: item.identifiant, nom: item.nom, reponse: item.reponse, score: score, banni: banni })
				} else if (this.type === 'Remue-méninges' || this.type === 'Nuage-de-mots') {
					if (utilisateurs.map((e) => { return e.identifiant }).includes(item.identifiant) === false) {
						utilisateurs.push({ identifiant: item.identifiant, nom: item.nom, reponse: [item.reponse], banni: banni })
					} else {
						utilisateurs.forEach((utilisateur) => {
							if (utilisateur.identifiant === item.identifiant) {
								utilisateur.reponse.push(item.reponse)
								utilisateur.banni = banni
							}
						})
					}
				} else {
					utilisateurs.push({ identifiant: item.identifiant, nom: item.nom, reponse: item.reponse, banni: banni })
				}
			})
			if (utilisateurs.length > 0) {
				const totalQuestions = utilisateurs[0].reponse.length
				if (this.type === 'Sondage') {
					texte += this.$t('identifiant') + ',' + this.$t('nom') + ','
					for (let i = 0; i < totalQuestions; i++) {
						if (i < (totalQuestions - 1)) {
							texte += this.$t('reponse') + ' ' + (i + 1) + ','
						} else {
							texte += this.$t('reponse') + ' ' + (i + 1) + '\n'
						}
					}
					utilisateurs.forEach((utilisateur) => {
						if (utilisateur.banni) {
							texte += utilisateur.identifiant + ',' + utilisateur.nom + ' (' + this.$t('banni') + ') ' + ','
						} else {
							texte += utilisateur.identifiant + ',' + utilisateur.nom + ','
						}
						utilisateur.reponse.forEach((item, indexItem) => {
							item.forEach((reponse, indexReponse) => {
								if ((indexReponse + 1) === item.length) {
									if (typeof reponse === 'string' || reponse instanceof String) {
										texte += reponse.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ')
									} else {
										texte += reponse + '/' + donnees.questions[indexItem].etoiles
									}
								} else {
									texte += reponse.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' | '
								}
							})
							if (indexItem < (totalQuestions - 1)) {
								texte += ','
							} else {
								texte += '\n'
							}
						})
					})
				} else if (this.type === 'Questionnaire') {
					utilisateurs.forEach((utilisateur, index) => {
						let score = 0
						utilisateur.score.forEach((points) => {
							score = score + points
						})
						utilisateurs[index].total = score
					})
					texte += this.$t('identifiant') + ',' + this.$t('nom') + ',' + this.$t('scoreTotal') + ','
					for (let i = 0; i < totalQuestions; i++) {
						if (i < (totalQuestions - 1)) {
							texte += this.$t('reponse') + ' ' + (i + 1) + ','
							texte += this.$t('score') + ' ' + (i + 1) + ','
						} else {
							texte += this.$t('reponse') + ' ' + (i + 1) + ','
							texte += this.$t('score') + ' ' + (i + 1) + '\n'
						}
					}
					utilisateurs.forEach((utilisateur) => {
						if (utilisateur.banni) {
							texte += utilisateur.identifiant + ',' + utilisateur.nom + ' (' + this.$t('banni') + ') ' + ',' + utilisateur.total + ','
						} else {
							texte += utilisateur.identifiant + ',' + utilisateur.nom + ',' + utilisateur.total + ','
						}
						utilisateur.reponse.forEach((item, indexItem) => {
							item.forEach((reponse, indexReponse) => {
								if ((indexReponse + 1) === item.length) {
									texte += reponse.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ')
								} else {
									texte += reponse.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' | '
								}
							})
							texte += ',' + utilisateur.score[indexItem]
							if (indexItem < (totalQuestions - 1)) {
								texte += ','
							} else {
								texte += '\n'
							}
						})
					})
				} else if (this.type === 'Remue-méninges') {
					texte += this.$t('identifiant') + ',' + this.$t('nom') + ','
					const categories = []
					if (donnees.hasOwnProperty('categories')) {
						donnees.categories.forEach((categorie) => {
							if (categorie.texte !== '') {
								categories.push(categorie.texte)
							} else if (categorie.image !== '') {
								categories.push(categorie.image)
							}
						})
					}
					if (categories.length > 0) {
						categories.forEach((categorie, indexCategorie) => {
							if (indexCategorie < (categories.length - 1)) {
								texte += this.$t('categorie') + ' ' + (indexCategorie + 1) + ' - ' + categorie.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ','
							} else {
								texte += this.$t('categorie') + ' ' + (indexCategorie + 1) + ' - ' + categorie.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + '\n'
							}
						})
					} else {
						texte += this.$t('messages') + '\n'
					}
					utilisateurs.forEach((utilisateur) => {
						if (utilisateur.banni) {
							texte += utilisateur.identifiant + ',' + utilisateur.nom + ' (' + this.$t('banni') + ') ' + ','
						} else {
							texte += utilisateur.identifiant + ',' + utilisateur.nom + ','
						}
						if (categories.length > 0) {
							categories.forEach((categorie, indexCategorie) => {
								let messages = ''
								utilisateur.reponse.forEach((item) => {
									if (categorie === item.categorie) {
										if (!item.visible) {
											messages += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('supprime') + ')' + ' | '
										} else if (item.hasOwnProperty('texteoriginal')) {
											messages += item.texteoriginal.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('modifie') + ' : ' + item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ')' + ' | '
										} else {
											messages += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' | '
										}
									}
								})
								if (indexCategorie < (categories.length - 1)) {
									texte += messages.substring(0, messages.length - 3) + ','
								} else {
									texte += messages.substring(0, messages.length - 3) + '\n'
								}
							})
						} else {
							utilisateur.reponse.forEach((item, indexItem) => {
								if ((indexItem + 1) === utilisateur.reponse.length) {
									if (!item.visible) {
										texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('supprime') + ')' + '\n'
									} else if (item.hasOwnProperty('texteoriginal')) {
										texte += item.texteoriginal.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('modifie') + ' : ' + item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ')' + '\n'
									} else {
										texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + '\n'
									}
								} else {
									if (!item.visible) {
										texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('supprime') + ')' + ' | '
									} else if (item.hasOwnProperty('texteoriginal')) {
										texte += item.texteoriginal.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('modifie') + ' : ' + item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ')' + ' | '
									} else {
										texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' | '
									}
								}
							})
						}
					})
				} else if (this.type === 'Nuage-de-mots') {
					texte += this.$t('identifiant') + ',' + this.$t('nom') + ',' + this.$t('mots') + '\n'
					utilisateurs.forEach((utilisateur) => {
						if (utilisateur.banni) {
							texte += utilisateur.identifiant + ',' + utilisateur.nom + ' (' + this.$t('banni') + ') ' + ','
						} else {
							texte += utilisateur.identifiant + ',' + utilisateur.nom + ','
						}
						utilisateur.reponse.forEach((item, indexItem) => {
							if ((indexItem + 1) === utilisateur.reponse.length) {
								if (!item.visible) {
									texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '') + ' (' + this.$t('supprime') + ')' + '\n'
								} else if (item.hasOwnProperty('texteoriginal')) {
									texte += item.texteoriginal.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('modifie') + ' : ' + item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ')' + '\n'
								} else {
									texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '') + '\n'
								}
							} else {
								if (!item.visible) {
									texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '') + ' (' + this.$t('supprime') + ')' + ' | '
								} else if (item.hasOwnProperty('texteoriginal')) {
									texte += item.texteoriginal.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ' (' + this.$t('modifie') + ' : ' + item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '').replace(/\n/g, ' ') + ')' + ' | '
								} else {
									texte += item.texte.replace(/[,]/g, '‚').replace(/[";]/g, '') + ' | '
								}
							}
						})
					})
				}
				const blob = new Blob([texte], { type: 'text/csv;charset=utf-8' })
				let fichier = this.code + '.csv'
				if (session !== '') {
					fichier = this.code + '_' + session + '.csv'
				}
				saveAs(blob, fichier)
				this.notification = this.$t('resultatsExportes')
			} else {
				this.message = this.$t('erreurExportResultat')
			}
		},
		afficherModaleConfirmation (typeConfirmation, session) {
			if (typeConfirmation === 'supprimer-resultat') {
				this.messageConfirmation = this.$t('confirmationSupprimerResultats')
				this.numeroSession = session
			} else if (typeConfirmation === 'supprimer-interaction' && this.type === 'Sondage') {
				this.messageConfirmation = this.$t('confirmationSupprimerSondage')
			} else if (typeConfirmation === 'supprimer-interaction' && this.type === 'Questionnaire') {
				this.messageConfirmation = this.$t('confirmationSupprimerQuestionnaire')
			} else if (typeConfirmation === 'supprimer-interaction' && this.type === 'Remue-méninges') {
				this.messageConfirmation = this.$t('confirmationSupprimerRemueMeninges')
			} else if (typeConfirmation === 'supprimer-interaction' && this.type === 'Nuage-de-mots') {
				this.messageConfirmation = this.$t('confirmationSupprimerNuageDeMots')
			}
			this.modaleConfirmation = typeConfirmation
			this.$nextTick(() => {
				document.querySelector('#modale-confirmation .bouton')?.focus()
			})
		},
		fermerModaleConfirmation () {
			this.modaleConfirmation = ''
			this.messageConfirmation = ''
			this.numeroSession = 0
			this.gererFocus()
		},
		supprimerResultat () {
			this.modaleConfirmation = ''
			this.chargement = true
			axios.post(this.hote + '/api/supprimer-resultat', {
				identifiant: this.identifiant,
				code: this.code,
				session: this.numeroSession
			}).then((reponse) => {
				this.chargement = false
				const donnees = reponse.data
				this.reponses = donnees.reponses
				this.sessions = donnees.sessions
				this.numeroSession = 0
				this.notification = this.$t('resultatsSupprimes')
				if (Object.keys(this.reponses).length === 0) {
					this.fermerModale()
				} else {
					this.$nextTick(() => {
						document.querySelector('#modale-resultats .fermer')?.focus()
					})
				}
				this.fermerModaleConfirmation()
			}).catch((err) => {
				this.chargement = false
				this.fermerModaleConfirmation()
				if (err.response?.data === 'erreur_code') {
					this.message = this.$t('codeNonValide')
				} else if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		definirScore (item, donnees) {
			if (!item) {
				return 0
			}
			return this.definirScores(item, donnees).reduce((scoreTotal, score) => scoreTotal + score, 0)
		},
		definirScores (item, donnees) {
			let scoreTotal = []
			if (item.hasOwnProperty('score') && donnees.options.points !== 'classique') {
				scoreTotal = item.score
			} else if (item && item.hasOwnProperty('reponse') && item.reponse.length > 0) {
				donnees.questions.forEach((question, indexQuestion) => {
					if (item.reponse[indexQuestion]) {
						let score
						const reponseCorrecte = []
						const bonnesReponses = []
						const mauvaisesReponses = []
						if (question.option !== 'texte-court') {
							question.items.forEach((i) => {
								if (i.reponse === true && i.texte !== '') {
									reponseCorrecte.push(i.texte)
								} else if (i.reponse === true && i.image && i.image !== '') {
									reponseCorrecte.push(i.image)
								} else if (i.reponse === true && i.audio && i.audio !== '') {
									reponseCorrecte.push(i.audio)
								}
							})
							question.items.forEach((i) => {
								if (i.reponse === true && (item.reponse[indexQuestion].includes(i.texte) || (i.image && item.reponse[indexQuestion].includes(i.image)) || (i.audio && item.reponse[indexQuestion].includes(i.audio)))) {
									bonnesReponses.push(i)
								} else if (i.reponse === false && (item.reponse[indexQuestion].includes(i.texte) || (i.image && item.reponse[indexQuestion].includes(i.image)) || (i.audio && item.reponse[indexQuestion].includes(i.audio)))) {
									mauvaisesReponses.push(i)
								}
							})
						} else {
							const reponsesTexte = question.reponses.split('|')
							reponsesTexte.forEach((item, index) => {
								reponsesTexte[index] = item.trim()
							})
							reponseCorrecte.push(...reponsesTexte)
							if (reponsesTexte.includes(item.reponse[indexQuestion].toString().trim()) === true) {
								bonnesReponses.push(item.reponse[indexQuestion].toString())
							}
						}
						let multiplicateurSecondes = 10
						if (donnees.options.hasOwnProperty('multiplicateur') && donnees.options.multiplicateur > 0) {
							multiplicateurSecondes = donnees.options.multiplicateur
						}
						if (((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => item.reponse[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)) && donnees.options.points === 'classique' && question.hasOwnProperty('points')) {
							scoreTotal.push(question.points)
						} else if (((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => item.reponse[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)) && donnees.options.points === 'classique' && !question.hasOwnProperty('points')) {
							scoreTotal.push(1000)
						} else if (((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => item.reponse[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)) && donnees.options.points !== 'classique' && question.hasOwnProperty('points')) {
							score = Math.round(question.points - (item.temps[indexQuestion] * multiplicateurSecondes))
							if (score < (question.points / 10)) {
								score = Math.round(question.points / 10)
							}
							scoreTotal.push(score)
						} else if (((question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => item.reponse[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)) && donnees.options.points !== 'classique' && !question.hasOwnProperty('points')) {
							score = Math.round(1000 - (item.temps[indexQuestion] * multiplicateurSecondes))
							if (score < 100) {
								score = 100
							}
							scoreTotal.push(score)
						} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0 && donnees.options.points === 'classique' && question.hasOwnProperty('points')) {
							scoreTotal.push((question.points / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
						} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0 && donnees.options.points === 'classique' && !question.hasOwnProperty('points')) {
							scoreTotal.push((1000 / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
						} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0 && donnees.options.points !== 'classique' && question.hasOwnProperty('points')) {
							let points = Math.round(question.points - (item.temps[indexQuestion] * multiplicateurSecondes))
							if (points < (question.points / 10)) {
								points = Math.round(question.points / 10)
							}
							score = ((points / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
							scoreTotal.push(score)
						} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0 && donnees.options.points !== 'classique' && !question.hasOwnProperty('points')) {
							let points = Math.round(1000 - (item.temps[indexQuestion] * multiplicateurSecondes))
							if (points < 100) {
								points = 100
							}
							score = ((points / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
							scoreTotal.push(score)
						} else {
							scoreTotal.push(0)
						}
					}
				})
			}
			return scoreTotal
		},
		exporter () {
			this.modaleConfirmation = ''
			this.chargement = true
			axios.post(this.hote + '/api/exporter-interaction', {
				identifiant: this.identifiant,
				code: this.code,
				admin: ''
			}).then((reponse) => {
				this.chargement = false
				const donnees = reponse.data
				saveAs('/temp/' + donnees, this.code + '.zip')
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'erreur_donnees') {
					this.message = this.$t('aucuneDonneesExport')
				} else if (err.response?.data === 'erreur_code') {
					this.message = this.$t('codeNonValide')
				} else if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		supprimer () {
			this.modaleConfirmation = ''
			this.chargement = true
			axios.post(this.hote + '/api/supprimer-interaction', {
				identifiant: this.identifiant,
				code: this.code,
				admin: ''
			}).then(() => {
				if (this.role === 'utilisateur') {
					window.location.href = '/u/' + this.identifiant
				} else {
					window.location.replace('/')
				}
				this.fermerModaleConfirmation()
			}).catch((err) => {
				this.chargement = false
				this.fermerModaleConfirmation()
				if (err.response?.data === 'erreur_code') {
					this.message = this.$t('codeNonValide')
				} else if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		seDeconnecter () {
			axios.post(this.hote + '/api/se-deconnecter').then(() => {
				window.location.href = '/'
			}).catch(() => {
				this.message = this.$t('erreurCommunicationServeur')
			})
		},
		seConnecterInteraction () {
			const code = document.querySelector('#code').value
			const motdepasse = this.motDePasseInteraction.trim()
			if (code.trim() !== '' && motdepasse.trim() !== '') {
				this.chargementModale = true
				axios.post(this.hote + '/api/se-connecter-interaction', {
					code: code.trim(),
					motdepasse: motdepasse
				}).then((reponse) => {
					this.chargementModale = false
					const donnees = reponse.data
					this.admin = true
					this.identifiant = donnees.identifiant
					this.nom = donnees.nom
					this.role = donnees.role
					this.motdepasse = motdepasse
					this.donnees = JSON.parse(donnees.donnees)
					this.reponses = JSON.parse(donnees.reponses)
					this.sessions = JSON.parse(donnees.sessions)
					this.digidrive = donnees.digidrive
					if (this.reponses && this.reponses[this.session]) {
						this.reponsesSession = this.reponses[this.session]
					}
					if (this.sessions[this.session] && this.sessions[this.session].hasOwnProperty('donnees')) {
						this.donneesSession = this.sessions[this.session].donnees
					}
					if (this.type === 'Sondage' || this.type === 'Questionnaire') {
						this.indexQuestion = parseInt(this.donnees.indexQuestion)
					}
					this.interactions = donnees.interactions
					this.motDePasseInteraction = ''
					this.$socket.emit('connexion', { code: this.code, identifiant: this.identifiant, nom: this.nom, nomAleatoire: false })
					this.$nextTick(() => {
						this.initialiser()
					})
				}).catch((err) => {
					this.chargementModale = false
					if (err.response?.data === 'erreur') {
						this.message = this.$t('erreurCommunicationServeur')
					} else if (err.response?.data === 'non_autorise') {
						this.message = this.$t('pasAutoriseModifierInteraction')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			} else if (motdepasse === '') {
				this.message = this.$t('indiquerMotDePasse')
			}
		},
		fermerMessage () {
			this.message = ''
			this.gererFocus()
		},
		definirElementPrecedent (element) {
			this.elementPrecedent = element
		},
		gererClavier (event) {
			if (event.key === 'Escape' && this.message !== '') {
				this.fermerMessage()
			} else if (event.key === 'Escape' && this.modaleConfirmation !== '') {
				this.fermerModaleConfirmation()
			} else if (event.key === 'Escape' && this.modale !== '') {
				this.fermerModale()
			} else if (event.key === 'Tab') {
				if (this.message !== '') {
					const modale = document.querySelector('#message')
					this.piegerFocus(event, modale)
				} else if (this.modale !== '' || this.modaleConfirmation !== '') {
					const modale = document.querySelector('.modale')
					this.piegerFocus(event, modale)
				}
			}
		},
		gererFocus () {
			this.$nextTick(() => {
				if (this.elementPrecedent) {
					this.elementPrecedent.focus()
					this.elementPrecedent = null
				}
			})
		},
		piegerFocus (event, conteneur) {
			if (!conteneur) return
			const isVisible = el => el.offsetWidth || el.offsetHeight || el.getClientRects().length
			const focusables = Array.from(conteneur.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled && el.tabIndex >= 0 && isVisible(el))
			if (focusables.length === 0) return
			const premier = focusables[0]
			const dernier = focusables[focusables.length - 1]
			if (event.shiftKey) {
				if (document.activeElement === premier) {
					event.preventDefault()
					dernier.focus()
				}
			} else {
				if (document.activeElement === dernier) {
					event.preventDefault()
					premier.focus()
				}
			}
		},
		ecouterSocket () {
			this.$socket.on('connexion', (donnees) => {
				const utilisateurs = donnees.filter((utilisateur) => {
					return utilisateur.identifiant !== this.identifiant
				})
				utilisateurs.forEach((utilisateur) => {
					utilisateur.connecte = true
					if (this.bannis.includes(utilisateur.identifiant)) {
						utilisateur.banni = true
					} else {
						utilisateur.banni = false
					}
				})
				this.utilisateurs = utilisateurs
			})

			this.$socket.on('deconnexion', (identifiant) => {
				const utilisateurs = this.utilisateurs
				utilisateurs.forEach((utilisateur, index) => {
					if (utilisateur.identifiant === identifiant) {
						utilisateurs.splice(index, 1, { identifiant: utilisateur.identifiant, nom: utilisateur.nom, connecte: false })
					}
				})
				this.utilisateurs = utilisateurs
			})

			this.$socket.on('reponse', (reponse) => {
				if (reponse.code === this.code && reponse.session === this.session) {
					if (this.type === 'Sondage') {
						if (this.reponsesSession.map((e) => { return e.identifiant }).includes(reponse.donnees.identifiant) === true) {
							this.reponsesSession.forEach((item) => {
								if (item.identifiant === reponse.donnees.identifiant) {
									item.reponse = reponse.donnees.reponse
									if (item.nom !== reponse.donnees.nom && reponse.donnees.nom !== '') {
										item.nom = reponse.donnees.nom
									}
								}
							})
						} else {
							this.reponsesSession.push(reponse.donnees)
						}
					} else if (this.type === 'Questionnaire') {
						if (this.reponsesSession.map((e) => { return e.identifiant }).includes(reponse.donnees.identifiant) === true) {
							this.reponsesSession.forEach((item) => {
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
							this.reponsesSession.push(reponse.donnees)
						}
					} else if (this.type === 'Remue-méninges' || this.type === 'Nuage-de-mots') {
						this.reponsesSession.push(reponse.donnees)
					}
				}
			})

			this.$socket.on('reponses', (donnees) => {
				if (donnees.code === this.code && donnees.session === this.session) {
					this.reponsesSession = donnees.reponsesSession
				}
			})

			this.$socket.on('modifiernom', (donnees) => {
				const utilisateurs = this.utilisateurs
				utilisateurs.forEach((utilisateur, index) => {
					if (utilisateur.identifiant === donnees.identifiant) {
						utilisateurs[index].nom = donnees.nom
					}
				})
				this.utilisateurs = utilisateurs
				if (donnees.nom !== '') {
					this.reponsesSession.forEach((item) => {
						if (item.identifiant === donnees.identifiant) {
							item.nom = donnees.nom
						}
					})
					if (this.reponses && this.reponses[this.session] && this.reponses[this.session] !== this.reponsesSession) {
						this.reponses[this.session].forEach((item) => {
							if (item.identifiant === donnees.identifiant) {
								item.nom = donnees.nom
							}
						})
					}
				}
			})

			this.$socket.on('modifiercouleurmot', (donnees) => {
				if (donnees.code === this.code && donnees.session === this.session) {
					this.reponsesSession = donnees.reponsesSession
				}
			})
		}
	}
}
</script>

<style scoped>
#titre.edition .modifier,
#titre.edition .titre {
	cursor: pointer;
}

#parametres {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	font-size: 24px;
	margin-left: 20px;
	line-height: 1;
	cursor: pointer;
}

#parametres span.parametres,
#parametres button.parametres {
	margin-left: 20px;
}

#parametres span.deconnexion,
#parametres button.deconnexion {
	margin-left: 20px;
	color: #ff6259;
	line-height: 1;
}

#titre span.code,
#titre span.titre {
	display: inline-block;
	max-width: calc(100% - 23px);
	overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#titre span.modifier,
#titre button.modifier {
	display: inline-block;
	margin-left: 5px;
	visibility: hidden;
}

#titre:hover span.modifier,
#titre:hover button.modifier {
	visibility: visible;
}

#titre span#exporter-csv,
#titre span#exporter-pdf,
#titre span#afficher,
#titre span#copier,
#titre button#exporter-csv,
#titre button#exporter-pdf,
#titre button#afficher,
#titre button#copier {
	display: inline-block;
	font-size: 24px;
	margin-left: 10px;
	line-height: 1;
	cursor: pointer;
}

.informations {
	display: flex;
	flex-wrap: wrap;
	font-weight: 700;
	border: 2px solid #242f3d;
	border-radius: 0.5em;
	background: #e3e9f0;
	padding: 15px 20px;
}

.informations .code {
	display: flex;
	align-items: center;
	width: 50%;
}

.informations .code.seul {
	width: 100%;
}

.informations .code .information {
	font-family: 'Roboto Slab';
	font-size: 23px;
	line-height: 1;
	user-select: text!important;
	margin-left: 5px;
}

.informations .motdepasse {
	display: flex;
	align-items: center;
	width: 50%;
}

.informations .motdepasse .information {
	font-family: 'Roboto Slab';
	font-size: 20px;
	line-height: 1;
	user-select: text!important;
	margin-left: 5px;
	flex-shrink: 0;
}

.informations .icone {
	display: inline-block;
	font-size: 24px;
	font-weight: 400;
	margin-left: 10px;
	line-height: 1;
	cursor: pointer;
}

.telecharger {
	display: flex;
	justify-content: flex-end;
	font-size: 14px;
	font-weight: 400;
	color: #ffa500;
	margin-top: 7px;
	cursor: pointer;
}

#conteneur.interaction-ouverte {
	overflow: hidden!important;
}

#afficher:active,
#copier:active {
	opacity: 0.7;
}

#interaction footer .section {
	justify-content: space-between;
}

#interaction footer .gauche .bouton.mobile {
	margin-right: 15px;
}

#interaction footer .droite {
	display: flex;
	justify-content: flex-end;
}

#interaction footer .bouton.mobile i {
	display: none;
	font-size: 24px;
}

#interaction footer .bouton.icone.affiche,
#interaction footer .bouton.icone.masque,
#interaction footer .bouton.icone.verrouille {
	color: #ff7b3c;
}

button.utilisateurs {
	cursor: pointer;
}

#modale-confirmation {
	text-align: center;
	max-width: 500px;
}

#modale-lien {
	text-align: center;
	max-width: 1000px;
}

#modale-confirmation .conteneur,
#modale-lien .conteneur {
	padding: 30px 25px;
}

#modale-lien p {
	font-family: 'Roboto Slab';
	font-size: 7rem;
	font-weight: 400;
	word-break: break-all;
}

#modale-resultats {
	max-width: 500px;
    height: 400px;
    max-height: 90%;
}

#modale-resultats .resultat {
	display: flex;
	justify-content: space-between;
    align-items: center;
	padding: 5px 10px;
    background: #eee;
    border-radius: 4px;
    margin-bottom: 10px;
}

#modale-resultats .session {
	width: calc(100% - 67px);
}

#modale-resultats .actions {
	display: flex;
	margin-left: 11px;
}

#modale-resultats .actions span,
#modale-resultats .actions button {
	display: inline-block;
	margin-left: 15px;
	line-height: 1;
}

#modale-resultats .actions i {
	font-size: 24px;
	color: #242f3d;
	cursor: pointer;
}

#modale-resultats .resultat .actions i.supprimer {
	color: #ff6259;
}

#modale-classement.avec-footer {
	max-width: 700px;
	height: 380px;
    max-height: 90%;
}

#modale-classement.avec-footer .conteneur {
    height: calc(100% - 110px);
}

#modale-parametres .actions span,
#modale-parametres .actions button {
	width: 100%;
}

#modale-parametres .actions span,
#modale-parametres .actions button {
	margin-bottom: 20px;
}

#modale-parametres .actions span.supprimer,
#modale-parametres .actions button.supprimer {
	color: #fff;
	background: #ff6259;
	text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.3);
	margin-bottom: 0;
}

#modale-parametres .actions span.supprimer:hover,
#modale-parametres .actions button.supprimer:hover {
	background: #d70b00;
}

#modale-parametres .actions span.exporter,
#modale-parametres .actions button.exporter {
	margin-bottom: 0;
}

#modale-parametres .conteneur p {
    font-size: 14px;
    margin-bottom: 15px;
}

#modale-parametres .langue:last-of-type {
	margin-bottom: 0;
}

#modale-utilisateurs h2 {
	display: block;
	width: 100%;
    font-weight: 700;
    font-size: 16px;
    margin-bottom: 15px;
	line-height: 1;
}

#modale-codeqr {
	max-height: 90%;
	overflow: auto;
}

#modale-codeqr header {
	position: sticky;
	top: 0;
	background-color: #fff;
	z-index: 10;
}

#modale-codeqr .conteneur {
	height: auto!important;
	overflow: initial!important;
}

#modale-codeqr .contenu {
	text-align: center;
}

#modale-codeqr p {
	line-height: 1;
	font-weight: 700;
}

#modale-codeqr #qr {
	display: inline-block;
}

@media screen and (max-width: 359px) {
	.telecharger {
		font-size: 12px;
	}
}

@media screen and (max-width: 479px) {
	#interaction footer .bouton.mobile i {
		display: block;
	}

	#interaction footer .bouton.mobile span {
		display: none;
	}

	#modale-lien p {
		font-size: 3rem!important;
	}
}

@media screen and (orientation: landscape) and (max-height: 479px) {
	#modale-parametres {
		height: 90%;
	}
}

@media screen and (max-width: 359px) {
	.informations .code .information {
		font-size: 18px;
	}

	.informations .motdepasse .information {
		font-size: 16px;
	}
}

@media screen and (max-width: 399px) {
	#titre span#exporter-csv,
	#titre span#exporter-pdf {
		display: none;
	}
}

@media screen and (max-width: 599px) {
	.informations .code {
		width: 100%;
		margin-bottom: 5px;
	}

	.informations .motdepasse {
		width: 100%;
	}
}

@media screen and (max-width: 767px) {
	.informations .motdepasse,
	.informations .code {
		font-size: 14px;
	}

	#modale-lien p {
		font-size: 5rem;
	}
}
</style>

<style>
#modale-codeqr #qr img {
	max-width: 100%;
	height: auto;
	max-height: 60vh;
}
</style>
