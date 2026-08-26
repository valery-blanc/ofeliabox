<template>
	<div id="sondage" :class="{'avec-actions': (options.progression === 'animateur' && (statut === 'attente' || ((statut === 'ouvert' || statut === 'verrouille') && (((description !== '' || Object.keys(support).length > 0) && indexQuestion === -1) || questions.length > 1)))) || (options.progression === 'libre' && ((description !== '' || Object.keys(support).length > 0) || (description === '' && Object.keys(support).length === 0 && questions.length > 1)))}">
		<div id="attente" v-if="statut === 'attente'">
			<h2>{{ $t('sondageEnAttenteDemarrage') }}</h2>
			<div class="info-attente" v-html="$t('infoSondageEnAttenteDemarrage')" />
			<div class="points">
				<span class="point" />
				<span class="point" />
				<span class="point" />
			</div>
			<h2 v-if="options.nom === 'obligatoire'">{{ $t('listeParticipants') }}</h2>
			<div class="utilisateurs-connectes" v-if="options.nom === 'obligatoire' && utilisateursConnectes.length > 0">
				<template v-for="(utilisateur, indexUtilisateur) in utilisateursConnectes">
					<div class="utilisateur" v-if="utilisateur.nom !== ''" :key="'utilisateur_' + indexUtilisateur">
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

		<div class="sondage" v-else-if="statut === 'ouvert' || statut === 'verrouille'">
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

						<div :id="'items' + indexQ" class="items resultats" v-if="resultats && !classementResultats && q.option !== 'texte-court' && q.option !== 'etoiles'">
							<template v-for="(item, index) in q.items">
								<div :id="'item' + indexQ + '_' + index" class="item" :class="{'reponse': statistiques[indexQ].pourcentages[index] > 0, 'audio-et-texte': verifierItemAudioTexte(item) === true}" v-if="verifierItem(item) === true" :key="'item_' + indexQ + '_' + index">
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
						<div :id="'items' + indexQ" class="items resultats" v-else-if="resultats && classementResultats && q.option !== 'texte-court' && q.option !== 'etoiles'">
							<template v-for="(item, index) in itemsClasses">
								<div :id="'item' + indexQ + '_' + index" class="item" :class="{'reponse': item.pourcentages > 0, 'audio-et-texte': verifierItemAudioTexte(item) === true}" v-if="verifierItem(item) === true" :key="'item_' + indexQ + '_' + index">
									<div class="progression" :style="{'width': item.pourcentages + '%'}" />
									<div class="contenu">
										<span class="index">{{ item.alphabet.toUpperCase() }}</span>
										<button type="button" class="image" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(item.image), item.alt)" v-if="item.image && item.image !== ''"><img :src="definirCheminFichier(item.image)" :alt="item.alt"></button>
										<span class="audio" v-else-if="item.audio && item.audio !== ''"><audio controls :src="definirCheminFichier(item.audio)" /></span>
										<span class="texte" v-if="item.texte !== ''">{{ item.texte }}</span>
									</div>
									<div class="statistiques">
										<button type="button" class="personnes curseur" :disabled="disabled" :title="$t('afficherListeRepondants')" :aria-label="$t('afficherListeRepondants')" @click="afficherModaleListe(item.liste)" v-if="options.nom === 'obligatoire' && item.liste.length > 0">{{ item.personnes }} <i class="material-icons" aria-hidden="true">person</i></button>
										<span class="personnes" :aria-label="item.personnes + ' ' + $t('repondants')" v-else>{{ item.personnes }} <i class="material-icons" aria-hidden="true">person</i></span>
										<span class="pourcentages">{{ item.pourcentages }}%</span>
									</div>
								</div>
							</template>
						</div>
						<div :id="'items' + indexQ" class="items" v-else-if="!resultats && q.option !== 'texte-court' && q.option !== 'etoiles'">
							<div :id="'item' + indexQ + '_' + index" class="item" :class="{'audio-et-texte': verifierItemAudioTexte(item) === true}" v-for="(item, index) in q.items" :key="'item_' + indexQ + '_' + index">
								<span class="index">{{ alphabet[index].toUpperCase() }}</span>
								<button type="button" class="image" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(item.image), item.alt)" v-if="item.image && item.image !== ''"><img :src="definirCheminFichier(item.image)" :alt="item.alt"></button>
								<span class="audio" v-else-if="item.audio && item.audio !== ''"><audio controls :src="definirCheminFichier(item.audio)" /></span>
								<span class="texte" v-if="item.texte !== ''">{{ item.texte }}</span>
							</div>
						</div>
						<div :id="'items' + indexQ" class="items resultats" v-else-if="resultats && !classementResultats && q.option === 'texte-court'">
							<template v-for="(item, index) in definirItemsTexte(indexQ)">
								<div :id="'item' + indexQ + '_' + index" class="item" :class="{'reponse': statistiques[indexQ].pourcentages[index] > 0}" v-if="item.texte !== ''" :key="'item_' + indexQ + '_' + index">
									<div class="progression" :style="{'width': statistiques[indexQ].pourcentages[index] + '%'}" />
									<div class="contenu">
										<span class="index">{{ index + 1 }}</span>
										<span class="texte">{{ item.texte }}</span>
									</div>
									<div class="statistiques">
										<button type="button" class="personnes curseur" :disabled="disabled" :title="$t('afficherListeRepondants')" :aria-label="$t('afficherListeRepondants')" @click="afficherModaleListe(statistiques[indexQ].liste[index])" v-if="(options.progression === 'animateur' || options.nom === 'obligatoire') && statistiques[indexQ].personnes[index] > 0">{{ statistiques[indexQ].personnes[index] }} <i class="material-icons" aria-hidden="true">person</i></button>
										<span class="personnes" :aria-label="statistiques[indexQ].personnes[index] + ' ' + $t('repondants')" v-else>{{ statistiques[indexQ].personnes[index] }} <i class="material-icons" aria-hidden="true">person</i></span>
										<span class="pourcentages">{{ statistiques[indexQ].pourcentages[index] }}%</span>
									</div>
								</div>
							</template>
						</div>
						<div :id="'items' + indexQ" class="items resultats" v-else-if="resultats && classementResultats && q.option === 'texte-court'">
							<template v-for="(item, index) in itemsClasses">
								<div :id="'item' + indexQ + '_' + index" class="item" :class="{'reponse': item.pourcentages > 0}" v-if="item.texte !== ''" :key="'item_' + indexQ + '_' + index">
									<div class="progression" :style="{'width': item.pourcentages + '%'}" />
									<div class="contenu">
										<span class="index">{{ index + 1 }}</span>
										<span class="texte">{{ item.texte }}</span>
									</div>
									<div class="statistiques">
										<button type="button" class="personnes curseur" :disabled="disabled" :title="$t('afficherListeRepondants')" :aria-label="$t('afficherListeRepondants')" @click="afficherModaleListe(item.liste)" v-if="(options.progression === 'animateur' || options.nom === 'obligatoire') && item.liste.length > 0">{{ item.personnes }} <i class="material-icons" aria-hidden="true">person</i></button>
										<span class="personnes" :aria-label="item.personnes + ' ' + $t('repondants')" v-else>{{ item.personnes }} <i class="material-icons" aria-hidden="true">person</i></span>
										<span class="pourcentages">{{ item.pourcentages }}%</span>
									</div>
								</div>
							</template>
						</div>
						<div :id="'items' + indexQ" class="items" v-else-if="!resultats && q.option === 'texte-court'">
							<div :id="'item' + indexQ + '_' + index" class="item" v-for="(item, index) in definirItemsTexte(indexQ)" :key="'item_' + indexQ + '_' + index">
								<span class="index">{{ index + 1 }}</span>
								<span class="texte">{{ item.texte }}</span>
							</div>
						</div>
						<div :id="'items' + indexQ" class="items resultats" v-else-if="resultats && !classementResultats && q.option === 'etoiles'">
							<div class="item">
								<div class="contenu etoiles" :title="definirMoyenne(indexQ) > 1 ? definirMoyenne(indexQ) + ' ' + $t('etoilesP') : definirMoyenne(indexQ) + ' ' + $t('etoile')" v-if="isNaN(definirMoyenne(indexQ)) === false">
									<i class="material-icons selectionne" aria-hidden="true" v-for="etoile in definirMoyenne(indexQ)" :key="'etoile_' + etoile">star</i>
									<template v-if="q.etoiles > definirMoyenne(indexQ)">
										<i class="material-icons" aria-hidden="true" v-for="etoile in (q.etoiles - definirMoyenne(indexQ))" :key="'etoilevide_' + etoile">star_outline</i>
									</template>
								</div>
								<div class="contenu etoiles" v-else-if="isNaN(definirMoyenne(indexQ)) === true">
									<i class="material-icons" aria-hidden="true" v-for="etoile in q.etoiles" :key="'etoilevide_' + etoile">star_outline</i>
								</div>
								<div class="statistiques">
									<span class="personnes" :aria-label="definirTotalPersonnes(indexQ) + ' ' + $t('repondants')">{{ definirTotalPersonnes(indexQ) }} <i class="material-icons" aria-hidden="true">person</i></span>
									<span class="pourcentages" v-if="isNaN(definirMoyenne(indexQ)) === false">{{ definirMoyenne(indexQ) }}/{{ q.etoiles }}</span>
									<span class="pourcentages" v-else>0/{{ q.etoiles }}</span>
								</div>
							</div>

							<div :id="'accordeon' + indexQ" class="section accordeon">
								<div class="conteneur-accordeon">
									<div class="en-tete-accordeon">
										<div class="titre">
											<button type="button" class="titre-accordeon" :disabled="disabled" :title="$t('ouvrirFermerAccordeon')" :aria-label="$t('ouvrirFermerAccordeon')" @click="gererAccordeon(indexQ)">
												<template v-if="accordeonOuvert !== indexQ">{{ $t('afficherDetails') }}</template>
												<template v-else>{{ $t('masquerDetails') }}</template>
											</button>
										</div>
										<button type="button" class="statut" :disabled="disabled" :title="accordeonOuvert !== indexQ ? $t('ouvrirAccordeon') : $t('fermerAccordeon')" :aria-label="accordeonOuvert !== indexQ ? $t('ouvrirAccordeon') : $t('fermerAccordeon')" @click="gererAccordeon(indexQ)" >
											<i class="material-icons" aria-hidden="true" v-if="accordeonOuvert !== indexQ">add</i>
											<i class="material-icons" aria-hidden="true" v-else>remove</i>
										</button>
									</div>

									<div class="contenu-accordeon" :class="{'ouvert': accordeonOuvert === indexQ}">
										<template v-if="accordeonOuvert === indexQ">
											<div :id="'item' + indexQ + '_' + (index - 1)" class="item" v-for="index in q.etoiles" :key="'item_' + indexQ + '_' + (index - 1)">
												<div class="progression" :style="{'width': statistiques[indexQ].pourcentages[index - 1] + '%'}" />
												<div class="contenu etoiles" :title="index > 1 ? index + ' ' + $t('etoilesP') : index + ' ' + $t('etoile')">
													<i class="material-icons selectionne" aria-hidden="true" v-for="etoile in index" :key="'etoile_' + etoile">star</i>
													<i class="material-icons" aria-hidden="true" v-for="etoile in (q.etoiles - index)" :key="'etoilevide_' + etoile">star_outline</i>
												</div>
												<div class="statistiques">
													<button type="button" class="personnes curseur" :disabled="disabled" :title="$t('afficherListeRepondants')" :aria-label="$t('afficherListeRepondants')" @click="afficherModaleListe(statistiques[indexQ].liste[index - 1])" v-if="options.nom === 'obligatoire' && statistiques[indexQ].personnes[index - 1] > 0">{{ statistiques[indexQ].personnes[index - 1] }} <i class="material-icons" aria-hidden="true">person</i></button>
													<span class="personnes" :aria-label="statistiques[indexQ].personnes[index - 1] + ' ' + $t('repondants')" v-else>{{ statistiques[indexQ].personnes[index - 1] }} <i class="material-icons" aria-hidden="true">person</i></span>
													<span class="pourcentages">{{ statistiques[indexQ].pourcentages[index - 1] }}%</span>
												</div>
											</div>
										</template>
									</div>
								</div>
							</div>
						</div>
						<div :id="'items' + indexQ" class="items resultats" v-else-if="resultats && classementResultats && q.option === 'etoiles'">
							<div class="item">
								<div class="contenu etoiles" :title="definirMoyenne(indexQ) > 1 ? definirMoyenne(indexQ) + ' ' + $t('etoilesP') : definirMoyenne(indexQ) + ' ' + $t('etoile')" v-if="isNaN(definirMoyenne(indexQ)) === false">
									<i class="material-icons selectionne" aria-hidden="true" v-for="etoile in definirMoyenne(indexQ)" :key="'etoile_' + etoile">star</i>
									<template v-if="q.etoiles > definirMoyenne(indexQ)">
										<i class="material-icons" aria-hidden="true" v-for="etoile in (q.etoiles - definirMoyenne(indexQ))" :key="'etoilevide_' + etoile">star_outline</i>
									</template>
								</div>
								<div class="contenu etoiles" v-else-if="isNaN(definirMoyenne(indexQ)) === true">
									<i class="material-icons" aria-hidden="true" v-for="etoile in q.etoiles" :key="'etoilevide_' + etoile">star_outline</i>
								</div>
								<div class="statistiques">
									<span class="personnes" :aria-label="definirTotalPersonnes(indexQ) + ' ' + $t('repondants')">{{ definirTotalPersonnes(indexQ) }} <i class="material-icons" aria-hidden="true">person</i></span>
									<span class="pourcentages" v-if="isNaN(definirMoyenne(indexQ)) === false">{{ definirMoyenne(indexQ) }}/{{ q.etoiles }}</span>
									<span class="pourcentages" v-else>0/{{ q.etoiles }}</span>
								</div>
							</div>

							<div :id="'accordeon' + indexQ" class="section accordeon">
								<div class="conteneur-accordeon">
									<div class="en-tete-accordeon">
										<div class="titre">
											<button type="button" class="titre-accordeon" :disabled="disabled" :title="$t('ouvrirFermerAccordeon')" :aria-label="$t('ouvrirFermerAccordeon')" @click="gererAccordeon(indexQ)">
												<template v-if="accordeonOuvert !== indexQ">{{ $t('afficherDetails') }}</template>
												<template v-else>{{ $t('masquerDetails') }}</template>
											</button>
										</div>
										<button type="button" class="statut" :disabled="disabled" :title="$t('ouvrirAccordeon')" :aria-label="$t('ouvrirAccordeon')" @click="gererAccordeon(indexQ)" v-if="accordeonOuvert !== indexQ">
											<i class="material-icons" aria-hidden="true">add</i>
										</button>
										<button type="button" class="statut" :disabled="disabled" :title="$t('fermerAccordeon')" :aria-label="$t('fermerAccordeon')" @click="gererAccordeon(indexQ)" v-else>
											<i class="material-icons" aria-hidden="true">remove</i>
										</button>
									</div>

									<div class="contenu-accordeon" :class="{'ouvert': accordeonOuvert === indexQ}">
										<template v-if="accordeonOuvert === indexQ">
											<div :id="'item' + indexQ + '_' + index" class="item" :class="{'reponse': item.pourcentages > 0}" v-for="(item, index) in itemsClasses" :key="'item_' + indexQ + '_' + index">
												<div class="progression" :style="{'width': item.pourcentages + '%'}" />
												<div class="contenu etoiles" :title="item.etoile > 1 ? item.etoile + ' ' + $t('etoilesP') : item.etoile + ' ' + $t('etoile')">
													<i class="material-icons selectionne" aria-hidden="true" v-for="etoile in item.etoile" :key="'etoile_' + etoile">star</i>
													<template v-if="q.etoiles > item.etoile">
														<i class="material-icons" aria-hidden="true" v-for="etoile in (q.etoiles - item.etoile)" :key="'etoilevide_' + etoile">star_outline</i>
													</template>
												</div>
												<div class="statistiques">
													<button type="button" class="personnes curseur" :disabled="disabled" :title="$t('afficherListeRepondants')" :aria-label="$t('afficherListeRepondants')" @click="afficherModaleListe(item.liste)" v-if="options.nom === 'obligatoire' && item.liste.length > 0">{{ item.personnes }} <i class="material-icons" aria-hidden="true">person</i></button>
													<span class="personnes" :aria-label="item.personnes + ' ' + $t('repondants')" v-else>{{ item.personnes }} <i class="material-icons" aria-hidden="true">person</i></span>
													<span class="pourcentages">{{ item.pourcentages }}%</span>
												</div>
											</div>
										</template>
									</div>
								</div>
							</div>
						</div>
						<div :id="'items' + indexQ" class="items" v-else-if="!resultats && q.option === 'etoiles'">
							<div :id="'item' + indexQ" class="item">
								<div class="etoiles">
									<i class="material-icons" aria-hidden="true" v-for="etoile in q.etoiles" :key="'etoilevide_' + etoile">star_outline</i>
								</div>
							</div>
						</div>
					</div>
				</TransitionGroup>
			</div>
		</div>

		<div id="actions" v-if="options.progression === 'animateur' && (statut === 'attente' || ((statut === 'ouvert' || statut === 'verrouille') && (((description !== '' || Object.keys(support).length > 0) && indexQuestion === -1) || questions.length > 1)))">
			<div class="section">
				<button type="button" class="bouton" :disabled="disabled" @click="$emit('demarrer')" v-if="statut === 'attente'">{{ $t('demarrerSondage') }}</button>

				<button type="button" class="bouton" :disabled="disabled" @click="modifierIndexQuestion('suivant')" v-if="(statut === 'ouvert' || statut === 'verrouille') && indexQuestion < (questions.length - 1)">{{ $t('suivant') }}</button>

				<button type="button" class="bouton" :disabled="disabled" @click="afficherModaleQuestion" v-if="(statut === 'ouvert' || statut === 'verrouille') && indexQuestion === (questions.length - 1)">{{ $t('afficherResultats') }}</button>
			</div>
		</div>
		<div id="actions" v-else-if="options.progression === 'libre' && ((description !== '' || Object.keys(support).length > 0) || (description === '' && Object.keys(support).length === 0 && questions.length > 1))">
			<div class="section">
				<button type="button" class="bouton" :disabled="disabled" @click="modifierIndexQuestion('precedent')" v-if="(statut === 'ouvert' || statut === 'verrouille') && indexQuestion > -1 && (description !== '' || Object.keys(support).length > 0)">{{ $t('precedent') }}</button>

				<button type="button" class="bouton" :disabled="disabled" @click="modifierIndexQuestion('precedent')" v-else-if="(statut === 'ouvert' || statut === 'verrouille') && indexQuestion > 0 && description === '' && Object.keys(support).length === 0">{{ $t('precedent') }}</button>

				<button type="button" class="bouton" :disabled="disabled" @click="modifierIndexQuestion('suivant')" v-if="(statut === 'ouvert' || statut === 'verrouille') && indexQuestion < (questions.length - 1)">{{ $t('suivant') }}</button>
			</div>
		</div>

		<div class="conteneur-modale" v-if="modaleQuestion">
			<div id="modale-question" class="modale" role="dialog">
				<header>
					<span class="titre" v-if="indexQuestionModale === -1 && description !== '' && Object.keys(support).length === 0">{{ $t('description') }}</span>
					<span class="titre" v-else-if="indexQuestionModale === -1 && description === '' && Object.keys(support).length > 0">{{ $t('support') }}</span>
					<span class="titre" v-else-if="indexQuestionModale === -1 && description !== '' && Object.keys(support).length > 0">{{ $t('descriptionEtSupport') }}</span>
					<span class="titre" v-else>{{ $t('question') }} {{ indexQuestionModale + 1 }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleQuestion"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" v-if="indexQuestionModale > -1">
						<div id="m_questions">
							<TransitionGroup name="fondu">
								<div class="m_q" v-for="(q, indexQ) in questions" v-show="indexQuestionModale === indexQ" :key="'m_q_' + indexQ">
									<div :id="'m_question' + indexQ">
										<div class="question-et-image" v-if="q.question !== '' && Object.keys(q.support).length > 0 && q.support.image && q.support.image !== ''">
											<span class="question" v-html="formaterHTML(q.question)" />
											<button type="button" class="support" :disabled="disabledModale" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(q.support.image), q.support.alt)"><img :src="definirCheminFichier(q.support.image)" :alt="q.support.alt"></button>
										</div>
										<div class="question-et-audio" v-else-if="q.question !== '' && Object.keys(q.support).length > 0 && q.support.audio && q.support.audio !== ''">
											<div class="question" v-html="formaterHTML(q.question)" />
											<audio controls :src="definirCheminFichier(q.support.audio)" />
										</div>
										<div class="question" v-else-if="q.question !== ''" v-html="formaterHTML(q.question)" />
										<div class="support" v-else-if="Object.keys(q.support).length > 0">
											<button type="button" class="support" :disabled="disabledModale" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" v-if="q.support.image && q.support.image !== ''" @click="afficherImage($event, definirCheminFichier(q.support.image), q.support.alt)"><img :src="definirCheminFichier(q.support.image)" :alt="q.support.alt"></button>
											<audio controls :src="definirCheminFichier(q.support.audio)" v-else-if="q.support.audio && q.support.audio !== ''" />
										</div>
									</div>

									<div id="m_items" class="items resultats">
										<div class="item moyenne" v-if="q.option === 'etoiles'">
											<div class="contenu etoiles" :title="definirMoyenne(indexQ) > 1 ? definirMoyenne(indexQ) + ' ' + $t('etoilesP') : definirMoyenne(indexQ) + ' ' + $t('etoile')" v-if="isNaN(definirMoyenne(indexQ)) === false">
												<i class="material-icons selectionne" aria-hidden="true" v-for="etoile in definirMoyenne(indexQ)" :key="'etoile_' + etoile">star</i>
												<template v-if="q.etoiles > definirMoyenne(indexQ)">
													<i class="material-icons" aria-hidden="true" v-for="etoile in (q.etoiles - definirMoyenne(indexQ))" :key="'etoilevide_' + etoile">star_outline</i>
												</template>
											</div>
											<div class="contenu etoiles" v-else-if="isNaN(definirMoyenne(indexQ)) === true">
												<i class="material-icons" aria-hidden="true" v-for="etoile in q.etoiles" :key="'etoilevide_' + etoile">star_outline</i>
											</div>
											<div class="statistiques">
												<span class="personnes" :aria-label="definirTotalPersonnes(indexQ) + ' ' + $t('repondants')">{{ definirTotalPersonnes(indexQ) }} <i class="material-icons" aria-hidden="true">person</i></span>
												<span class="pourcentages" v-if="isNaN(definirMoyenne(indexQ)) === false">{{ definirMoyenne(indexQ) }}/{{ q.etoiles }}</span>
												<span class="pourcentages" v-else>0/{{ q.etoiles }}</span>
											</div>
										</div>
										<h3 v-if="q.option === 'etoiles'">{{ $t('detailReponses') }}</h3>

										<div :id="'m_item' + indexQ + '_' + index" class="item" :class="{'reponse': item.pourcentages > 0, 'audio-et-texte': verifierItemAudioTexte(item) === true}" v-for="(item, index) in itemsClassesModale" :key="'m_item' + indexQ + '_' + index">
											<div class="progression" :style="{'width': item.pourcentages + '%'}" />
											<div class="contenu" v-if="q.option !== 'texte-court' && q.option !== 'etoiles'">
												<span class="index">{{ item.alphabet.toUpperCase() }}</span>
												<button type="button" class="image" :disabled="disabledModale" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherImage($event, definirCheminFichier(item.image), item.alt)" v-if="item.image && item.image !== ''"><img :src="definirCheminFichier(item.image)" :alt="item.alt"></button>
												<span class="audio" v-else-if="item.audio && item.audio !== ''"><audio controls :src="definirCheminFichier(item.audio)" /></span>
												<span class="texte" v-if="item.texte !== ''">{{ item.texte }}</span>
											</div>
											<div class="contenu" v-else-if="q.option === 'texte-court'">
												<span class="index">{{ index + 1 }}</span>
												<span class="texte">{{ item.texte }}</span>
											</div>
											<div class="contenu etoiles" :title="item.etoile > 1 ? item.etoile + ' ' + $t('etoilesP') : item.etoile + ' ' + $t('etoile')" v-else-if="q.option === 'etoiles'">
												<i class="material-icons selectionne" aria-hidden="true" v-for="etoile in item.etoile" :key="'etoile_' + etoile">star</i>
												<template v-if="q.etoiles > item.etoile">
													<i class="material-icons" aria-hidden="true" v-for="etoile in (q.etoiles - item.etoile)" :key="'etoilevide_' + etoile">star_outline</i>
												</template>
											</div>
											<div class="statistiques">
												<span class="personnes" :title="definirListe(item.liste)" :aria-label="definirListe(item.liste)" v-if="options.nom === 'obligatoire' && item.liste.length > 0">{{ item.personnes }} <i class="material-icons" aria-hidden="true">person</i></span>
												<span class="personnes" :aria-label="item.personnes + ' ' + $t('repondants')" v-else>{{ item.personnes }} <i class="material-icons" aria-hidden="true">person</i></span>
												<span class="pourcentages">{{ item.pourcentages }}%</span>
											</div>
										</div>
									</div>
								</div>
							</TransitionGroup>
						</div>
					</div>
					<div class="contenu" v-else>
						<div id="m_description">
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
					<button type="button" class="bouton icone" :disabled="disabledModale" :title="$t('questionPrecedente')" :aria-label="$t('questionPrecedente')" :class="{'invisible': (indexQuestionModale === -1 && (description !== '' || Object.keys(support).length > 0)) || (indexQuestionModale === 0 && description === '' && Object.keys(support).length === 0)}" @click="modifierIndexQuestionModale('precedente')"><i class="material-icons" aria-hidden="true">arrow_back</i></button>

					<button type="button" class="bouton icone" :disabled="disabledModale" :title="$t('questionSuivante')" :aria-label="$t('questionSuivante')" :class="{'invisible': indexQuestionModale === (questions.length - 1)}" @click="modifierIndexQuestionModale('suivante')"><i class="material-icons" aria-hidden="true">arrow_forward</i></button>
				</footer>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'liste'">
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

		<div class="conteneur-modale" v-if="modale === 'image'">
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
import methodes from '#root/components/js/methodes-multi-afficher'

