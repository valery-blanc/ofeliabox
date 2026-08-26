<template>
	<div id="questionnaire" :class="{'avec-actions': options.progression === 'animateur'}">
		<div id="attente" v-if="statut === 'attente'">
			<h2>{{ $t('questionnaireEnAttenteDemarrage') }}</h2>
			<div class="info-attente" v-html="$t('infoQuestionnaireEnAttenteDemarrage')" />
			<div class="points">
				<span class="point" />
				<span class="point" />
				<span class="point" />
			</div>
			<h2 v-if="options.nom === 'obligatoire'">{{ $t('listeParticipants') }}</h2>
			<div class="utilisateurs-connectes" v-if="options.nom === 'obligatoire' && utilisateursConnectes.length > 0">
				<template v-for="(utilisateur, indexUtilisateur) in utilisateursConnectes">
					<div class="utilisateur" v-if="utilisateur.nom !== ''" :key="'utilisateur_connecte_' + indexUtilisateur">
						<button type="button" class="bannir" :disabled="disabled" :title="$t('bannirParticipant')" :aria-label="$t('bannirParticipant')" @click="parent.bannir(utilisateur.identifiant)"><i class="material-icons" aria-hidden="true">block</i></button>
						<span>{{ utilisateur.nom }}</span>
					</div>
				</template>
			</div>
			<div class="vide" v-else-if="options.nom === 'obligatoire' && utilisateursConnectes.length === 0">
				{{ $t('aucunParticipant') }}
			</div>
			<h2 v-if="options.nom === 'obligatoire' && utilisateursBannis.length > 0">{{ $t('listeParticipantsBannis') }}</h2>
			<div class="utilisateurs-bannis" v-if="options.nom === 'obligatoire' && utilisateursBannis.length > 0">
				<template v-for="(utilisateur, indexUtilisateur) in utilisateursBannis">
					<div class="utilisateur" v-if="utilisateur.nom !== ''" :key="'utilisateur_banni_' + indexUtilisateur">
						<button type="button" class="bannir" :disabled="disabled" :title="$t('autoriserParticipant')" :aria-label="$t('autoriserParticipant')" @click="parent.autoriser(utilisateur.identifiant)"><i class="material-icons" aria-hidden="true">check_circle</i></button>
						<span>{{ utilisateur.nom }}</span>
					</div>
				</template>
			</div>
		</div>

		<div id="tableau" v-if="(statut === 'ouvert' || statut === 'verrouille') && (options.progression === 'libre' || tableauResultats === true)">
			<div class="tableau">
				<h2>{{ $t('tableauResultats') }}</h2>
				<table>
					<thead>
						<tr>
							<td class="utilisateurs">
								<button type="button" :disabled="disabled" @click="cacherNoms" v-if="nomsVisible">{{ $t('cacherNoms') }}</button>
								<button type="button" :disabled="disabled" @click="afficherNoms" v-else>{{ $t('afficherNoms') }}</button>
								<select v-model="triTableau" :disabled="disabled">
									<option value="nom">{{ $t('nomOuPseudo') }}</option>
									<option value="score">{{ $t('score') }}</option>
									<option value="progression">{{ $t('progression') }}</option>
								</select>
							</td>
							<td class="score">
								<span>{{ $t('points') }}</span>
							</td>
							<td class="question" v-if="description !== '' || Object.keys(support).length > 0">
								<span class="index">&nbsp;</span>
								<button type="button" class="type" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" @click="afficherSupport">
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00ced1" width="24" height="24" aria-hidden="true"><path d="M0 0h24v24H0z" fill="none" /><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>
								</button>
							</td>
							<td class="question" v-for="(q, indexQ) in questions" :key="'question_' + indexQ">
								<span class="index">{{ indexQ + 1 }}</span>
								<button type="button" class="type" :disabled="disabled" :title="$t('afficherQuestion')" :aria-label="$t('afficherQuestion')" @click="afficherQuestion(q, indexQ)" v-if="q.option === 'choix-unique'">
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32" aria-hidden="true"><path fill="#00ced1" d="M1.333 30.667h29.333V1.334H1.333v29.333zM0 0h32v32H0V0z" /><path fill="#00ced1" d="M5.333 8A2.66 2.66 0 018 5.333 2.66 2.66 0 0110.667 8 2.66 2.66 0 018 10.667 2.66 2.66 0 015.333 8zm1.334 8c0 .742.593 1.333 1.333 1.333.742 0 1.333-.593 1.333-1.333 0-.742-.593-1.333-1.333-1.333-.742 0-1.333.593-1.333 1.333zm-1.334 0A2.66 2.66 0 018 13.333 2.66 2.66 0 0110.667 16 2.66 2.66 0 018 18.667 2.66 2.66 0 015.333 16zm1.334 8c0 .742.593 1.333 1.333 1.333.742 0 1.333-.593 1.333-1.333 0-.742-.593-1.333-1.333-1.333-.742 0-1.333.593-1.333 1.333zm-1.334 0A2.66 2.66 0 018 21.333 2.66 2.66 0 0110.667 24 2.66 2.66 0 018 26.667 2.66 2.66 0 015.333 24zm8-14.667h13.333V6.666H13.333zm0 8h13.333v-2.667H13.333zm0 8h13.333v-2.667H13.333z" /></svg>
								</button>
								<button type="button" class="type" :disabled="disabled" :title="$t('afficherQuestion')" :aria-label="$t('afficherQuestion')" @click="afficherQuestion(q, indexQ)" v-else-if="q.option === 'choix-multiples'">
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32" aria-hidden="true"><path fill="#00ced1" d="M1.333 30.667h29.333V1.334H1.333v29.333zM0 0h32v32H0V0z" /><path fill="#00ced1" d="M13.333 9.333h13.333V6.666H13.333zm0 8h13.333v-2.667H13.333zm0 8h13.333v-2.667H13.333zM6.667 6.667v2.667h2.667V6.667H6.667zM5.333 5.333h5.333v5.333H5.333V5.333zm0 8h5.333v5.333H5.333zm0 8h5.333v5.333H5.333z" /></svg>
								</button>
								<button type="button" class="type" :disabled="disabled" :title="$t('afficherQuestion')" :aria-label="$t('afficherQuestion')" @click="afficherQuestion(q, indexQ)" v-else-if="q.option === 'texte-court'">
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="#00ced1" d="M1 23h22V1H1v22zM0 0h24v24H0V0z"></path><path fill="#00ced1" d="M16 9H4v2h12V9zm0-3H4v1h12V6zM4 14h8v-1H4v1zm0 3h8v-1H4v1zm8.002 2.125V21h1.875l5.53-5.53-1.875-1.874-5.53 5.53zm8.854-5.104a.498.498 0 000-.705l-1.17-1.17a.498.498 0 00-.704 0l-.915.915 1.874 1.875.915-.915z"></path></svg>
								</button>
							</td>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(u, indexU) in utilisateursTableau" :key="'utilisateur_' + indexU">
							<td class="utilisateur">
								<span class="nom" v-if="((options.nom === 'obligatoire') || (options.nom !== 'obligatoire' && u.nom !== '')) && nomsVisible">{{ u.nom }}</span>
								<span class="masque" v-else-if="!nomsVisible" />
								<span class="nom" v-else-if="options.nom !== 'obligatoire' && nomsVisible && u.nom === ''">{{ $t('participant') }} {{ indexU + 1 }}</span>
							</td>
							<td class="score">
								{{ definirScore(u.identifiant) }}
							</td>
							<td class="question" v-if="description !== '' || Object.keys(support).length > 0">
								<span>-</span>
							</td>
							<td class="question" :class="{'correct': definirReponseQuestion(u.identifiant, indexQ).bonneReponse === true, 'partiellement-correct': definirReponseQuestion(u.identifiant, indexQ).reponsePartielle === true, 'incorrect': definirReponseQuestion(u.identifiant, indexQ).bonneReponse === false && definirReponseQuestion(u.identifiant, indexQ).reponsePartielle === false && definirReponseQuestion(u.identifiant, indexQ).reponses > 0}" v-for="(q, indexQ) in questions" :key="'question_' + indexQ">
								<span v-if="definirReponseQuestion(u.identifiant, indexQ).bonneReponse === true || definirReponseQuestion(u.identifiant, indexQ).reponsePartielle === true"><i class="material-icons" aria-hidden="true">done</i></span>
								<span v-else-if="definirReponseQuestion(u.identifiant, indexQ).bonneReponse === false && definirReponseQuestion(u.identifiant, indexQ).reponses > 0"><i class="material-icons" aria-hidden="true">close</i></span>
								<span v-else>-</span>
								<span class="points">{{ definirReponseQuestion(u.identifiant, indexQ).score }}</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<div class="questionnaire" v-else-if="(statut === 'ouvert' || statut === 'verrouille') && options.progression === 'animateur'">
			<div id="progression" v-if="indexQuestion > -1 && questions.length > 1">
				{{ $t('question') }} {{ indexQuestion + 1 }} / {{ questions.length }}
			</div>
			<div id="progression" v-else-if="indexQuestion === -1 && description !=='' && Object.keys(support).length === 0">
				{{ $t('description') }}
			</div>
			<div id="progression" v-else-if="indexQuestion === -1 && description ==='' && Object.keys(support).length > 0">
				{{ $t('support') }}
			</div>
			<div id="progression" v-else-if="indexQuestion === -1 && description !=='' && Object.keys(support).length > 0">
				{{ $t('descriptionEtSupport') }}
			</div>

			<div id="support" v-if="indexQuestion > -1 && Object.keys(support).length > 0">
				<button type="button" class="bouton" :disabled="disabled" @click="afficherMedia">{{ $t('afficherSupport') }}</button>
			</div>

			<div id="description" v-if="description !== '' || Object.keys(support).length > 0" v-show="indexQuestion === -1">
				<div class="description" v-if="description !== ''" v-html="formaterHTML(description)" />
				<div class="support" v-if="Object.keys(support).length > 0">
					<button type="button" class="support" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" v-if="support.type === 'image'" @click="afficherImage($event, definirCheminFichier(support.fichier), support.alt)"><img :src="definirCheminFichier(support.fichier)" :alt="support.alt"></button>
					<audio v-else-if="support.type === 'audio'" controls :src="definirCheminFichier(support.fichier)" />
					<div class="video" v-else-if="support.type === 'video'">
						<iframe :src="support.lien" allow="autoplay; fullscreen" />
					</div>
				</div>
			</div>

			<div id="questions" aria-live="polite" :class="{'avec-progression': indexQuestion > -1 && questions.length > 1}">
				<TransitionGroup name="fondu">
					<div class="q" v-for="(q, indexQ) in questions" v-show="indexQuestion === indexQ" :key="'q_' + indexQ">
						<div :id="'question' + indexQ">
							<div class="question-et-image" v-if="q.question !== '' && Object.keys(q.support).length > 0 && q.support.image && q.support.image !== ''">
								<span class="question" v-html="formaterHTML(q.question)" />
								<button type="button" class="support" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(q.support.image), q.support.alt)"><img :src="definirCheminFichier(q.support.image)" :alt="q.support.alt"></button>
							</div>
							<div class="question-et-audio" v-else-if="q.question !== '' && Object.keys(q.support).length > 0 && q.support.audio && q.support.audio !== ''">
								<div class="question" v-html="formaterHTML(q.question)" />
								<audio controls :src="definirCheminFichier(q.support.audio)" />
							</div>
							<div class="question" v-else-if="q.question !== ''" v-html="formaterHTML(q.question)" />
							<div class="support" v-else-if="Object.keys(q.support).length > 0">
								<button type="button" class="support" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" v-if="q.support.image && q.support.image !== ''" @click="afficherImage($event, definirCheminFichier(q.support.image), q.support.alt)"><img :src="definirCheminFichier(q.support.image)" :alt="q.support.alt"></button>
								<audio controls :src="definirCheminFichier(q.support.audio)" v-else-if="q.support.audio && q.support.audio !== ''" />
							</div>
						</div>

						<div :id="'items' + indexQ" class="items resultats" v-if="resultats && q.option !== 'texte-court'">
							<template v-for="(item, index) in q.items">
								<div :id="'item' + indexQ + '_' + index" class="item" :class="{'reponse': statistiques[indexQ].pourcentages[index] > 0, 'correct': reponseVisible && item.reponse, 'audio-et-texte': verifierItemAudioTexte(item) === true}" v-if="verifierItem(item) === true" :key="'item_' + indexQ + '_' + index">
									<div class="progression" :style="{'width': statistiques[indexQ].pourcentages[index] + '%'}" />
									<div class="contenu">
										<span class="index">{{ alphabet[index].toUpperCase() }}</span>
										<button type="button" class="image" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(item.image), item.alt)" v-if="item.image && item.image !== ''"><img :src="definirCheminFichier(item.image)" :alt="item.alt"></button>
										<span class="audio" v-else-if="item.audio && item.audio !== ''"><audio controls :src="definirCheminFichier(item.audio)" /></span>
										<span class="texte" v-if="item.texte !== ''">{{ item.texte }}</span>
									</div>
									<div class="statistiques">
										<button type="button" class="personnes curseur" :disabled="disabled" :title="$t('afficherListeRepondants')" :aria-label="$t('afficherListeRepondants')" @click="afficherModaleListe(statistiques[indexQ].liste[index])" v-if="options.nom === 'obligatoire' && statistiques[indexQ].personnes[index] > 0">{{ statistiques[indexQ].personnes[index] }} <i class="material-icons" aria-hidden="true">person</i></button>
										<span class="personnes" :aria-label="statistiques[indexQ].personnes[index] + ' ' + $t('repondants')" v-else>{{ statistiques[indexQ].personnes[index] }} <i class="material-icons" aria-hidden="true">person</i></span>
										<span class="pourcentages">{{ statistiques[indexQ].pourcentages[index] }}%</span>
									</div>
								</div>
							</template>
						</div>
						<div :id="'items' + indexQ" class="items" v-else-if="!resultats && q.option !== 'texte-court'">
							<div :id="'item' + indexQ + '_' + index" class="item" v-for="(item, index) in q.items" :class="{'correct': reponseVisible && item.reponse, 'audio-et-texte': verifierItemAudioTexte(item) === true}" :key="'item_' + indexQ + '_' + index">
								<span class="index">{{ alphabet[index].toUpperCase() }}</span>
								<button type="button" class="image" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(item.image), item.alt)" v-if="item.image && item.image !== ''"><img :src="definirCheminFichier(item.image)" :alt="item.alt"></button>
								<span class="audio" v-else-if="item.audio && item.audio !== ''"><audio controls :src="definirCheminFichier(item.audio)" /></span>
								<span class="texte" v-if="item.texte !== ''">{{ item.texte }}</span>
							</div>
						</div>
						<div :id="'items' + indexQ" class="items resultats" v-else-if="resultats && q.option === 'texte-court'">
							<template v-for="(item, index) in definirItemsTexte(indexQ).reponses">
								<div :id="'item' + indexQ + '_reponse_' + index" class="item correct" v-if="reponseVisible" :key="'item_reponse_' + indexQ + '_' + index">
									<div class="progression" :style="{'width': '0%'}" />
									<div class="contenu">
										<span class="index"></span>
										<span class="texte">{{ item }}</span>
									</div>
									<div class="statistiques">
										<span class="personnes">0 <i class="material-icons" aria-hidden="true">person</i></span>
										<span class="pourcentages">0%</span>
									</div>
								</div>
							</template>
							<div :id="'item' + indexQ + '_utilisateur_' + index" class="item" v-for="(item, index) in definirItemsTexte(indexQ).utilisateur" :class="{'reponse': statistiques[indexQ].pourcentages[index] > 0, 'correct': reponseVisible && verifierReponseTexte(q, item) === true}" :key="'item_utilisateur_' + indexQ + '_' + index">
								<div class="progression" :style="{'width': statistiques[indexQ].pourcentages[index] + '%'}" />
								<div class="contenu">
									<span class="index">{{ index + 1 }}</span>
									<span class="texte">{{ item }}</span>
								</div>
								<div class="statistiques">
									<button type="button" class="personnes curseur" :disabled="disabled" :title="$t('afficherListeRepondants')" :aria-label="$t('afficherListeRepondants')" @click="afficherModaleListe(statistiques[indexQ].liste[index])" v-if="(options.progression === 'animateur' || options.nom === 'obligatoire') && statistiques[indexQ].personnes[index] > 0">{{ statistiques[indexQ].personnes[index] }} <i class="material-icons" aria-hidden="true">person</i></button>
									<span class="personnes" :aria-label="statistiques[indexQ].personnes[index] + ' ' + $t('repondants')" v-else>{{ statistiques[indexQ].personnes[index] }} <i class="material-icons" aria-hidden="true">person</i></span>
									<span class="pourcentages">{{ statistiques[indexQ].pourcentages[index] }}%</span>
								</div>
							</div>
						</div>
						<div :id="'items' + indexQ" class="items" v-else-if="!resultats && q.option === 'texte-court'">
							<template v-for="(item, index) in definirItemsTexte(indexQ).reponses">
								<div :id="'item' + indexQ + '_reponse_' + index" class="item correct" v-if="reponseVisible" :key="'item_reponse_' + indexQ + '_' + index">
									<span class="index"></span>
									<span class="texte">{{ item }}</span>
								</div>
							</template>
							<div :id="'item' + indexQ + '_utilisateur_' + index" class="item" v-for="(item, index) in definirItemsTexte(indexQ).utilisateur" :class="{'correct': reponseVisible && verifierReponseTexte(q, item) === true}" :key="'item_utilisateur_' + indexQ + '_' + index">
								<span class="index">{{ index + 1 }}</span>
								<span class="texte">{{ item }}</span>
							</div>
						</div>
					</div>
				</TransitionGroup>
			</div>
		</div>

		<div id="actions" v-if="options.progression === 'animateur'">
			<div class="section">
				<button type="button" class="bouton" :disabled="disabled" @click="$emit('demarrer')" v-if="statut === 'attente'">{{ $t('demarrerQuestionnaire') }}</button>

				<Rebours :date="date" :temps="parseInt(questions[indexQuestion].temps)" :indexQuestion="indexQuestion" @tempsEcoule="afficherReponse" v-if="statut === 'ouvert' && options.hasOwnProperty('tempsReponse') && options.tempsReponse === true && indexQuestion > -1 && date > 0" />

				<button type="button" class="bouton" :disabled="disabled" @click="modifierIndexQuestion" v-if="(statut === 'ouvert' || statut === 'verrouille') && indexQuestion === -1 && options.classement === true">{{ $t('suivant') }}</button>

				<button type="button" class="bouton" :disabled="disabled" @click="modifierIndexQuestion" v-else-if="(statut === 'ouvert' || statut === 'verrouille') && indexQuestion < (questions.length - 1) && options.classement === false">{{ $t('suivant') }}</button>

				<button type="button" class="bouton" :disabled="disabled" @click="afficherClassement" v-else-if="(statut === 'ouvert' || statut === 'verrouille') && indexQuestion < (questions.length - 1) && options.classement === true">{{ $t('suivant') }}</button>

				<button type="button" class="bouton" :disabled="disabled" @click="afficherClassement" v-else-if="(statut === 'ouvert' || statut === 'verrouille') && indexQuestion === (questions.length - 1) && options.classement === true">{{ $t('podium') }}</button>

				<button type="button" class="bouton" :disabled="disabled" @click="afficherResultats" v-if="(statut === 'ouvert' || statut === 'verrouille') && indexQuestion === (questions.length - 1) && !tableauResultats">{{ $t('tableauResultats') }}</button>

				<button type="button" class="bouton" :disabled="disabled" @click="afficherResultats" v-if="(statut === 'ouvert' || statut === 'verrouille') && indexQuestion === (questions.length - 1) && tableauResultats">{{ $t('retour') }}</button>
			</div>
		</div>

		<div class="conteneur-modale" v-if="modaleQuestion">
			<div id="modale-question" class="modale" role="dialog">
				<header>
					<span class="titre" v-if="indexQuestionTableau === -1 && description !== '' && Object.keys(support).length === 0">{{ $t('description') }}</span>
					<span class="titre" v-else-if="indexQuestionTableau === -1 && description === '' && Object.keys(support).length > 0">{{ $t('support') }}</span>
					<span class="titre" v-else-if="indexQuestionTableau === -1 && description !== '' && Object.keys(support).length > 0">{{ $t('descriptionEtSupport') }}</span>
					<span class="titre" v-else>{{ $t('question') }} {{ indexQuestionTableau + 1 }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleQuestion"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" v-if="donneesQuestion.type === 'question'">
						<div id="question">
							<div class="question-et-image" v-if="donneesQuestion.question !== '' && Object.keys(donneesQuestion.support).length > 0 && donneesQuestion.support.image && donneesQuestion.support.image !== ''">
								<span class="question" v-html="formaterHTML(donneesQuestion.question)" />
								<button type="button" class="support" :disabled="disabledModale" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(donneesQuestion.support.image), donneesQuestion.support.alt)"><img :src="definirCheminFichier(donneesQuestion.support.image)" :alt="donneesQuestion.support.alt"></button>
							</div>
							<div class="question-et-audio" v-else-if="donneesQuestion.question !== '' && Object.keys(donneesQuestion.support).length > 0 && donneesQuestion.support.audio && donneesQuestion.support.audio !== ''">
								<div class="question" v-html="formaterHTML(donneesQuestion.question)" />
								<audio controls :src="definirCheminFichier(donneesQuestion.support.audio)" />
							</div>
							<div class="question" v-else-if="donneesQuestion.question !== ''" v-html="formaterHTML(donneesQuestion.question)" />
							<div class="support" v-else-if="Object.keys(donneesQuestion.support).length > 0">
								<button type="button" class="support" :disabled="disabledModale" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" v-if="donneesQuestion.support.image && donneesQuestion.support.image !== ''" @click="afficherImage($event, definirCheminFichier(donneesQuestion.support.image), donneesQuestion.support.alt)"><img :src="definirCheminFichier(donneesQuestion.support.image)" :alt="donneesQuestion.support.alt"></button>
								<audio controls :src="definirCheminFichier(donneesQuestion.support.audio)" v-else-if="donneesQuestion.support.audio && donneesQuestion.support.audio !== ''" />
							</div>
						</div>

						<div id="items" class="items resultats" v-if="resultatsVisiblesModale && donneesQuestion.option !== 'texte-court'">
							<div :id="'m_item' + index" class="item" v-for="(item, index) in donneesQuestion.items" :class="{'reponse': statistiques[indexQuestionTableau].pourcentages[index] > 0, 'correct': reponseVisibleModale && item.reponse, 'audio-et-texte': verifierItemAudioTexte(item) === true}" :key="'m_item_' + index">
								<div class="progression" :style="{'width': statistiques[indexQuestionTableau].pourcentages[index] + '%'}" />
								<div class="contenu">
									<span class="index">{{ alphabet[index].toUpperCase() }}</span>
									<button type="button" class="image" :disabled="disabledModale" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(item.image), item.alt)" v-if="item.image && item.image !== ''"><img :src="definirCheminFichier(item.image)" :alt="item.alt"></button>
									<span class="audio" v-else-if="item.audio && item.audio !== ''"><audio controls :src="definirCheminFichier(item.audio)" /></span>
									<span class="texte" v-if="item.texte !== ''">{{ item.texte }}</span>
								</div>
								<div class="statistiques">
									<span class="personnes" :aria-label="statistiques[indexQuestionTableau].personnes[index] + ' ' + $t('repondants')">{{ statistiques[indexQuestionTableau].personnes[index] }} <i class="material-icons" aria-hidden="true">person</i></span>
									<span class="pourcentages">{{ statistiques[indexQuestionTableau].pourcentages[index] }}%</span>
								</div>
							</div>
						</div>

						<div id="items" class="items" v-else-if="!resultatsVisiblesModale && donneesQuestion.option !== 'texte-court'">
							<div :id="'m_item_' + index" class="item" v-for="(item, index) in donneesQuestion.items" :class="{'correct': reponseVisibleModale && item.reponse, 'audio-et-texte': verifierItemAudioTexte(item) === true}" :key="'m_item_' + index">
								<span class="index">{{ alphabet[index].toUpperCase() }}</span>
								<button type="button" class="image" :disabled="disabledModale" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(item.image), item.alt)" v-if="item.image && item.image !== ''"><img :src="definirCheminFichier(item.image)" :alt="item.alt"></button>
								<span class="audio" v-else-if="item.audio && item.audio !== ''"><audio controls :src="definirCheminFichier(item.audio)" /></span>
								<span class="texte" v-if="item.texte !== ''">{{ item.texte }}</span>
							</div>
						</div>

						<div id="items" class="items resultats" v-else-if="resultatsVisiblesModale && donneesQuestion.option === 'texte-court'">
							<template v-for="(item, index) in definirItemsTexte(indexQuestionTableau).reponses">
								<div :id="'m_item_reponse_' + index" class="item correct" v-if="reponseVisibleModale" :key="'m_item_reponse_' + index">
									<div class="progression" :style="{'width': '0%'}" />
									<div class="contenu">
										<span class="index"></span>
										<span class="texte">{{ item }}</span>
									</div>
									<div class="statistiques">
										<span class="personnes">0 <i class="material-icons" aria-hidden="true">person</i></span>
										<span class="pourcentages">0%</span>
									</div>
								</div>
							</template>
							<div :id="'m_item_utilisateur_' + index" class="item" v-for="(item, index) in definirItemsTexte(indexQuestionTableau).utilisateur" :class="{'reponse': statistiques[indexQuestionTableau].pourcentages[index] > 0, 'correct': reponseVisibleModale && verifierReponseTexte(donneesQuestion, item) === true}" :key="'m_item_utilisateur_' + index">
								<div class="progression" :style="{'width': statistiques[indexQuestionTableau].pourcentages[index] + '%'}" />
								<div class="contenu">
									<span class="index">{{ index + 1 }}</span>
									<span class="texte">{{ item }}</span>
								</div>
								<div class="statistiques">
									<span class="personnes" :aria-label="statistiques[indexQuestionTableau].personnes[index] + ' ' + $t('repondants')">{{ statistiques[indexQuestionTableau].personnes[index] }} <i class="material-icons" aria-hidden="true">person</i></span>
									<span class="pourcentages">{{ statistiques[indexQuestionTableau].pourcentages[index] }}%</span>
								</div>
							</div>
						</div>

						<div id="items" class="items" v-else-if="!resultatsVisiblesModale && donneesQuestion.option === 'texte-court'">
							<template v-for="(item, index) in definirItemsTexte(indexQuestionTableau).reponses">
								<div :id="'m_item_reponse_' + index" class="item correct" v-if="reponseVisibleModale" :key="'m_item_reponse_' + index">
									<span class="index"></span>
									<span class="texte">{{ item }}</span>
								</div>
							</template>
							<div :id="'m_item_utilisateur_' + index" class="item" v-for="(item, index) in definirItemsTexte(indexQuestionTableau).utilisateur" :class="{'correct': reponseVisibleModale && verifierReponseTexte(donneesQuestion, item) === true}" :key="'m_item_utilisateur_' + index">
								<span class="index">{{ index + 1 }}</span>
								<span class="texte">{{ item }}</span>
							</div>
						</div>
					</div>
					<div class="contenu" v-else>
						<div id="description">
							<div class="description" v-if="description !== ''" v-html="formaterHTML(description)" />
							<div class="support" v-if="Object.keys(support).length > 0">
								<button type="button" class="support" :disabled="disabledModale" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" v-if="support.type === 'image'" @click="afficherImage($event, definirCheminFichier(support.fichier), support.alt)"><img :src="definirCheminFichier(support.fichier)" :alt="support.alt"></button>
								<audio v-else-if="support.type === 'audio'" controls :src="definirCheminFichier(support.fichier)" />
								<div class="video" v-else-if="support.type === 'video'">
									<iframe :src="support.lien" allow="autoplay; fullscreen" />
								</div>
							</div>
						</div>
					</div>
				</div>
				<footer class="footer">
					<button type="button" class="bouton icone" :disabled="disabledModale" :title="$t('questionPrecedente')" :aria-label="$t('questionPrecedente')" :class="{'invisible': (indexQuestionTableau === -1 && (description !== '' || Object.keys(support).length > 0)) || (indexQuestionTableau === 0 && description === '' && Object.keys(support).length === 0)}" @click="modifierIndexQuestionTableau('precedente')"><i class="material-icons" aria-hidden="true">arrow_back</i></button>

					<button type="button" class="bouton icone" :disabled="disabledModale" :title="$t('afficherReponse')" :aria-label="$t('afficherReponse')" @click="reponseVisibleModale = true" v-if="!reponseVisibleModale && indexQuestionTableau > -1"><i class="material-icons" aria-hidden="true">unpublished</i></button>
					<button type="button" class="bouton icone affiche" :disabled="disabledModale" :title="$t('masquerReponse')" :aria-label="$t('masquerReponse')" @click="reponseVisibleModale = false" v-else-if="reponseVisibleModale && indexQuestionTableau > -1"><i class="material-icons" aria-hidden="true">check_circle</i></button>

					<button type="button" class="bouton icone" :disabled="disabledModale" :title="$t('afficherResultats')" :aria-label="$t('afficherResultats')" @click="resultatsVisiblesModale = true" v-if="!resultatsVisiblesModale && indexQuestionTableau > -1"><i class="material-icons" aria-hidden="true">visibility_off</i></button>
					<button type="button" class="bouton icone affiche" :disabled="disabledModale" :title="$t('masquerResultats')" :aria-label="$t('masquerResultats')" @click="resultatsVisiblesModale = false" v-else-if="resultatsVisiblesModale && indexQuestionTableau > -1"><i class="material-icons" aria-hidden="true">visibility</i></button>

					<button type="button" class="bouton icone" :disabled="disabledModale" :title="$t('questionSuivante')" :aria-label="$t('questionSuivante')" :class="{'invisible': indexQuestionTableau === (questions.length - 1)}" @click="modifierIndexQuestionTableau('suivante')"><i class="material-icons" aria-hidden="true">arrow_forward</i></button>
				</footer>
			</div>
		</div>

		<div class="conteneur-modale" v-if="modale === 'liste'">
			<div id="modale-liste" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('listeRepondants') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleListe"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu">
						<div class="liste">
							{{ liste }}
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'image'">
			<div id="modale-image" class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<img :src="image" :alt="alt">
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleImage">{{ $t('fermer') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'media'">
			<div id="modale-media" class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<img v-if="support.type === 'image'" :src="definirCheminFichier(support.fichier)" :alt="support.alt">
						<audio v-else-if="support.type === 'audio'" controls :src="definirCheminFichier(support.fichier)" />
						<div class="video" v-else-if="support.type === 'video'">
							<iframe :src="support.lien" allow="autoplay; fullscreen" />
						</div>
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleMedia">{{ $t('fermer') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import Rebours from '#root/components/rebours.vue'
import methodes from '#root/components/js/methodes-multi-afficher'

