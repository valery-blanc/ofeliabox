<template>
	<div id="questionnaire">
		<div id="description" class="section">
			<h2>{{ $t('descriptionEtSupportFacultatifs') }}</h2>
			<div class="description">
				<div class="conteneur-textarea" :class="{'media': Object.keys(support).length > 0}">
					<TextareaAutosize v-model="description" :rows="1" :min-height="46" :max-height="94" :placeholder="$t('description')" :disabled="disabled" />
				</div>
				<span class="actions" v-if="chargement === 'media'">
					<span class="conteneur-chargement">
						<span class="chargement" />
						<span class="progression">{{ progression }} %</span>
					</span>
				</span>
				<span class="actions" v-else-if="chargement !== 'media' && Object.keys(support).length === 0">
					<button type="button" :disabled="disabled" :title="$t('ajouterSupport')" :aria-label="$t('ajouterSupport')" @click="afficherAjouterMedia"><i class="material-icons" aria-hidden="true">library_add</i></button>
				</span>
				<button type="button" class="actions media" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="chargement !== 'media' && Object.keys(support).length > 0 && support.lien && support.lien !== ''" @click="afficherMedia(support.lien, '', 'video')" :style="{'background-image': 'url(' + support.vignette + ')'}" />
				<button type="button" class="actions media" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="chargement !== 'media' && Object.keys(support).length > 0 && support.fichier && support.fichier !== '' && support.type === 'image'" @click="afficherMedia(definirCheminFichier(support.fichier), support.alt, 'image')" :style="{'background-image': 'url(' + definirCheminFichier(support.fichier) + ')'}"></button>
				<button type="button" class="actions media audio" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="chargement !== 'media' && Object.keys(support).length > 0 && support.fichier && support.fichier !== '' && support.type === 'audio'" @click="afficherMedia(definirCheminFichier(support.fichier), '', 'audio')">
					<span><i class="material-icons" aria-hidden="true">graphic_eq</i></span>
				</button>
			</div>
		</div>

		<div id="parametres" class="section">
			<h2>{{ $t('parametres') }}</h2>
			<div class="conteneur-parametres" role="form" :aria-label="$t('parametres')">
				<div class="parametre">
					<h3>{{ $t('progression') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" @keydown.enter.space.prevent="activerInput('progression-libre')">{{ $t('progressionLibre') }}
						<input id="progression-libre" type="radio" name="progression" :checked="options.progression === 'libre'" :disabled="disabled" @change="modifierParametres('progression', 'libre')">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" @keydown.enter.space.prevent="activerInput('progression-animateur')">{{ $t('progressionAnimateur') }}
						<input id="progression-animateur" type="radio" name="progression" :checked="options.progression === 'animateur'" :disabled="disabled" @change="modifierParametres('progression', 'animateur')">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre">
					<h3>{{ $t('nomOuPseudo') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('nomOuPseudo') + ' ' + $t('obligatoire')" @keydown.enter.space.prevent="activerInput('nom-obligatoire')">{{ $t('obligatoire') }}
						<input id="nom-obligatoire" type="radio" name="nom" :checked="options.nom === 'obligatoire'" :disabled="disabled" @change="modifierParametres('nom', 'obligatoire')">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('nomOuPseudo') + ' ' + $t('aleatoire')" @keydown.enter.space.prevent="activerInput('nom-aleatoire')">{{ $t('aleatoire') }}
						<input id="nom-aleatoire" type="radio" name="nom" :checked="options.nom === 'aleatoire'" :disabled="disabled" @change="modifierParametres('nom', 'aleatoire')">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('nomOuPseudo') + ' ' + $t('facultatif')" @keydown.enter.space.prevent="activerInput('nom-facultatif')">{{ $t('facultatif') }}
						<input id="nom-facultatif" type="radio" name="nom" :checked="options.nom === 'facultatif'" :disabled="disabled" @change="modifierParametres('nom', 'facultatif')">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre">
					<h3>{{ $t('affichageBonnesReponses') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('affichageBonnesReponses') + ' ' + $t('oui')" @keydown.enter.space.prevent="activerInput('reponses-oui')">{{ $t('oui') }}
						<input id="reponses-oui" type="radio" name="reponses" :checked="options.reponses === 'oui'" :disabled="disabled" @change="modifierParametres('reponses', 'oui')">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('affichageBonnesReponses') + ' ' + $t('repondantUniquement')" @keydown.enter.space.prevent="activerInput('reponses-utilisateur')">{{ $t('repondantUniquement') }}
						<input id="reponses-utilisateur" type="radio" name="reponses" :checked="options.reponses === 'utilisateur'" :disabled="disabled" @change="modifierParametres('reponses', 'utilisateur')">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('affichageBonnesReponses') + ' ' + $t('non')" @keydown.enter.space.prevent="activerInput('reponses-non')">{{ $t('non') }}
						<input id="reponses-non" type="radio" name="reponses" :checked="options.reponses === 'non'" :disabled="disabled" @change="modifierParametres('reponses', 'non')">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre" v-if="(options.reponses === 'oui' || options.reponses === 'utilisateur') && options.progression === 'libre'">
					<h3>{{ $t('retroaction') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('retroaction') + ' ' + $t('oui')" @keydown.enter.space.prevent="activerInput('retroaction-oui')">{{ $t('oui') }}
						<input id="retroaction-oui" type="radio" name="retroaction" :checked="options.retroaction === true" :disabled="disabled" @change="modifierParametres('retroaction', true)">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('retroaction') + ' ' + $t('non')" @keydown.enter.space.prevent="activerInput('retroaction-non')">{{ $t('non') }}
						<input id="retroaction-non" type="radio" name="retroaction" :checked="options.retroaction === false" :disabled="disabled" @change="modifierParametres('retroaction', false)">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre">
					<h3>{{ $t('pointsPersonnalises') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('pointsPersonnalises') + ' ' + $t('oui')" @keydown.enter.space.prevent="activerInput('points-perso-oui')">{{ $t('oui') }}
						<input id="points-perso-oui" type="radio" name="pointsPersonnalises" :checked="options.pointsPersonnalises === true" :disabled="disabled" @change="modifierParametres('pointsPersonnalises', true)">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('pointsPersonnalises') + ' ' + $t('non')" @keydown.enter.space.prevent="activerInput('points-perso-non')">{{ $t('non') }}
						<input id="points-perso-non" type="radio" name="pointsPersonnalises" :checked="options.pointsPersonnalises === false" :disabled="disabled" @change="modifierParametres('pointsPersonnalises', false)">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre" v-if="options.progression === 'animateur'">
					<h3>{{ $t('vitesseCalculPoints') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('vitesseCalculPoints') + ' ' + $t('oui')" @keydown.enter.space.prevent="activerInput('points-vitesse')">{{ $t('oui') }}
						<input id="points-vitesse" type="radio" name="points" :checked="options.points === 'vitesse'" :disabled="disabled" @change="modifierParametres('points', 'vitesse')">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('vitesseCalculPoints') + ' ' + $t('non')" @keydown.enter.space.prevent="activerInput('points-classique')">{{ $t('non') }}
						<input id="points-classique" type="radio" name="points" :checked="options.points === 'classique'" :disabled="disabled" @change="modifierParametres('points', 'classique')">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre" v-if="options.progression === 'animateur' && options.points === 'vitesse'">
					<h3 v-if="options.pointsPersonnalises">{{ $t('pointsRetranchesSeconde') }}</h3>
					<h3 v-else>{{ $t('pointsRetranchesSeconde') }} / 1000</h3>
					<input type="number" :aria-label="$t('pointsRetranchesSeconde')" name="multiplicateur" :value="options.multiplicateur" :disabled="disabled" :min="1" @change="modifierParametres('multiplicateur', parseInt($event.target.value))">
				</div>
				<div class="parametre" v-show="options.progression === 'animateur' && options.nom === 'obligatoire'">
					<h3>{{ $t('affichageClassement') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('affichageClassement') + ' ' + $t('oui')" @keydown.enter.space.prevent="activerInput('classement-oui')">{{ $t('oui') }}
						<input id="classement-oui" type="radio" name="classement" :checked="options.classement === true" :disabled="disabled" @change="modifierParametres('classement', true)">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('affichageClassement') + ' ' + $t('non')" @keydown.enter.space.prevent="activerInput('classement-non')">{{ $t('non') }}
						<input id="classement-non" type="radio" name="classement" :checked="options.classement === false" :disabled="disabled" @change="modifierParametres('classement', false)">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre" v-show="options.progression === 'animateur'">
					<h3>{{ $t('tempsReponse') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('tempsReponse') + ' ' + $t('oui')" @keydown.enter.space.prevent="activerInput('temps-reponse-oui')">{{ $t('oui') }}
						<input id="temps-reponse-oui" type="radio" name="temps-reponse" :checked="options.tempsReponse === true" :disabled="disabled" @change="modifierParametres('tempsReponse', true)">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('tempsReponse') + ' ' + $t('non')" @keydown.enter.space.prevent="activerInput('temps-reponse-non')">{{ $t('non') }}
						<input id="temps-reponse-non" type="radio" name="temps-reponse" :checked="options.tempsReponse === false" :disabled="disabled" @change="modifierParametres('tempsReponse', false)">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre" v-show="options.progression === 'libre'">
					<h3>{{ $t('modaliteReponse') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('modaliteReponse') + ' ' + $t('synchrone')" @keydown.enter.space.prevent="activerInput('modalite-synchrone')">{{ $t('synchrone') }}
						<input id="modalite-synchrone" type="radio" name="modalite" :checked="options.modalite === 'synchrone'" :disabled="disabled" @change="modifierParametres('modalite', 'synchrone')">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('modaliteReponse') + ' ' + $t('asynchrone')" @keydown.enter.space.prevent="activerInput('modalite-asynchrone')">{{ $t('asynchrone') }}
						<input id="modalite-asynchrone" type="radio" name="modalite" :checked="options.modalite === 'asynchrone'" :disabled="disabled" @change="modifierParametres('modalite','asynchrone')">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre">
					<h3>{{ $t('questionsAleatoires') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('questionsAleatoires') + ' ' + $t('oui')" @keydown.enter.space.prevent="activerInput('questions-aleatoires-oui')">{{ $t('oui') }}
						<input id="questions-aleatoires-oui" type="radio" name="questionsAleatoires" :checked="options.questionsAleatoires === true" :disabled="disabled" @change="modifierParametres('questionsAleatoires', true)">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('questionsAleatoires') + ' ' + $t('non')" @keydown.enter.space.prevent="activerInput('questions-aleatoires-non')">{{ $t('non') }}
						<input id="questions-aleatoires-non" type="radio" name="questionsAleatoires" :checked="options.questionsAleatoires === false" :disabled="disabled" @change="modifierParametres('questionsAleatoires', false)">
						<span class="coche" />
					</label>
				</div>
				<div class="parametre">
					<h3>{{ $t('itemsAleatoires') }}</h3>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('itemsAleatoires') + ' ' + $t('oui')" @keydown.enter.space.prevent="activerInput('items-aleatoires-oui')">{{ $t('oui') }}
						<input id="items-aleatoires-oui" type="radio" name="itemsAleatoires" :checked="options.itemsAleatoires === true" :disabled="disabled" @change="modifierParametres('itemsAleatoires', true)">
						<span class="coche" />
					</label>
					<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" :aria-label="$t('itemsAleatoires') + ' ' + $t('non')" @keydown.enter.space.prevent="activerInput('items-aleatoires-non')">{{ $t('non') }}
						<input id="items-aleatoires-non" type="radio" name="itemsAleatoires" :checked="options.itemsAleatoires === false" :disabled="disabled" @change="modifierParametres('itemsAleatoires', false)">
						<span class="coche" />
					</label>
				</div>
			</div>
		</div>

		<draggable id="questions" aria-live="polite" v-model="questions" draggable=".accordeon" handle=".poignee-accordeon" filter=".desactive" :animation="150" :scroll="true" :force-fallback="true" @sort="deplacerQuestion">
			<div :id="'accordeon' + indexQ" class="section accordeon" v-for="(q, indexQ) in questions" :key="'accordeon_' + indexQ">
				<div class="conteneur-accordeon">
					<div class="en-tete-accordeon">
						<div class="titre">
							<span class="poignee poignee-accordeon" :class="{'desactive': questions.length === 1}">
								<i class="material-icons" aria-hidden="true">drag_indicator</i>
							</span>
							<button type="button" class="titre-question" :disabled="disabled" :title="$t('ouvrirFermerAccordeon')" :aria-label="$t('ouvrirFermerAccordeon')" @click="gererAccordeon(indexQ)">
								{{ definirTitre(indexQ) }}
							</button>
						</div>
						<button type="button" class="statut" :disabled="disabled" :title="accordeonOuvert !== indexQ ? $t('ouvrirAccordeon') : $t('fermerAccordeon')" :aria-label="accordeonOuvert !== indexQ ? $t('ouvrirAccordeon') : $t('fermerAccordeon')" @click="gererAccordeon(indexQ)" >
							<i class="material-icons" aria-hidden="true" v-if="accordeonOuvert !== indexQ">add</i>
							<i class="material-icons" aria-hidden="true" v-else>remove</i>
						</button>
					</div>

					<div class="contenu-accordeon">
						<div :id="'question' + indexQ" class="section" :key="'question_' + indexQ" v-if="accordeonOuvert === indexQ">
							<h2>{{ $t('question') }}</h2>
							<div class="question">
								<div class="conteneur-textarea" :class="{'media': Object.keys(q.support).length > 0}">
									<TextareaAutosize v-model="q.question" :rows="1" :min-height="46" :max-height="94" :item-id="'_' + indexQ" :placeholder="$t('question')" :disabled="disabled" />
								</div>
								<span class="actions" v-if="chargement === 'support' + indexQ">
									<span class="conteneur-chargement">
										<span class="chargement" />
										<span class="progression">{{ progression }} %</span>
									</span>
								</span>
								<span class="actions" v-else-if="chargement !== 'support' + indexQ && Object.keys(q.support).length === 0">
									<label :for="'televerser-support' + indexQ" :tabindex="tabIndex" :aria-disabled="disabled" :title="$t('ajouterMedia')" :aria-label="$t('ajouterMedia')" @keydown.enter.space.prevent="activerInput('televerser-support' + indexQ)"><i class="material-icons" aria-hidden="true">library_add</i></label>
									<input :id="'televerser-support' + indexQ" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif, .mp3, .wav, .m4a, .ogg" :disabled="disabled" @change="televerserMediaQuestion(indexQ, 'support', 'Questionnaire')">
								</span>
								<button type="button" class="actions media" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" v-else-if="chargement !== 'support' + indexQ && Object.keys(q.support).length > 0 && q.support.hasOwnProperty('image') && q.support.image !== ''" @click="afficherSupport(indexQ, definirCheminFichier(q.support.image), q.support.alt, 'image')" :style="{'background-image': 'url(' + definirCheminFichier(q.support.image) + ')'}"></button>
								<button type="button" class="actions media audio" :disabled="disabled" :title="$t('afficherAudio')" :aria-label="$t('afficherAudio')" v-else-if="chargement !== 'support' + indexQ && Object.keys(q.support).length > 0 && q.support.hasOwnProperty('audio') && q.support.audio !== ''" @click="afficherSupport(indexQ, definirCheminFichier(q.support.audio), '', 'audio')">
									<span><i class="material-icons" aria-hidden="true">graphic_eq</i></span>
								</button>
							</div>
						</div>

						<div :id="'items' + indexQ" class="section" :key="'items_' + indexQ" v-if="accordeonOuvert === indexQ">
							<h2>{{ $t('reponses') }}</h2>
							<div class="options">
								<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" @keydown.enter.space.prevent="activerInput('choix-unique' + indexQ)">{{ $t('choixUnique') }}
									<input :id="'choix-unique' + indexQ" type="radio" :name="'option' + indexQ" :checked="q.option === 'choix-unique'" :disabled="disabled" @change="modifierOption(indexQ, 'choix-unique')">
									<span class="coche" />
								</label>
								<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" @keydown.enter.space.prevent="activerInput('choix-multiples' + indexQ)">{{ $t('choixMultiples') }}
									<input :id="'choix-multiples' + indexQ" type="radio" :name="'option' + indexQ" :checked="q.option === 'choix-multiples'" :disabled="disabled" @change="modifierOption(indexQ, 'choix-multiples')">
									<span class="coche" />
								</label>
								<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" @keydown.enter.space.prevent="activerInput('texte-court' + indexQ)">{{ $t('texteCourt') }}
									<input :id="'texte-court' + indexQ" type="radio" :name="'option' + indexQ" :checked="q.option === 'texte-court'" :disabled="disabled" @change="modifierOption(indexQ, 'texte-court')">
									<span class="coche" />
								</label>
							</div>
							<draggable class="items" v-model="q.items" draggable=".item" handle=".poignee" filter=".desactive" :animation="150" :scroll="true" :force-fallback="true" v-if="q.option !== 'texte-court'">
								<div :id="'item' + indexQ + '_' + index" class="item" v-for="(item, index) in q.items" :key="'item_' + index">
									<span class="poignee" :class="{'desactive': chargement.substring(0, 5) === 'media' || q.items.length === 1}">
										<i class="material-icons" aria-hidden="true">drag_indicator</i>
									</span>
									<span class="reponse">
										<button type="button" :disabled="disabled" :title="$t('selectionReponseCorrecte')" :aria-label="$t('selectionReponseCorrecte')" v-if="!item.reponse && q.option === 'choix-unique'" @click="selectionnerReponse(indexQ, index)"><i class="material-icons" aria-hidden="true">radio_button_unchecked</i></button>
										<button type="button" :disabled="disabled" :title="$t('selectionReponseCorrecte')" :aria-label="$t('selectionReponseCorrecte')" v-else-if="item.reponse && q.option === 'choix-unique'" @click="selectionnerReponse(indexQ, index)"><i class="material-icons" aria-hidden="true">radio_button_checked</i></button>
										<button type="button" :disabled="disabled" :title="$t('selectionReponseCorrecte')" :aria-label="$t('selectionReponseCorrecte')" v-else-if="!item.reponse && q.option === 'choix-multiples'" @click="selectionnerReponse(indexQ, index)"><i class="material-icons" aria-hidden="true">check_box_outline_blank</i></button>
										<button type="button" :disabled="disabled" :title="$t('selectionReponseCorrecte')" :aria-label="$t('selectionReponseCorrecte')" v-else-if="item.reponse && q.option === 'choix-multiples'" @click="selectionnerReponse(indexQ, index)"><i class="material-icons" aria-hidden="true">check_box</i></button>
									</span>
									<div class="conteneur-textarea" :class="{'media': definirMediaItem(item) === true}">
										<TextareaAutosize v-model="item.texte" :rows="1" :min-height="46" :max-height="94" :item-id="'_' + indexQ + '_' + index" :placeholder="$t('choix') + ' ' + (index + 1)" :disabled="disabled" />
									</div>
									<span class="actions" v-if="chargement === 'media' + indexQ + '_' + index">
										<span class="conteneur-chargement">
											<span class="chargement" />
											<span class="progression">{{ progression }} %</span>
										</span>
										<button type="button" :disabled="disabled || q.items.length === 1" :title="$t('supprimerReponse')" :aria-label="$t('supprimerReponse')" :class="{'desactive': q.items.length === 1}" @click="supprimerItem(indexQ, index)"><i class="material-icons" aria-hidden="true">delete</i></button>
									</span>
									<span class="actions" v-else-if="chargement !== 'media' + indexQ + '_' + index && definirMediaItem(item) === false">
										<label :for="'televerser-media' + indexQ + '_' + index" :tabindex="tabIndex" :aria-disabled="disabled" :title="$t('ajouterMedia')" :aria-label="$t('ajouterMedia')" @keydown.enter.space.prevent="activerInput('televerser-media' + indexQ + '_' + index)"><i class="material-icons" aria-hidden="true">library_add</i></label>
										<input :id="'televerser-media' + indexQ + '_' + index" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif, .mp3, .wav, .m4a, .ogg" :disabled="disabled" @change="televerserMediaQuestion(indexQ, index, 'Questionnaire')">
										<button type="button" :disabled="disabled || q.items.length === 1" :title="$t('supprimerReponse')" :aria-label="$t('supprimerReponse')" :class="{'desactive': q.items.length === 1}" @click="supprimerItem(indexQ, index)"><i class="material-icons" aria-hidden="true">delete</i></button>
									</span>
									<span class="actions" v-else-if="chargement !== 'media' + indexQ + '_' + index && definirMediaItem(item) === true">
										<button type="button" class="image" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherMediaQuestion(indexQ, definirCheminFichier(item.image), item.alt, index, 'image')" :style="{'background-image': 'url(' + definirCheminFichier(item.image) + ')'}" v-if="item.image && item.image !== ''"></button>
										<button type="button" class="audio" :disabled="disabled" :title="$t('afficherAudio')" :aria-label="$t('afficherAudio')" @click="afficherMediaQuestion(indexQ, definirCheminFichier(item.audio), '', index, 'audio')" v-else>
											<span><i class="material-icons" aria-hidden="true">graphic_eq</i></span>
										</button>
										<button type="button" :disabled="disabled || q.items.length === 1" :title="$t('supprimerReponse')" :aria-label="$t('supprimerReponse')" :class="{'desactive': q.items.length === 1}" @click="supprimerItem(indexQ, index)"><i class="material-icons" aria-hidden="true">delete</i></button>
									</span>
								</div>
							</draggable>
							<div class="reponses conteneur-textarea" v-else>
								<TextareaAutosize v-model="q.reponses" :rows="1" :min-height="46" :max-height="94" :placeholder="$t('reponsesAcceptees')" :disabled="disabled" />
							</div>

							<button type="button" :id="'ajouter' + indexQ" class="ajouter" :disabled="disabled" :title="$t('ajouterReponse')" :aria-label="$t('ajouterReponse')" @click="ajouterItem(indexQ, 'Questionnaire')" v-if="q.option !== 'texte-court' && q.items.length < 26"><i class="material-icons" aria-hidden="true">add_circle_outline</i></button>
						</div>

						<div :id="'points' + indexQ" class="section" v-if="options.pointsPersonnalises === true">
							<h2>{{ $t('points') }}</h2>
							<input class="points" type="number" :value="q.points" :disabled="disabled" @input="q.points = parseInt($event.target.value)">
						</div>

						<div :id="'temps' + indexQ" class="section" v-if="options.tempsReponse === true">
							<h2>{{ $t('tempsSecondes') }}</h2>
							<input class="temps" type="number" :value="q.temps" :disabled="disabled" @input="q.temps = parseInt($event.target.value)">
						</div>

						<div :id="'retroaction' + indexQ" class="section" v-if="options.retroaction === true" :key="'retroaction_' + indexQ">
							<h2>{{ $t('retroaction') }}</h2>
							<div class="retroaction">
								<label>{{ $t('retroactionCorrecte') }}</label>
								<div class="conteneur-textarea">
									<TextareaAutosize v-model="q.retroaction.correcte" :rows="1" :min-height="46" :max-height="94" :placeholder="$t('retroactionCorrecte')" :disabled="disabled" />
								</div>
								<label>{{ $t('retroactionIncorrecte') }}</label>
								<div class="conteneur-textarea">
									<TextareaAutosize v-model="q.retroaction.incorrecte" :rows="1" :min-height="46" :max-height="94" :placeholder="$t('retroactionIncorrecte')" :disabled="disabled" />
								</div>
							</div>
						</div>

						<div :id="'actions' + indexQ" class="section" :key="'actions_' + indexQ">
							<button type="button" class="bouton supprimer" :disabled="disabled" @click="supprimerQuestion(indexQ)" v-if="questions.length > 1">{{ $t('supprimer') }}</button>
							<button type="button" class="bouton dupliquer" :disabled="disabled" @click="dupliquerQuestion(indexQ)">{{ $t('dupliquer') }}</button>
						</div>
					</div>
				</div>
			</div>
		</draggable>

		<div class="section">
			<button type="button" id="ajouter-question" class="bouton" :disabled="disabled" @click="ajouterQuestion('Questionnaire')">{{ $t('ajouterQuestion') }}</button>
		</div>

		<div id="message-fin" class="section" v-show="options.progression === 'libre'">
			<h2>{{ $t('messageFin') }}</h2>
			<div class="message-fin">
				<div class="conteneur-textarea">
					<TextareaAutosize v-model="messageFin" :rows="1" :min-height="46" :max-height="94" :disabled="disabled" />
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-if="modale === 'ajouter-media' || modale === 'media' || modale === 'media-question'">
			<div id="modale-ajouter-media" class="modale" role="dialog" v-if="modale === 'ajouter-media'">
				<header>
					<span class="titre">{{ $t('ajouterMedia') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleAjouterMedia"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('ajouterMedia')" v-if="chargement === ''">
						<label for="champ-lien-video">{{ $t('lienVideo') }}</label>
						<div class="valider">
							<input id="champ-lien-video" type="text" v-model="lien" :disabled="disabledModale" @keydown.enter="ajouterVideo">
							<button type="button" :disabled="disabledModale" :title="$t('valider')" :aria-label="$t('valider')" class="bouton-secondaire" @click="ajouterVideo"><i class="material-icons" aria-hidden="true">search</i></button>
						</div>
						<div class="separateur"><span>{{ $t('ou') }}</span></div>
						<label>{{ $t('fichierImageAudio') }}</label>
						<label for="selectionner-media" class="bouton" :tabindex="tabIndexModale" :aria-disabled="disabledModale" @keydown.enter.space.prevent="activerInput('selectionner-media')">{{ $t('selectionnerFichier') }}</label>
						<input id="selectionner-media" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif, .mp3, .wav, .m4a, .ogg" :disabled="disabledModale" @change="televerserMedia($event, 'Questionnaire')">
					</div>
					<div class="contenu" v-else>
						<div class="conteneur-chargement">
							<div class="chargement" />
						</div>
					</div>
				</div>
			</div>
			<div id="modale-media" class="modale" role="dialog" v-else-if="modale === 'media'">
				<header>
					<span class="titre" />
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleMedia"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('modifierMedia')">
						<img v-if="media.type === 'image'" :src="media.fichier" :alt="alt">
						<audio v-else-if="media.type === 'audio'" controls :src="media.fichier" />
						<div class="video" v-else-if="media.type === 'video'">
							<iframe :src="media.lien" allow="autoplay; fullscreen" />
						</div>
						<div class="texte-alt" v-if="media.type === 'image'">
							<label>{{ $t('texteAlternatif') }}</label>
							<div class="champ-texte-alt">
								<TextareaAutosize v-model="alt" :rows="1" :min-height="36" :max-height="72" :disabled="disabledModale" />
							</div>
						</div>
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="afficherAjouterMedia">{{ $t('modifier') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="supprimerMedia">{{ $t('supprimer') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleMedia">{{ $t('fermer') }}</button>
						</div>
					</div>
				</div>
			</div>
			<div id="modale-media" class="modale" role="dialog" v-else-if="modale === 'media-question'">
				<header>
					<span class="titre" />
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleMediaQuestion"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('modifierMedia')">
						<img v-if="media.type === 'image'" :src="media.fichier" :alt="alt">
						<audio v-else-if="media.type === 'audio'" controls :src="media.fichier" />
						<div class="texte-alt" v-if="media.type === 'image'">
							<label>{{ $t('texteAlternatif') }}</label>
							<div class="champ-texte-alt">
								<TextareaAutosize v-model="alt" :rows="1" :min-height="36" :max-height="72" :disabled="disabledModale" />
							</div>
						</div>
						<div class="actions" v-if="indexItem === -1">
							<label :for="'televerser-support' + indexQuestion" class="bouton" :tabindex="tabIndexModale" :aria-disabled="disabledModale" @keydown.enter.space.prevent="activerInput('televerser-support' + indexQuestion)">{{ $t('modifier') }}</label>
							<input :id="'televerser-support' + indexQuestion" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif, .mp3, .wav, .m4a, .ogg" :disabled="disabledModale" @change="televerserMediaQuestion(indexQuestion, 'support', 'Questionnaire')">
							<button type="button" class="bouton" :disabled="disabledModale" @click="supprimerMediaQuestion(indexQuestion, 'support')">{{ $t('supprimer') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleMediaQuestion">{{ $t('fermer') }}</button>
						</div>
						<div class="actions" v-else>
							<label :for="'televerser-media' + indexQuestion + '_' + indexItem" class="bouton" :tabindex="tabIndexModale" :aria-disabled="disabledModale" @keydown.enter.space.prevent="activerInput('televerser-media' + indexQuestion + '_' + indexItem)">{{ $t('modifier') }}</label>
							<input :id="'televerser-media' + indexQuestion + '_' + indexItem" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif, .mp3, .wav, .m4a, .ogg" :disabled="disabledModale" @change="televerserMediaQuestion(indexQuestion, indexItem, 'Questionnaire')">
							<button type="button" class="bouton" :disabled="disabledModale" @click="supprimerMediaQuestion(indexQuestion, indexItem)">{{ $t('supprimer') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleMediaQuestion">{{ $t('fermer') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import methodes from '#root/components/js/methodes-multi-creer'
import TextareaAutosize from '#root/components/textareaAutosize.vue'
import { VueDraggableNext } from 'vue-draggable-next'

export default {
	name: 'DigistormQuestionnaireCreer',
	components: {
		TextareaAutosize,
		draggable: VueDraggableNext
	},
	extends: methodes,
	props: {
		hote: String,
		code: String,
		donnees: Object,
		statut: String,
		enregistrement: String
	},
	data () {
		return {
			description: '',
			support: {},
			options: {
				progression: 'libre',
				nom: 'facultatif',
				reponses: 'oui',
				pointsPersonnalises: false,
				retroaction: false,
				classement: false,
				points: 'classique',
				multiplicateur: 10,
				modalite: 'synchrone',
				questionsAleatoires: false,
				itemsAleatoires: false,
				tempsReponse: false
			},
			questions: [
				{
					question: '',
					support: {},
					option: 'choix-unique',
					items: [{ texte: '', reponse: false }, { texte: '', reponse: false }],
					reponses: '',
					retroaction: { correcte: '', incorrecte: '' },
					points: 1000,
					temps: 20
				}
			],
			accordeonOuvert: 0,
			indexQuestion: 0,
			messageFin: this.$t('messageFinQuestionnaire'),
			chargement: '',
			modale: '',
			lien: '',
			media: {},
			medias: [],
			indexItem: -1,
			alt: '',
			corbeille: [],
			progression: 0,
			elementPrecedent: null
		}
	},
	created () {
		if (Object.keys(this.donnees).length > 0) {
			this.description = this.donnees.description
			this.support = this.donnees.support
			this.options = this.donnees.options
			this.questions = this.donnees.questions
			if (this.options.reponses === true) {
				this.options.reponses = 'oui'
			} else if (this.options.reponses === false) {
				this.options.reponses = 'non'
			}
			if (!this.options.hasOwnProperty('points')) {
				this.options.points = 'classique'
			}
			if (!this.options.hasOwnProperty('pointsPersonnalises')) {
				this.options.pointsPersonnalises = false
			}
			if (!this.options.hasOwnProperty('multiplicateur')) {
				this.options.multiplicateur = 10
			}
			if (!this.options.hasOwnProperty('retroaction')) {
				this.options.retroaction = false
			}
			if (!this.options.hasOwnProperty('questionsAleatoires')) {
				this.options.questionsAleatoires = false
			}
			if (!this.options.hasOwnProperty('itemsAleatoires')) {
				this.options.itemsAleatoires = false
			}
			if (!this.options.hasOwnProperty('tempsReponse')) {
				this.options.tempsReponse = false
			}
			if (!this.options.hasOwnProperty('classement')) {
				this.options.classement = false
			}
			if (!this.options.hasOwnProperty('modalite')) {
				this.options.modalite = 'synchrone'
			}
			this.questions.forEach((question, index) => {
				if (!question.hasOwnProperty('reponses')) {
					this.questions[index].reponses = ''
				}
				if (!question.hasOwnProperty('retroaction')) {
					this.questions[index].retroaction = { correcte: '', incorrecte: '' }
				}
				if (!question.hasOwnProperty('points')) {
					this.questions[index].points = 1000
				}
				if (!question.hasOwnProperty('temps')) {
					this.questions[index].temps = 20
				}
			})
			if (this.donnees.hasOwnProperty('messageFin')) {
				this.messageFin = this.donnees.messageFin
			}
		}
	},
	mounted () {
		this.$nextTick(() => {
			const accordeon = document.querySelector('#accordeon0 .contenu-accordeon')
			accordeon.style.display = 'block'
			if (this.description === '') {
				document.querySelector('#description textarea')?.focus()
			}
		})

		document.addEventListener('keydown', this.gererClavier, false)

		window.addEventListener('beforeunload', this.quitterPage, false)
	},
	beforeUnmount () {
		document.removeEventListener('keydown', this.gererClavier, false)
	},
	methods: {
		modifierParametres (type, valeur) {
			this.options[type] = valeur
			if (this.options.nom !== 'obligatoire') {
				this.options.classement = false
			}
			if (this.options.progression === 'libre') {
				this.options.points = 'classique'
				this.options.classement = false
			} else if (this.options.progression === 'animateur') {
				this.options.modalite = 'synchrone'
				this.options.retroaction = false
			}
		},
		modifierOption (indexQuestion, option) {
			if ((option === 'choix-unique' || option === 'choix-multiples') && !this.questions[indexQuestion].hasOwnProperty('items')) {
				this.questions[indexQuestion].items = [{ texte: '', reponse: false }, { texte: '', reponse: false }]
			}
			this.questions[indexQuestion].option = option
			if (option === 'choix-unique') {
				this.questions[indexQuestion].items.forEach((item) => {
					item.reponse = false
				})
			}
		},
		selectionnerReponse (indexQuestion, indexItem) {
			if (this.questions[indexQuestion].option === 'choix-unique') {
				this.questions[indexQuestion].items.forEach((item) => {
					item.reponse = false
				})
				this.questions[indexQuestion].items[indexItem].reponse = true
			} else {
				this.questions[indexQuestion].items[indexItem].reponse = !this.questions[indexQuestion].items[indexItem].reponse
			}
		}
	}
}
</script>

<style scoped src="#root/components/css/style-multi-creer.css"></style>
