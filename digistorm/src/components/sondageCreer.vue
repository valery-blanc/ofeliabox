<template>
	<div id="sondage">
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
				<button type="button" class="actions media" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="chargement !== 'media' && Object.keys(support).length > 0 && support.fichier && support.fichier !== '' && support.type === 'image'" @click="afficherMedia(definirCheminFichier(support.fichier), support.alt, 'image')" :style="{'background-image': 'url(' + definirCheminFichier(support.fichier) + ')'}" />
				<button type="button" class="actions media audio" :disabled="disabled" :title="$t('afficherSupport')" :aria-label="$t('afficherSupport')" v-else-if="chargement !== 'media' && Object.keys(support).length > 0 && support.fichier && support.fichier !== '' && support.type === 'audio'" @click="afficherMedia(definirCheminFichier(support.fichier), '', 'audio')">
					<span aria-hidden="true"><i class="material-icons">graphic_eq</i></span>
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
									<input :id="'televerser-support' + indexQ" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif, .mp3, .wav, .m4a, .ogg" :disabled="disabled" @change="televerserMediaQuestion(indexQ, 'support', 'Sondage')">
								</span>
								<button type="button" class="actions media" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" v-else-if="chargement !== 'support' + indexQ && Object.keys(q.support).length > 0 && q.support.hasOwnProperty('image') && q.support.image !== ''" @click="afficherSupport(indexQ, definirCheminFichier(q.support.image), q.support.alt, 'image')" :style="{'background-image': 'url(' + definirCheminFichier(q.support.image) + ')'}" />
								<button type="button" class="actions media audio" :disabled="disabled" :title="$t('afficherAudio')" :aria-label="$t('afficherAudio')" v-else-if="chargement !== 'support' + indexQ && Object.keys(q.support).length > 0 && q.support.hasOwnProperty('audio') && q.support.audio !== ''" @click="afficherSupport(indexQ, definirCheminFichier(q.support.audio), '', 'audio')">
									<span aria-hidden="true"><i class="material-icons">graphic_eq</i></span>
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
								<label class="bouton-radio" :tabindex="tabIndex" :aria-disabled="disabled" @keydown.enter.space.prevent="activerInput('etoiles' + indexQ)">{{ $t('etoiles') }}
									<input :id="'etoiles' + indexQ" type="radio" :name="'option' + indexQ" :checked="q.option === 'etoiles'" :disabled="disabled" @change="modifierOption(indexQ, 'etoiles')">
									<span class="coche" />
								</label>
							</div>
							<draggable class="items" v-model="q.items" draggable=".item" handle=".poignee" filter=".desactive" :animation="150" :scroll="true" :force-fallback="true" v-if="q.option !== 'texte-court' && q.option !== 'etoiles'">
								<div :id="'item' + indexQ + '_' + index" class="item" v-for="(item, index) in q.items" :key="'item_' + index">
									<span class="poignee" :class="{'desactive': chargement.substring(0, 5) === 'media' || q.items.length === 1}">
										<i class="material-icons" aria-hidden="true">drag_indicator</i>
									</span>
									<div class="conteneur-textarea" :class="{'media': definirMediaItem(item) === true}">
										<TextareaAutosize v-model="item.texte" :rows="1" :min-height="46" :max-height="94" :item-id="'_' + indexQ + '_' + index" :placeholder="'Choix ' + (index + 1)" :disabled="disabled" />
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
										<input :id="'televerser-media' + indexQ + '_' + index" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif, .mp3, .wav, .m4a, .ogg" :disabled="disabled" @change="televerserMediaQuestion(indexQ, index, 'Sondage')">
										<button type="button" :disabled="disabled || q.items.length === 1" :title="$t('supprimerReponse')" :aria-label="$t('supprimerReponse')" @click="supprimerItem(indexQ, index)" :class="{'desactive': q.items.length === 1}"><i class="material-icons" aria-hidden="true">delete</i></button>
									</span>
									<span class="actions" v-else-if="chargement !== 'media' + indexQ + '_' + index && definirMediaItem(item) === true">
										<button type="button" class="image" :disabled="disabled" :title="$t('afficherImage')" :aria-label="$t('afficherImage')" @click="afficherMediaQuestion(indexQ, definirCheminFichier(item.image), item.alt, index, 'image')" :style="{'background-image': 'url(' + definirCheminFichier(item.image) + ')'}" v-if="item.image && item.image !== ''" />
										<button type="button" class="audio" :disabled="disabled" :title="$t('afficherAudio')" :aria-label="$t('afficherAudio')" @click="afficherMediaQuestion(indexQ, definirCheminFichier(item.audio), '', index, 'audio')" v-else>
											<span aria-hidden="true"><i class="material-icons">graphic_eq</i></span>
										</button>
										<button type="button" :disabled="disabled || q.items.length === 1" :title="$t('supprimerReponse')" :aria-label="$t('supprimerReponse')" @click="supprimerItem(indexQ, index)" :class="{'desactive': q.items.length === 1}"><i class="material-icons" aria-hidden="true">delete</i></button>
									</span>
								</div>
							</draggable>
							<select :disabled="disabled" @change="modifierEtoiles(indexQ, $event)" v-else-if="q.option === 'etoiles'">
								<option value="3" :selected="q.etoiles === 3">3 {{ $t('etoiles').toLowerCase() }}</option>
								<option value="5" :selected="q.etoiles === 5">5 {{ $t('etoiles').toLowerCase() }}</option>
								<option value="7" :selected="q.etoiles === 7">7 {{ $t('etoiles').toLowerCase() }}</option>
								<option value="10" :selected="q.etoiles === 10">10 {{ $t('etoiles').toLowerCase() }}</option>
							</select>

							<button type="button" :id="'ajouter' + indexQ" class="ajouter" :disabled="disabled" :title="$t('ajouterReponse')" :aria-label="$t('ajouterReponse')" @click="ajouterItem(indexQ, 'Sondage')" v-if="q.option !== 'texte-court' && q.option !== 'etoiles' && q.items.length < 26"><i class="material-icons" aria-hidden="true">add_circle_outline</i></button>
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
			<button type="button" id="ajouter-question" class="bouton" :disabled="disabled" @click="ajouterQuestion('Sondage')">{{ $t('ajouterQuestion') }}</button>
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
							<button type="button" class="bouton-secondaire" :disabled="disabledModale" :title="$t('valider')" :aria-label="$t('valider')" @click="ajouterVideo"><i class="material-icons" aria-hidden="true">search</i></button>
						</div>
						<div class="separateur"><span>{{ $t('ou') }}</span></div>
						<label>{{ $t('fichierImageAudio') }}</label>
						<label for="selectionner-media" class="bouton" :tabindex="tabIndexModale" :aria-disabled="disabledModale" @keydown.enter.space.prevent="activerInput('selectionner-media')">{{ $t('selectionnerFichier') }}</label>
						<input id="selectionner-media" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif, .mp3, .wav, .m4a, .ogg" :disabled="disabledModale" @change="televerserMedia($event, 'Sondage')">
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
							<input :id="'televerser-support' + indexQuestion" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif, .mp3, .wav, .m4a, .ogg" :disabled="disabledModale" @change="televerserMediaQuestion(indexQuestion, 'support', 'Sondage')">
							<button type="button" class="bouton" :disabled="disabledModale" @click="supprimerMediaQuestion(indexQuestion, 'support')">{{ $t('supprimer') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleMediaQuestion">{{ $t('fermer') }}</button>
						</div>
						<div class="actions" v-else>
							<label :for="'televerser-media' + indexQuestion + '_' + indexItem" class="bouton" :tabindex="tabIndexModale" :aria-disabled="disabledModale" @keydown.enter.space.prevent="activerInput('televerser-media' + indexQuestion + '_' + indexItem)">{{ $t('modifier') }}</label>
							<input :id="'televerser-media' + indexQuestion + '_' + indexItem" type="file" style="display: none" accept=".jpg, .jpeg, .png, .gif, .mp3, .wav, .m4a, .ogg" :disabled="disabledModale" @change="televerserMediaQuestion(indexQuestion, indexItem, 'Sondage')">
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
	name: 'DigistormSondageCreer',
	inject: ['parent'],
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
				questionsAleatoires: false,
				itemsAleatoires: false
			},
			questions: [
				{
					question: '',
					support: {},
					option: 'choix-unique',
					items: [{ texte: '' }, { texte: '' }]
				}
			],
			accordeonOuvert: 0,
			indexQuestion: 0,
			messageFin: this.$t('messageFinSondage'),
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
			if (!this.options.hasOwnProperty('questionsAleatoires')) {
				this.options.questionsAleatoires = false
			}
			if (!this.options.hasOwnProperty('itemsAleatoires')) {
				this.options.itemsAleatoires = false
			}
			this.questions = this.donnees.questions
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
		},
		modifierOption (indexQ, option) {
			if ((option === 'choix-unique' || option === 'choix-multiples') && !this.questions[indexQ].hasOwnProperty('items')) {
				this.questions[indexQ].items = [{ texte: '' }, { texte: '' }]
			} else if (option === 'etoiles' && !this.questions[indexQ].hasOwnProperty('etoiles')) {
				this.questions[indexQ].etoiles = 5
			}
			this.questions[indexQ].option = option
		},
		modifierEtoiles (indexQ, event) {
			this.questions[indexQ].etoiles = parseInt(event.target.value)
		}
	}
}
</script>

<style scoped src="#root/components/css/style-multi-creer.css"></style>