export default {
	name: 'DigistormSondageAfficher',
	inject: ['parent'],
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
		classementResultats: Boolean,
		indexQuestion: Number
	},
	data () {
		return {
			description: '',
			support: {},
			options: {},
			questions: [],
			modale: '',
			image: '',
			alphabet: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'],
			modaleQuestion: false,
			accordeonOuvert: -1,
			indexQuestionModale: -1,
			liste: '',
			elementPrecedent: null
		}
	},
	computed: {
		statistiques () {
			const statistiques = []
			this.questions.forEach((question, indexQuestion) => {
				const personnes = []
				const pourcentages = []
				const liste = []
				if (question.option === 'choix-unique' || question.option === 'choix-multiples') {
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
				} else if (question.option === 'texte-court') {
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
				} else if (question.option === 'etoiles') {
					for (let i = 0; i < question.etoiles; i++) {
						personnes.push(0)
						pourcentages.push(0)
						liste.push([])
						let reponses = 0
						const utilisateurs = []
						this.reponses.forEach((donnees) => {
							donnees.reponse[indexQuestion].forEach((reponse) => {
								if (!this.bannis.includes(donnees.identifiant) && reponse === (i + 1)) {
									reponses++
									utilisateurs.push(donnees.identifiant)
								}
							})
						})
						if (reponses > 0) {
							personnes[i] = reponses
							const pourcentage = (reponses / this.reponses.length) * 100
							pourcentages[i] = Math.round(pourcentage)
							liste[i] = utilisateurs
						}
					}
				}
				statistiques.push({ personnes: personnes, pourcentages: pourcentages, liste: liste })
			})
			return statistiques
		},
		itemsClasses () {
			let items = []
			if (this.questions[this.indexQuestion].option === 'texte-court') {
				items = this.definirItemsTexte(this.indexQuestion)
			} else if (this.questions[this.indexQuestion].option === 'etoiles') {
				for (let i = 0; i < this.questions[this.indexQuestion].etoiles; i++) {
					items.push({ etoile: i + 1 })
				}
			} else {
				items = JSON.parse(JSON.stringify(this.questions[this.indexQuestion].items))
			}
			items.forEach((item, index) => {
				item.personnes = this.statistiques[this.indexQuestion].personnes[index]
				item.pourcentages = this.statistiques[this.indexQuestion].pourcentages[index]
				item.liste = this.statistiques[this.indexQuestion].liste[index]
				item.alphabet = this.alphabet[index]
			})
			items.sort((a, b) => {
				return b.personnes - a.personnes
			})
			return items
		},
		itemsClassesModale () {
			let items = []
			if (this.questions[this.indexQuestionModale].option === 'texte-court') {
				items = this.definirItemsTexte(this.indexQuestionModale)
			} else if (this.questions[this.indexQuestionModale].option === 'etoiles') {
				for (let i = 0; i < this.questions[this.indexQuestionModale].etoiles; i++) {
					items.push({ etoile: i + 1 })
				}
			} else {
				items = JSON.parse(JSON.stringify(this.questions[this.indexQuestionModale].items))
			}
			items.forEach((item, index) => {
				item.personnes = this.statistiques[this.indexQuestionModale].personnes[index]
				item.pourcentages = this.statistiques[this.indexQuestionModale].pourcentages[index]
				item.liste = this.statistiques[this.indexQuestionModale].liste[index]
				item.alphabet = this.alphabet[index]
			})
			items.sort((a, b) => {
				return b.personnes - a.personnes
			})
			return items
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
		if (Object.keys(this.donnees).length > 0) {
			this.description = this.donnees.description
			this.support = this.donnees.support
			this.options = this.donnees.options
			if (this.statut !== 'attente' && ((this.options.hasOwnProperty('questionsAleatoires') && this.options.questionsAleatoires === true) || (this.options.hasOwnProperty('itemsAleatoires') && this.options.itemsAleatoires === true))) {
				this.questions = this.donneesSession.questions
			} else {
				this.questions = this.donnees.questions
			}
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
		definirItemsTexte (indexQuestion) {
			const items = []
			this.reponses.forEach((donnees) => {
				if (!this.bannis.includes(donnees.identifiant)) {
					donnees.reponse[indexQuestion].forEach((reponse) => {
						if (!items.map((e) => { return e.texte }).includes(reponse.toString().trim())) {
							items.push({ texte: reponse.toString().trim() })
						}
					})
				}
			})
			return items
		},
		definirMoyenne (indexQuestion) {
			let totalPoints = 0
			let totalPersonnes = 0
			this.statistiques[indexQuestion].personnes.forEach((stat, indexStat) => {
				totalPoints = totalPoints + (stat * (indexStat + 1))
				totalPersonnes = totalPersonnes + stat
			})
			return Math.round((totalPoints / totalPersonnes) * 10) / 10
		},
		definirTotalPersonnes (indexQuestion) {
			let totalPersonnes = 0
			this.statistiques[indexQuestion].personnes.forEach((stat) => {
				totalPersonnes = totalPersonnes + stat
			})
			return totalPersonnes
		},
		gererAccordeon (indexQuestion) {
			if (this.accordeonOuvert === indexQuestion) {
				this.accordeonOuvert = -1
			} else {
				this.accordeonOuvert = indexQuestion
			}
			this.$nextTick(() => {
				document.querySelector('#accordeon' + indexQuestion + ' .statut')?.focus()
			})
		},
		modifierIndexQuestion (direction) {
			let indexQuestion
			if (direction === 'suivant') {
				indexQuestion = this.indexQuestion + 1
			} else {
				indexQuestion = this.indexQuestion - 1
			}
			this.$emit('index', indexQuestion)
			this.$nextTick(() => {
				window.typesetMathJax()
			})
		},
		afficherModaleQuestion () {
			if (this.description === '' && Object.keys(this.support).length === 0) {
				this.indexQuestionModale = 0
			} else {
				this.indexQuestionModale = -1
			}
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
			this.indexQuestionModale = -1
			this.$emit('modale', false)
			this.gererFocus()
		},
		modifierIndexQuestionModale (direction) {
			if (direction === 'precedente' && ((this.indexQuestionModale > -1 && (this.description !== '' || Object.keys(this.support).length > 0)) || (this.indexQuestionModale > 0 && this.description === '' && Object.keys(this.support).length === 0))) {
				this.indexQuestionModale--
			} else if (direction === 'suivante' && this.indexQuestionModale < (this.questions.length - 1)) {
				this.indexQuestionModale++
			}
			this.$nextTick(() => {
				window.typesetMathJax()
			})
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

#m_questions .m_q {
	position: absolute;
	top: 20px;
	left: 20px;
	right: 20px;
	bottom: 20px;
	background: #fff;
}

#m_description .video iframe {
	width: 400px;
	height: 225px;
}

@media screen and (max-width: 359px) {
	#m_description .video iframe {
		width: 240px;
		height: 135px;
	}
}

@media screen and (min-width: 360px) and (max-width: 499px) {
	#m_description .video iframe {
		width: 280px;
		height: 158px;
	}
}