export default {
	name: 'DigistormQuestionnaireAfficher',
	inject: ['parent'],
	components: {
		Rebours
	},
	extends: methodes,
	props: {
		code: String,
		donnees: Object,
		donneesSession: Object,
		reponses: Array,
		statut: String,
		resultats: Boolean,
		utilisateursConnectes: Array,
		utilisateursBannis: Array,
		bannis: Array,
		classement: Array,
		indexQuestion: Number,
		reponseVisible: Boolean,
		date: Number
	},
	data () {
		return {
			description: '',
			support: {},
			options: {},
			questions: [],
			tableauResultats: false,
			modale: '',
			image: '',
			alphabet: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'],
			modaleQuestion: false,
			donneesQuestion: {},
			indexQuestionTableau: -1,
			reponseVisibleModale: false,
			resultatsVisiblesModale: false,
			triTableau: 'nom',
			nomsVisible: true,
			liste: '',
			elementPrecedent: null
		}
	},
	computed: {
		utilisateursTableau () {
			const utilisateurs = []
			this.reponses.forEach((reponse) => {
				if (!this.bannis.includes(reponse.identifiant)) {
					utilisateurs.push({ identifiant: reponse.identifiant, nom: reponse.nom })
				}
			})
			if (this.triTableau === 'score') {
				utilisateurs.forEach((utilisateur, index) => {
					this.classement.forEach((u) => {
						if (u.identifiant === utilisateur.identifiant) {
							utilisateurs[index].score = u.score
						}
					})
				})
				utilisateurs.forEach((utilisateur, index) => {
					if (!utilisateur.hasOwnProperty('score') || utilisateur.score < 0) {
						utilisateurs[index].score = 0
					}
				})
				utilisateurs.sort((a, b) => {
					return b.score - a.score
				})
			} else if (this.triTableau === 'progression') {
				utilisateurs.forEach((utilisateur, index) => {
					this.reponses.forEach((item) => {
						if (item.identifiant === utilisateur.identifiant) {
							let reponses = 0
							item.reponse.forEach((reponse) => {
								if (reponse.length > 0) {
									reponses++
								}
							})
							utilisateurs[index].reponses = reponses
						}
					})
				})
				utilisateurs.forEach((utilisateur, index) => {
					if (!utilisateur.hasOwnProperty('reponses')) {
						utilisateurs[index].reponses = 0
					}
				})
				utilisateurs.sort((a, b) => {
					return b.reponses - a.reponses
				})
			}
			return utilisateurs
		},
		statistiques () {
			const statistiques = []
			this.questions.forEach((question, indexQuestion) => {
				const personnes = []
				const pourcentages = []
				const liste = []
				if (question.option !== 'texte-court') {
					for (let i = 0; i < question.items.length; i++) {
						personnes.push(0)
						pourcentages.push(0)
						liste.push([])
					}
					question.items.forEach((item, index) => {
						let reponses = 0
						const utilisateurs = []
						this.reponses.forEach((donnees) => {
							donnees.reponse[indexQuestion].forEach((reponse) => {
								if (!this.bannis.includes(donnees.identifiant) && (reponse === item.texte || (item.image && reponse === item.image) || (item.audio && reponse === item.audio))) {
									reponses++
									utilisateurs.push(donnees.identifiant)
								}
							})
						})
						if (reponses > 0) {
							personnes[index] = reponses
							const pourcentage = (reponses / this.reponses.length) * 100
							pourcentages[index] = Math.round(pourcentage)
							liste[index] = utilisateurs
						}
					})
				} else {
					let items = []
					this.reponses.forEach((donnees) => {
						donnees.reponse[indexQuestion].forEach((reponse) => {
							if (!this.bannis.includes(donnees.identifiant) && !items.includes(reponse.toString().trim())) {
								items.push(reponse.toString().trim())
							}
						})
					})
					for (let i = 0; i < items.length; i++) {
						personnes.push(0)
						pourcentages.push(0)
						liste.push([])
					}
					items.forEach((item, index) => {
						let reponses = 0
						const utilisateurs = []
						this.reponses.forEach((donnees) => {
							donnees.reponse[indexQuestion].forEach((reponse) => {
								if (!this.bannis.includes(donnees.identifiant) && item === reponse.toString().trim()) {
									reponses++
									utilisateurs.push(donnees.identifiant)
								}
							})
						})
						if (reponses > 0) {
							personnes[index] = reponses
							const pourcentage = (reponses / this.reponses.length) * 100
							pourcentages[index] = Math.round(pourcentage)
							liste[index] = utilisateurs
						}
					})
				}
				statistiques.push({ personnes: personnes, pourcentages: pourcentages, liste: liste })
			})
			return statistiques
		}
	},
	watch: {
		statut (statut) {
			if (statut === 'ouvert' && ((this.options.hasOwnProperty('questionsAleatoires') && this.options.questionsAleatoires === true) || (this.options.hasOwnProperty('itemsAleatoires') && this.options.itemsAleatoires === true))) {
				this.questions = this.donneesSession.questions
			}
		}
	},
	created () {
		this.description = this.donnees.description
		this.support = this.donnees.support
		this.options = this.donnees.options
		if (this.statut !== 'attente' && ((this.options.hasOwnProperty('questionsAleatoires') && this.options.questionsAleatoires === true) || (this.options.hasOwnProperty('itemsAleatoires') && this.options.itemsAleatoires === true))) {
			this.questions = this.donneesSession.questions
		} else {
			this.questions = this.donnees.questions
		}
	},
	mounted () {
		this.$nextTick(() => {
			window.typesetMathJax()
		})

		document.addEventListener('keydown', this.gererClavier, false)
	},
	beforeUnmount () {
		document.removeEventListener('keydown', this.gererClavier, false)
	},
	methods: {
		modifierIndexQuestion () {
			const indexQuestion = this.indexQuestion + 1
			this.$emit('index', indexQuestion)
			this.$nextTick(() => {
				window.typesetMathJax()
			})
		},
		afficherClassement () {
			this.$emit('classement')
		},
		afficherReponse () {
			this.$emit('reponseVisible')
		},
		afficherResultats () {
			this.tableauResultats = !this.tableauResultats
			this.$emit('tableau-resultats', this.tableauResultats)
			this.$nextTick(() => {
				window.typesetMathJax()
			})
		},
		definirScore (identifiant) {
			let score = 0
			this.classement.forEach((utilisateur) => {
				if (utilisateur.identifiant === identifiant) {
					score = utilisateur.score
				}
			})
			return score
		},
		definirItemsTexte (indexQuestion) {
			const itemsUtilisateur = []
			const itemsReponses = []
			this.reponses.forEach((donnees) => {
				if (!this.bannis.includes(donnees.identifiant)) {
					donnees.reponse[indexQuestion].forEach((reponse) => {
						if (!itemsUtilisateur.includes(reponse.toString().trim())) {
							itemsUtilisateur.push(reponse.toString().trim())
						}
					})
				}
			})
			const reponsesTexte = this.questions[indexQuestion].reponses.split('|')
			reponsesTexte.forEach((item) => {
				if (!itemsUtilisateur.includes(item.trim())) {
					itemsReponses.push(item.trim())
				}
			})
			return { utilisateur: itemsUtilisateur, reponses: itemsReponses }
		},
		definirReponseQuestion (identifiant, indexQuestion) {
			const reponseCorrecte = []
			let bonneReponse = false
			let reponsePartielle = false
			let reponses = 0
			let score = 0
			const bonnesReponses = []
			const mauvaisesReponses = []
			if (this.questions[indexQuestion].option !== 'texte-court') {
				this.questions[indexQuestion].items.forEach((item) => {
					if (item.reponse === true && item.texte !== '') {
						reponseCorrecte.push(item.texte)
					} else if (item.reponse === true && item.image && item.image !== '') {
						reponseCorrecte.push(item.image)
					} else if (item.reponse === true && item.audio && item.audio !== '') {
						reponseCorrecte.push(item.audio)
					}
				})
				this.questions[indexQuestion].items.forEach((question) => {
					if (question.reponse === true) {
						this.reponses.forEach((item) => {
							if (item.identifiant === identifiant && (item.reponse[indexQuestion].includes(question.texte) || (question.image && item.reponse[indexQuestion].includes(question.image)) || (question.audio && item.reponse[indexQuestion].includes(question.audio)))) {
								bonnesReponses.push(question)
							}
						})
					} else if (question.reponse === false) {
						this.reponses.forEach((item) => {
							if (item.identifiant === identifiant && (item.reponse[indexQuestion].includes(question.texte) || (question.image && item.reponse[indexQuestion].includes(question.image)) || (question.audio && item.reponse[indexQuestion].includes(question.audio)))) {
								mauvaisesReponses.push(question)
							}
						})
					}
				})
			} else {
				const reponsesTexte = this.questions[indexQuestion].reponses.split('|')
				reponsesTexte.forEach((item, index) => {
					reponsesTexte[index] = item.trim()
				})
				reponseCorrecte.push(...reponsesTexte)
				this.reponses.forEach((item) => {
					if (item.identifiant === identifiant && reponsesTexte.includes(item.reponse[indexQuestion].toString().trim()) === true) {
						bonnesReponses.push(item.reponse[indexQuestion].toString())
					}
				})
			}
			this.reponses.forEach((item) => {
				if (item.identifiant === identifiant) {
					if ((this.questions[indexQuestion].option !== 'texte-court' && reponseCorrecte.every(i => item.reponse[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0) || (this.questions[indexQuestion].option === 'texte-court' && reponseCorrecte.includes(item.reponse[indexQuestion].toString().trim()) === true)) {
						bonneReponse = true
					} else if (this.questions[indexQuestion].option !== 'texte-court' && bonnesReponses.length > mauvaisesReponses.length) {
						reponsePartielle = true
					}
					reponses = item.reponse[indexQuestion].length

					if (item.hasOwnProperty('score') && this.options.points !== 'classique') {
						score = item.score[indexQuestion]
					} else {
						let multiplicateurSecondes = 10
						if (this.options.hasOwnProperty('multiplicateur') && this.options.multiplicateur > 0) {
							multiplicateurSecondes = this.options.multiplicateur
						}
						const question = this.questions[indexQuestion]
						const pointsBase = question.hasOwnProperty('points') ? question.points : 1000
						const pointsMinimum = question.hasOwnProperty('points') ? Math.round(question.points / 10) : 100
						const reponseComplete = (question.option === 'choix-unique' && bonnesReponses.length > 0) || (question.option === 'texte-court' && bonnesReponses.length > 0) || (question.option === 'choix-multiples' && reponseCorrecte.every(i => item.reponse[indexQuestion].includes(i)) === true && mauvaisesReponses.length === 0)
						if (reponseComplete) {
							if (this.options.points === 'classique') {
								score = pointsBase
							} else {
								score = Math.round(pointsBase - (item.temps[indexQuestion] * multiplicateurSecondes))
								if (score < pointsMinimum) {
									score = pointsMinimum
								}
							}
						} else if ((bonnesReponses.length - mauvaisesReponses.length) > 0) {
							if (this.options.points === 'classique') {
								score = ((pointsBase / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
							} else {
								let points = Math.round(pointsBase - (item.temps[indexQuestion] * multiplicateurSecondes))
								if (points < pointsMinimum) {
									points = pointsMinimum
								}
								score = ((points / reponseCorrecte.length) * (bonnesReponses.length - mauvaisesReponses.length))
							}
						} else {
							score = 0
						}
					}
				}
			})
			return { bonneReponse: bonneReponse, reponsePartielle: reponsePartielle, reponses: reponses, score: score }
		},
		verifierReponseTexte (question, reponse) {
			const reponsesTexte = question.reponses.split('|')
			reponsesTexte.forEach((item, index) => {
				reponsesTexte[index] = item.trim()
			})
			return reponsesTexte.includes(reponse)
		},
		afficherSupport () {
			this.donneesQuestion.type = 'support'
			this.indexQuestionTableau = -1
			this.modaleQuestion = true
			this.$emit('modale', true)
			this.$nextTick(() => {
				window.typesetMathJax()
				document.querySelector('#modale-question .fermer')?.focus()
			})
		},
		afficherQuestion (donneesQuestion, indexQuestionTableau) {
			this.donneesQuestion = donneesQuestion
			this.donneesQuestion.type = 'question'
			this.indexQuestionTableau = indexQuestionTableau
			this.elementPrecedent = (document.activeElement || document.body)
			this.modaleQuestion = true
			this.$emit('modale', true)
			this.$nextTick(() => {
				window.typesetMathJax()
				document.querySelector('#modale-question .fermer')?.focus()
			})
		},
		fermerModaleQuestion () {
			this.modaleQuestion = false
			this.donneesQuestion = {}
			this.indexQuestionTableau = -1
			this.reponseVisibleModale = false
			this.resultatsVisiblesModale = false
			this.$emit('modale', false)
			this.gererFocus()
		},
		modifierIndexQuestionTableau (direction) {
			if (direction === 'precedente' && ((this.indexQuestionTableau > -1 && (this.description !== '' || Object.keys(this.support).length > 0)) || (this.indexQuestionTableau > 0 && this.description === '' && Object.keys(this.support).length === 0))) {
				this.indexQuestionTableau--
			} else if (direction === 'suivante' && this.indexQuestionTableau < (this.questions.length - 1)) {
				this.indexQuestionTableau++
			}
			if (this.indexQuestionTableau === -1) {
				this.donneesQuestion.type = 'support'
			} else {
				this.donneesQuestion = this.questions[this.indexQuestionTableau]
				this.donneesQuestion.type = 'question'
			}
			this.$nextTick(() => {
				window.typesetMathJax()
			})
		},
		cacherNoms () {
			this.nomsVisible = false
		},
		afficherNoms () {
			this.nomsVisible = true
		}
	}
}
</script>

<style scoped src="#root/components/css/style-multi-afficher.css"></style>

<style>
#description .description a,
#questions .question a {
	color: #00a1e3;
	text-decoration: underline;
}

#attente .info-attente p {
	margin-bottom: 5px;
}

#attente .info-attente p:last-child {
	margin-bottom: 0;
}

#questionnaire footer .bouton.icone.affiche {
	color: #ff7b3c!important;
}
</style>