#m_questions .etoiles,
#questions .etoiles {
	font-size: 4rem;
	line-height: 1;
}

#m_questions .etoiles i,
#questions .etoiles i {
	color: #aaa;
	line-height: 1;
}

#m_questions .etoiles i.selectionne,
#questions .etoiles i.selectionne {
	color: #fdcc33;
}

@media screen and (max-width: 359px) {
	#m_questions .etoiles,
	#questions .etoiles {
		font-size: 2.2rem;
	}
}

@media screen and (min-width: 360px) and (max-width: 399px) {
	#m_questions .etoiles,
	#questions .etoiles {
		font-size: 2.6rem;
	}
}

@media screen and (min-width: 400px) and (max-width: 499px) {
	#m_questions .etoiles,
	#questions .etoiles {
		font-size: 3rem;
	}
}

@media screen and (min-width: 500px) and (max-width: 599px) {
	#m_questions .etoiles,
	#questions .etoiles {
		font-size: 3.6rem;
	}
}

.items .item + .accordeon {
	margin-top: 20px!important;
}

.items .conteneur-accordeon {
	background: #fff;
	border: 2px solid #eee;
}

.items .en-tete-accordeon {
	display: flex;
	justify-content: space-between;
	padding: 20px;
	background: #eee;
	line-height: 1;
}

.items .en-tete-accordeon .titre {
	display: flex;
	align-items: center;
	width: calc(100% - 19px);
}

.items .en-tete-accordeon .titre-accordeon {
	font-size: 20px;
	font-weight: 700;
	margin: 0 5px;
	width: calc(100% - 27px);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	line-height: 1.2;
	cursor: pointer;
}

.items .contenu-accordeon {
	display: none;
}

.items .contenu-accordeon.ouvert {
	display: block;
	padding: 20px 20px 0;
}

.items .section.accordeon {
	padding: 0!important;
	margin-bottom: 20px!important;
}

.items .accordeon .statut {
	text-align: center;
	font-size: 24px;
	width: 24px;
	cursor: pointer;
}

.items .accordeon .statut {
	margin-right: -5px;
}

.moyenne {
	margin-bottom: 25px!important;
}

.moyenne + h3 {
	display: block;
	width: 100%;
	font-size: 1.8rem;
	font-weight: 700;
	text-align: left;
	margin-bottom: 15px;
}
</style>
