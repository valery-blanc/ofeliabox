<template>
	<div id="page" v-if="identifiant !== '' && role === 'utilisateur'">
		<div id="compte">
			<header>
				<div id="conteneur-header">
					<a id="logo" :href="hote" />

					<div id="titre">
						<span class="titre">{{ $t('monCompte') }}</span>
					</div>

					<div id="parametres">
						<button type="button" class="parametres" :disabled="disabled" :title="$t('afficherParametres')" :aria-label="$t('afficherParametres')" @click="afficherModaleParametres"><i class="material-icons" aria-hidden="true">settings</i></button>
						<button type="button" class="deconnexion" :disabled="disabled" :title="$t('seDeconnecter')" :aria-label="$t('seDeconnecter')" @click="seDeconnecter"><i class="material-icons" aria-hidden="true">power_settings_new</i></button>
					</div>
				</div>
			</header>

			<div id="onglets" class="ascenseur">
				<button type="button" class="onglet" :disabled="disabled" :class="{'actif': onglet === 'contenus-crees'}" @click="modifierOnglet('contenus-crees')">
					<span>{{ $t('contenusCrees') }}</span>
					<span class="badge">{{ interactions.length }}</span>
				</button>
				<button type="button" class="onglet" :disabled="disabled" :class="{'actif': onglet === 'contenus-favoris'}" @click="modifierOnglet('contenus-favoris')">
					<span>{{ $t('favoris') }}</span>
					<span class="badge">{{ favoris.length }}</span>
				</button>
				<button type="button" class="onglet" :disabled="disabled" v-for="(item, indexItem) in dossiers" :class="{'actif': onglet === item.id}" @click="modifierOnglet(item.id)" @dragover="gererDrag" @dragcenter="gererDrag" @drop="glisserDeplacer($event, item.id)" :key="'dossier_' + indexItem">
					<span>{{ item.nom }}</span>
					<span class="badge">{{ item.contenus.length }}</span>
					<div class="menu-dossier">
						<button type="button" class="bouton" :disabled="disabled" :title="$t('modifierDossier')" :aria-label="$t('modifierDossier')" @click="afficherModaleModifierDossier($event, item.id)"><i class="material-icons" aria-hidden="true">edit</i></button>
						<button type="button" class="bouton supprimer" :disabled="disabled" :title="$t('supprimerDossier')" :aria-label="$t('supprimerDossier')" @click="afficherModaleConfirmation($event, item.id, 'supprimer-dossier')"><i class="material-icons" aria-hidden="true">delete</i></button>
					</div>
				</button>
				<button type="button" class="onglet" :disabled="disabled" :class="{'actif': onglet === 'contenus-corbeille'}" @click="modifierOnglet('contenus-corbeille')">
					<span>{{ $t('corbeille') }}</span>
					<span class="badge">{{ corbeille.length }}</span>
				</button>
				<button type="button" class="bouton-ajouter" :disabled="disabled" @click="afficherModaleAjouterDossier">{{ $t('ajouterDossier') }}</button>
			</div>

			<div id="conteneur" class="ascenseur">
				<div class="section">
					<div id="boutons">
						<button type="button" id="bouton-creer" :disabled="disabled" @click="afficherModaleCreer">{{ $t('creer') }}</button>
						<button type="button" id="bouton-importer" :disabled="disabled" @click="afficherModaleImporter">{{ $t('importer') }}</button>
					</div>
					<div id="filtrer">
						<div class="rechercher" role="search" :aria-label="$t('rechercher')">
							<span aria-hidden="true"><i class="material-icons">search</i></span>
							<input type="search" v-model="requete" :disabled="disabled" :placeholder="$t('rechercher')">
						</div>
						<div class="filtrer">
							<span aria-hidden="true"><i class="material-icons">sort</i></span>
							<select id="champ-filtrer" :disabled="disabled" @change="modifierFiltre($event.target.value)">
								<option value="date-desc" :selected="filtre === 'date-desc'">{{ $t('dateDesc') }}</option>
								<option value="date-asc" :selected="filtre === 'date-asc'">{{ $t('dateAsc') }}</option>
								<option value="alpha-desc" :selected="filtre === 'alpha-desc'">{{ $t('alphaDesc') }}</option>
								<option value="alpha-asc" :selected="filtre === 'alpha-asc'">{{ $t('alphaAsc') }}</option>
							</select>
						</div>
					</div>
					<div id="actions-dossier" v-if="onglet !== 'contenus-crees' && onglet !== 'contenus-favoris' && onglet !== 'contenus-corbeille'">
						<div class="conteneur">
							<label>{{ $t('actionsDossier') }}</label>
							<button type="button" :disabled="disabled" class="bouton" :title="$t('modifierDossier')" :aria-label="$t('modifierDossier')" @click="afficherModaleModifierDossier($event, onglet)"><i class="material-icons" aria-hidden="true">edit</i></button>
							<button type="button" :disabled="disabled" class="bouton supprimer" :title="$t('supprimerDossier')" :aria-label="$t('supprimerDossier')" @click="afficherModaleConfirmation($event, onglet, 'supprimer-dossier')"><i class="material-icons" aria-hidden="true">delete</i></button>
						</div>
					</div>
					<div id="actions-corbeille" v-else-if="onglet === 'contenus-corbeille'">
						<button type="button" :disabled="disabled || corbeille.length === 0" @click="afficherModaleConfirmation($event, '', 'vider-corbeille')">{{ $t('viderCorbeille') }}</button>
					</div>
					<div class="interactions" v-if="contenus.length > 0 && requete === ''">
						<div :id="'interaction-' + interaction.code" class="interaction" :class="{'ouvert': interaction.statut === 'ouvert'}" v-for="(interaction, indexInteraction) in contenus" :key="'interaction_' + indexInteraction">
							<a class="type" :href="'/c/' + interaction.code">
								<span>{{ interaction.type.substring(0, 1) }}</span>
							</a>
							<a class="meta" :href="'/c/' + interaction.code" @dragstart="definirId($event, interaction.code)">
								<span class="titre">{{ interaction.titre }} - {{ interaction.code }}</span>
								<span class="dossier" v-if="verifierDossier(interaction.code) && (onglet === 'contenus-crees' || onglet === 'contenus-favoris')"> (📁 {{ verifierTitreDossier(interaction.code) }})</span>
								<span class="date"> - {{ $t('creeLe') }} {{ $formaterDate(interaction.date, langue) }}</span>
							</a>
							<div class="actions">
								<button type="button" class="ajouter-favori" :disabled="disabled" :title="$t('ajouterFavori')" :aria-label="$t('ajouterFavori')" @click="ajouterFavori(interaction)" v-if="!listeFavoris.includes(interaction.code) && onglet !== 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">star_outline</i></button>
								<button type="button" class="supprimer-favori" :disabled="disabled" :title="$t('supprimerFavori')" :aria-label="$t('supprimerFavori')" @click="supprimerFavori(interaction.code)" v-else-if="listeFavoris.includes(interaction.code) && onglet !== 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">star</i></button>
								<button type="button" class="deplacer" :disabled="disabled" :title="$t('ajouterDansDossier')" :aria-label="$t('ajouterDansDossier')" @click="afficherModaleDeplacer(interaction.code)" :class="{'actif': verifierDossier(interaction.code)}" v-if="dossiers.length > 0 && onglet !== 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">drive_file_move</i></button>
								<button type="button" class="dupliquer" :disabled="disabled" :title="$t('dupliquer')" :aria-label="$t('dupliquer')" @click="afficherModaleConfirmation($event, interaction.code, 'dupliquer')" v-if="onglet !== 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">content_copy</i></button>
								<button type="button" class="exporter" :disabled="disabled" :title="$t('exporter')" :aria-label="$t('exporter')" @click="afficherModaleConfirmation($event, interaction.code, 'exporter')" v-if="onglet !== 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">get_app</i></button>
								<button type="button" class="restaurer" :disabled="disabled" :title="$t('restaurer')" :aria-label="$t('restaurer')" @click="restaurer(interaction)" v-if="onglet === 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">restore_from_trash</i></button>
								<button type="button" class="supprimer" :disabled="disabled" :title="$t('supprimer')" :aria-label="$t('supprimer')" @click="afficherModaleConfirmation($event, interaction.code, 'supprimer')" v-if="onglet === 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">delete</i></button>
								<button type="button" class="supprimer" :disabled="disabled" :title="$t('supprimer')" :aria-label="$t('supprimer')" @click="mettreCorbeille(interaction)" v-else><i class="material-icons" aria-hidden="true">delete</i></button>
							</div>
						</div>
					</div>
					<div class="vide" v-else-if="contenus.length === 0 && requete === ''">
						{{ $t('aucuneInteraction') }}
					</div>
					<div class="interactions" v-else-if="resultats.length > 0 && requete !== ''">
						<div :id="'interaction-' + interaction.code" class="interaction" :class="{'ouvert': interaction.statut === 'ouvert'}" v-for="(interaction, indexInteraction) in resultats" :key="'interaction_' + indexInteraction">
							<a class="type" :href="'/c/' + interaction.code">
								<span>{{ interaction.type.substring(0, 1) }}</span>
							</a>
							<a class="meta" :href="'/c/' + interaction.code" @dragstart="definirId($event, interaction.code)">
								<span class="titre">{{ interaction.titre }} - {{ interaction.code }}</span>
								<span class="dossier" v-if="verifierDossier(interaction.code) && (onglet === 'contenus-crees' || onglet === 'contenus-favoris')"> (📁 {{ verifierTitreDossier(interaction.code) }})</span>
								<span class="date"> - {{ $t('creeLe') }} {{ $formaterDate(interaction.date, langue) }}</span>
							</a>
							<div class="actions">
								<button type="button" class="ajouter-favori" :disabled="disabled" :title="$t('ajouterFavori')" :aria-label="$t('ajouterFavori')" @click="ajouterFavori(interaction)" v-if="!listeFavoris.includes(interaction.code) && onglet !== 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">star_outline</i></button>
								<button type="button" class="supprimer-favori" :disabled="disabled" :title="$t('supprimerFavori')" :aria-label="$t('supprimerFavori')" @click="supprimerFavori(interaction.code)" v-else-if="listeFavoris.includes(interaction.code) && onglet !== 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">star</i></button>
								<button type="button" class="deplacer" :disabled="disabled" :title="$t('ajouterDansDossier')" :aria-label="$t('ajouterDansDossier')" @click="afficherModaleDeplacer(interaction.code)" :class="{'actif': verifierDossier(interaction.code)}" v-if="dossiers.length > 0 && onglet !== 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">drive_file_move</i></button>
								<button type="button" class="dupliquer" :disabled="disabled" :title="$t('dupliquer')" :aria-label="$t('dupliquer')" @click="afficherModaleConfirmation($event, interaction.code, 'dupliquer')" v-if="onglet !== 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">content_copy</i></button>
								<button type="button" class="exporter" :disabled="disabled" :title="$t('exporter')" :aria-label="$t('exporter')" @click="afficherModaleConfirmation($event, interaction.code, 'exporter')" v-if="onglet !== 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">get_app</i></button>
								<button type="button" class="restaurer" :disabled="disabled" :title="$t('restaurer')" :aria-label="$t('restaurer')" @click="restaurer(interaction)" v-if="onglet === 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">restore_from_trash</i></button>
								<button type="button" class="supprimer" :disabled="disabled" :title="$t('supprimer')" :aria-label="$t('supprimer')" @click="afficherModaleConfirmation($event, interaction.code, 'supprimer')" v-if="onglet === 'contenus-corbeille'"><i class="material-icons" aria-hidden="true">delete</i></button>
								<button type="button" class="supprimer" :disabled="disabled" :title="$t('supprimer')" :aria-label="$t('supprimer')" @click="mettreCorbeille(interaction)" v-else><i class="material-icons" aria-hidden="true">delete</i></button>
							</div>
						</div>
					</div>
					<div class="vide" v-else-if="resultats.length === 0 && requete !== ''">
						{{ $t('aucunResultat') }}
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-if="modale === 'parametres' || modale === 'motdepasse'">
			<div id="modale-parametres" class="modale" role="dialog" v-if="modale === 'parametres'">
				<header>
					<span class="titre">{{ $t('parametresCompte') }}</span>
					<button type="button" class="fermer" :disabled="disabledParametres" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleParametres"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('parametresCompte')">
						<label>{{ $t('langue') }}</label>
						<div class="langue">
							<button type="button" :disabled="disabledParametres" title="Français" aria-label="Français" :class="{'selectionne': langue === 'fr'}" @click="modifierLangue('fr')">FR</button>
							<button type="button" :disabled="disabledParametres" title="Español" aria-label="Español" :class="{'selectionne': langue === 'es'}" @click="modifierLangue('es')">ES</button>
							<button type="button" :disabled="disabledParametres" title="Italiano" aria-label="Italiano" :class="{'selectionne': langue === 'it'}" @click="modifierLangue('it')">IT</button>
							<button type="button" :disabled="disabledParametres" title="Deutsch" aria-label="Deutsch" :class="{'selectionne': langue === 'de'}" @click="modifierLangue('de')">DE</button>
							<button type="button" :disabled="disabledParametres" title="English" aria-label="English" :class="{'selectionne': langue === 'en'}" @click="modifierLangue('en')">EN</button>
						</div>
						<label for="nom">{{ $t('nomOuPseudo') }}</label>
						<input id="nom" type="text" :value="nom" :disabled="disabledParametres">
						<label for="email">{{ $t('email') }}</label>
						<input id="email" type="text" :value="email" :disabled="disabledParametres">
						<div class="actions modifier">
							<button type="button" class="bouton" :disabled="disabledParametres" @click="modifierInformations">{{ $t('enregistrer') }}</button>
						</div>
						<label>{{ $t('motDePasse') }}</label>
						<div class="actions modifier">
							<button type="button" class="bouton" :disabled="disabledParametres" @click="afficherModaleMotDePasse">{{ $t('modifierMotDePasse') }}</button>
						</div>
						<label>{{ $t('supprimerCompte') }}</label>
						<div class="actions supprimer">
							<button type="button" class="bouton" :disabled="disabledParametres" @click="afficherModaleConfirmation($event, '', 'supprimer-compte')">{{ $t('supprimer') }}</button>
						</div>
					</div>
				</div>
			</div>
			<div id="modale-motdepasse" class="modale" role="dialog" v-else-if="modale === 'motdepasse'">
				<header>
					<span class="titre">{{ $t('modifierMotDePasse') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleMotDePasse"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('modifierMotDePasse')">
						<label for="champ-motdepasse-actuel">{{ $t('motDePasseActuel') }}</label>
						<input id="champ-motdepasse-actuel" type="password" maxlength="48" v-model="motDePasse" :disabled="disabledModale">
						<label for="champ-nouveau-motdepasse">{{ $t('nouveauMotDePasse') }}</label>
						<input id="champ-nouveau-motdepasse" type="password" maxlength="48" v-model="nouveauMotDePasse" :disabled="disabledModale">
						<label for="champ-confirmation-motdepasse">{{ $t('confirmationNouveauMotDePasse') }}</label>
						<input id="champ-confirmation-motdepasse" type="password" maxlength="48" v-model="confirmationNouveauMotDePasse" :disabled="disabledModale" @keydown.enter="modifierMotDePasse">
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="modifierMotDePasse">{{ $t('modifier') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'creer'">
			<div id="modale-creer" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('creerInteraction') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleCreer"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('creerInteraction')">
						<label for="champ-titre">{{ $t('titre') }}</label>
						<input id="champ-titre" type="text" v-model="titre" :disabled="disabledModale" @keydown.enter="creer">
						<label for="champ-type-interaction">{{ $t('typeInteraction') }}</label>
						<select id="champ-type-interaction" value="Sondage" :disabled="disabledModale" @change="type = $event.target.value">
							<option value="Sondage">{{ $t('sondage') }}</option>
							<option value="Questionnaire">{{ $t('questionnaire') }}</option>
							<option value="Remue-méninges">{{ $t('remueMeninges') }}</option>
							<option value="Nuage-de-mots">{{ $t('nuageDeMots') }}</option>
						</select>
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="creer" v-if="!chargementModale">{{ $t('creer') }}</button>
							<div class="conteneur-chargement" v-else>
								<div class="chargement" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'importer'">
			<div id="modale-importer" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('importerInteraction') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleImporter"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('importerInteraction')">
						<div class="conteneur-interrupteur" v-if="progressionImport === 0">
							<span>{{ $t('importerResultats') }}</span>
							<label class="bouton-interrupteur" :tabindex="tabIndexModale" :aria-disabled="disabledModale" @keydown.enter.space.prevent="activerInput('importer-resultats')">
								<input id="importer-resultats" type="checkbox" :checked="parametresImport.resultats" :disabled="disabledModale" @change="modifierParametresImport($event, 'resultats')">
								<span class="barre" />
							</label>
						</div>
						<label for="importer-interaction" class="bouton" :tabindex="tabIndexModale" :aria-disabled="disabledModale" @keydown.enter.space.prevent="activerInput('importer-interaction')" v-if="progressionImport === 0">{{ $t('selectionnerArchive') }}</label>
						<input id="importer-interaction" type="file" style="display: none" accept=".zip" :disabled="disabledModale" @change="importer">
						<div class="conteneur-chargement progression" v-if="progressionImport > 0">
							<progress class="barre-progression" max="100" :value="progressionImport" />
							<div class="chargement" />
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'deplacer'">
			<div id="modale-deplacer" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('ajouterDansDossier') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleDeplacer"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('ajouterDansDossier')">
						<label for="champ-dossier-actuel">{{ $t('dossierActuel') }}</label>
						<input id="champ-dossier-actuel" type="text" :value="$t('aucunDossier')" disabled v-if="dossierActuel.id === 'aucun'">
						<input id="champ-dossier-actuel" type="text" :value="dossierActuel.nom" disabled v-else>
						<label for="champ-dossier">{{ $t('dossierDestination') }}</label>
						<select id="champ-dossier" :disabled="disabledModale">
							<option value="aucun" v-if="dossierActuel.id !== 'aucun'">{{ $t('aucunDossier') }}</option>
							<template v-for="(item, indexItem) in dossiers">
								<option v-if="dossierActuel.id !== item.id" :value="item.id" :key="'dossier_' + indexItem">{{ item.nom }}</option>
							</template>
						</select>
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="deplacer">{{ $t('valider') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'ajouter-dossier'">
			<div id="modale-ajouter-dossier" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('ajouterDossier') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleAjouterDossier"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('ajouterDossier')">
						<label for="champ-nom-dossier">{{ $t('nomDossier') }}</label>
						<input id="champ-nom-dossier" type="text" maxlength="48" :value="dossier" :disabled="disabledModale" @input="dossier = $event.target.value" @keydown.enter="ajouterDossier">
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="ajouterDossier">{{ $t('valider') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'modifier-dossier'">
			<div id="modale-modifier-dossier" class="modale" role="dialog">
				<header>
					<span class="titre">{{ $t('modifierDossier') }}</span>
					<button type="button" class="fermer" :disabled="disabledModale" :title="$t('fermer')" :aria-label="$t('fermer')" @click="fermerModaleModifierDossier"><i class="material-icons" aria-hidden="true">close</i></button>
				</header>
				<div class="conteneur">
					<div class="contenu" role="form" :aria-label="$t('modifierDossier')">
						<label for="champ-nom-dossier">{{ $t('nomDossier') }}</label>
						<input id="champ-nom-dossier" type="text" maxlength="48" :value="dossier" :disabled="disabledModale" @input="dossier = $event.target.value" @keydown.enter="modifierDossier">
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="modifierDossier">{{ $t('valider') }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-if="modaleConfirmation !== ''">
			<div id="modale-confirmation" class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<p v-html="$t('confirmationDupliquerInteraction')" v-if="modaleConfirmation === 'dupliquer'" />
						<p v-html="$t('confirmationExporterInteraction')" v-else-if="modaleConfirmation === 'exporter'" />
						<p v-html="$t('confirmationSupprimerInteraction')" v-else-if="modaleConfirmation === 'supprimer'" />
						<p v-html="$t('confirmationSupprimerCompte')" v-else-if="modaleConfirmation === 'supprimer-compte'" />
						<p v-html="$t('confirmationSupprimerDossier')" v-else-if="modaleConfirmation === 'supprimer-dossier'" />
						<p v-html="$t('confirmationViderCorbeille')" v-else-if="modaleConfirmation === 'vider-corbeille'" />
						<div class="actions">
							<button type="button" class="bouton" :disabled="disabledModale" @click="fermerModaleConfirmation">{{ $t('non') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="dupliquer" v-if="modaleConfirmation === 'dupliquer'">{{ $t('oui') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="exporter" v-else-if="modaleConfirmation === 'exporter'">{{ $t('oui') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="supprimer" v-else-if="modaleConfirmation === 'supprimer'">{{ $t('oui') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="supprimerCompte" v-else-if="modaleConfirmation === 'supprimer-compte'">{{ $t('oui') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="supprimerDossier" v-else-if="modaleConfirmation === 'supprimer-dossier'">{{ $t('oui') }}</button>
							<button type="button" class="bouton" :disabled="disabledModale" @click="viderCorbeille" v-else-if="modaleConfirmation === 'vider-corbeille'">{{ $t('oui') }}</button>
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
import fileSaver from 'file-saver'
const { saveAs } = fileSaver
import ChargementPage from '#root/components/chargement-page.vue'
import Chargement from '#root/components/chargement.vue'
import Message from '#root/components/message.vue'
import Notification from '#root/components/notification.vue'

export default {
	name: 'DigistormUtilisateur',
	components: {
		ChargementPage,
		Chargement,
		Message,
		Notification,
	},
	data () {
		return {
			chargementPage: true,
			chargement: false,
			message: '',
			notification: '',
			modale: '',
			chargementModale: false,
			titre: '',
			code: '',
			type: 'Sondage',
			progressionImport: 0,
			modaleConfirmation: '',
			motDePasse: '',
			nouveauMotDePasse: '',
			confirmationNouveauMotDePasse: '',
			requete: '',
			resultats: [],
			parametresImport: {
				resultats: false
			},
			onglet: 'contenus-crees',
			contenus: [],
			contenuId: '',
			dossier: '',
			dossierId: '',
			dossierActuel: {},
			listeFavoris: [],
			elementPrecedent: null,
			hote: this.$pageContext.pageProps.hote,
			langues: this.$pageContext.pageProps.langues,
			identifiant: this.$pageContext.pageProps.identifiant,
			nom: this.$pageContext.pageProps.nom,
			email: this.$pageContext.pageProps.email,
			langue: this.$pageContext.pageProps.langue,
			role: this.$pageContext.pageProps.role,
			interactions: this.$pageContext.pageProps.interactions,
			favoris: this.$pageContext.pageProps.favoris,
			corbeille: this.$pageContext.pageProps.corbeille,
			dossiers: this.$pageContext.pageProps.dossiers,
			filtre: this.$pageContext.pageProps.filtre
		}
	},
	computed: {
		tabIndexModale () {
			return this.message === '' ? 0 : -1
		},
		disabled () {
			return this.modale === '' && this.message === '' && this.modaleConfirmation === '' ? false : true
		},
		disabledParametres () {
			return this.modaleConfirmation === '' && this.message === '' ? false : true
		},
		disabledModale () {
			return this.message === '' ? false : true
		}
	},
	watch: {
		onglet (onglet) {
			let contenus = []
			if (onglet === 'contenus-crees') {
				contenus = JSON.parse(JSON.stringify(this.interactions))
			} else if (onglet === 'contenus-favoris') {
				contenus = JSON.parse(JSON.stringify(this.favoris))
			} else if (onglet === 'contenus-corbeille') {
				contenus = JSON.parse(JSON.stringify(this.corbeille))
			} else {
				let listeContenus = []
				this.dossiers.forEach((dossier) => {
					if (dossier.id === onglet) {
						listeContenus = dossier.contenus
					}
				})
				this.interactions.forEach((contenu) => {
					if (listeContenus.includes(parseInt(contenu.code))) {
						contenus.push(contenu)
					}
				})
			}
			this.contenus = contenus
			this.requete = ''
			this.filtrer(this.filtre)
		},
		requete () {
			this.rechercher()
		}
	},
	created () {
		const params = this.$pageContext.pageProps.params
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
	},
	mounted () {
		document.getElementsByTagName('html')[0].setAttribute('lang', this.langue)

		this.contenus = JSON.parse(JSON.stringify(this.interactions))
		const favoris = []
		this.favoris.forEach((favori) => {
			favoris.push(favori.code)
		})
		this.listeFavoris = favoris
		this.filtrer(this.filtre)

		this.chargementPage = false

		document.addEventListener('keydown', this.gererClavier, false)
	},
	beforeUnmount () {
		document.removeEventListener('keydown', this.gererClavier, false)
	},
	methods: {
		activerInput (id) {
			document.querySelector('#' + id)?.click()
		},
		afficherModaleParametres () {
			this.modale = 'parametres'
			this.$nextTick(() => {
				document.querySelector('.modale .fermer')?.focus()
			})
		},
		fermerModaleParametres () {
			this.modale = ''
			this.$nextTick(() => {
				document.querySelector('#parametres .parametres')?.focus()
			})
		},
		afficherModaleCreer () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'creer'
			this.$nextTick(() => {
				document.querySelector('#modale-creer input')?.focus()
			})
		},
		fermerModaleCreer () {
			this.modale = ''
			this.titre = ''
			this.type = 'Sondage'
			this.gererFocus()
		},
		creer () {
			if (this.titre.trim() !== '' && this.type !== '') {
				this.chargementModale = true
				const onglets = ['contenus-crees', 'contenus-favoris', 'contenus-corbeille']
				let dossierId = ''
				if (this.onglet !== '' && !onglets.includes(this.onglet)) {
					dossierId = this.onglet
				}
				axios.post(this.hote + '/api/creer-interaction', {
					identifiant: this.identifiant,
					titre: this.titre.trim(),
					type: this.type,
					dossier: dossierId
				}).then((reponse) => {
					window.location.href = '/c/' + reponse.data
				}).catch((err) => {
					this.chargementModale = false
					this.fermerModaleCreer()
					if (err.response?.data === 'non_connecte') {
						window.location.replace('/')
					} else if (err.response?.data === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else if (err.response?.data === 'existe_deja') {
						this.message = this.$t('interactionExisteDeja')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			} else if (this.titre.trim() === '') {
				this.message = this.$t('completerChampTitre')
			} else if (this.type === '') {
				this.message = this.$t('selectionnerTypeInteraction')
			}
		},
		afficherModaleImporter () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'importer'
			this.$nextTick(() => {
				document.querySelector('.modale .fermer')?.focus()
			})
		},
		modifierParametresImport (event, type) {
			this.parametresImport[type] = event.target.checked
		},
		importer () {
			const champ = document.querySelector('#importer-interaction')
			const extension = champ.files && champ.files[0] ? champ.files[0].name.substring(champ.files[0].name.lastIndexOf('.') + 1).toLowerCase() : ''
			if (champ.files && champ.files[0] && extension === 'zip') {
				const formulaire = new FormData()
				formulaire.append('parametres', JSON.stringify(this.parametresImport))
				formulaire.append('fichier', champ.files[0])
				axios.post(this.hote + '/api/importer-interaction', formulaire, {
					onUploadProgress: (progression) => {
						const pourcentage = parseInt(Math.round((progression.loaded * 100) / progression.total))
						this.progressionImport = pourcentage
					}
				}).then((reponse) => {
					this.fermerModaleImporter()
					const donnees = reponse.data
					this.onglet = 'contenus-crees'
					this.contenus.push(donnees)
					this.interactions.push(donnees)
					this.filtrer(this.filtre)
					this.$nextTick(() => {
						document.querySelector('#interaction-' + donnees.code + ' a.meta')?.focus()
					})
					this.notification = this.$t('interactionImportee')
				}).catch((err) => {
					this.fermerModaleImporter()
					if (err.response?.data === 'non_connecte') {
						window.location.replace('/')
					} else if (err.response?.data === 'existe_deja') {
						this.message = this.$t('interactionExisteDeja')
					} else if (err.response?.data === 'donnees_corrompues') {
						this.message = this.$t('donneesCorrompuesImport')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			} else {
				this.message = this.$t('formatFichierPasAccepte')
				champ.value = ''
			}
		},
		fermerModaleImporter () {
			this.modale = ''
			this.parametresImport.resultats = false
			this.progressionImport = 0
			this.gererFocus()
		},
		afficherModaleConfirmation (event, id, type) {
			event.preventDefault()
			event.stopPropagation()
			if (type === 'supprimer-dossier') {
				this.dossierId = id
			} else if (type !== 'supprimer-compte') {
				this.code = id
			}
			this.elementPrecedent = (document.activeElement || document.body)
			this.modaleConfirmation = type
			this.$nextTick(() => {
				document.querySelector('#modale-confirmation .bouton')?.focus()
			})
		},
		fermerModaleConfirmation () {
			this.modaleConfirmation = ''
			this.code = ''
			this.dossierId = ''
			this.gererFocus()
		},
		ajouterFavori (interaction) {
			this.chargement = true
			axios.post(this.hote + '/api/ajouter-favori', {
				code: interaction.code,
				identifiant: this.identifiant
			}).then((reponse) => {
				this.chargement = false
				if (reponse.data === 'favori_ajoute') {
					this.favoris.push(interaction)
					this.listeFavoris.push(interaction.code)
					this.notification = this.$t('interactionAjouteeFavoris')
					this.$nextTick(() => {
						document.querySelector('#interaction-' + interaction.code + ' .supprimer-favori')?.focus()
					})
				} else {
					this.message = this.$t('erreurAjoutFavori')
				}
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'non_connecte') {
					window.location.replace('/')
				} else if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		supprimerFavori (code) {
			this.chargement = true
			axios.post(this.hote + '/api/supprimer-favori', {
				code: code,
				identifiant: this.identifiant
			}).then((reponse) => {
				this.chargement = false
				if (reponse.data === 'favori_supprime') {
					this.favoris = this.favoris.filter((favori) => favori.code !== code)
					this.listeFavoris = this.listeFavoris.filter((favoriCode) => favoriCode !== code)
					if (this.onglet === 'contenus-favoris') {
						this.contenus = this.contenus.filter((contenu) => contenu.code !== code)
						this.resultats = this.resultats.filter((resultat) => resultat.code !== code)
					}
					this.notification = this.$t('interactionSupprimeeFavoris')
					this.$nextTick(() => {
						document.querySelector('#interaction-' + code + ' .ajouter-favori')?.focus()
					})
				} else {
					this.message = this.$t('erreurSuppressionFavoris')
				}
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'non_connecte') {
					window.location.replace('/')
				} else if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		verifierDossier (code) {
			let codeDansDossier = false
			this.dossiers.forEach((dossier) => {
				if (dossier.contenus.includes(parseInt(code))) {
					codeDansDossier = true
				}
			})
			return codeDansDossier
		},
		verifierTitreDossier (code) {
			let titreDossier = ''
			this.dossiers.forEach((dossier) => {
				if (dossier.contenus.includes(parseInt(code))) {
					titreDossier = dossier.nom
				}
			})
			return titreDossier
		},
		afficherModaleDeplacer (code) {
			this.contenuId = parseInt(code)
			let dossierActuel = { id: 'aucun', nom: '' }
			this.dossiers.forEach((dossier) => {
				if (dossier.contenus.includes(this.contenuId)) {
					dossierActuel = { id: dossier.id, nom: dossier.nom }
				}
			})
			this.dossierActuel = dossierActuel
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'deplacer'
			this.$nextTick(() => {
				document.querySelector('.modale select')?.focus()
			})
		},
		deplacer () {
			const destination = document.querySelector('#champ-dossier').value
			if (destination !== this.dossierActuel.id) {
				this.chargement = true
				this.modale = ''
				axios.post(this.hote + '/api/deplacer-interaction', {
					code: this.contenuId,
					destination: destination,
					identifiant: this.identifiant
				}).then(() => {
					this.chargement = false
					this.dossiers.forEach((dossier, indexDossier) => {
						if (dossier.contenus.includes(this.contenuId)) {
							this.dossiers[indexDossier].contenus = dossier.contenus.filter((contenu) => contenu !== this.contenuId)
						}
						if (dossier.id === destination) {
							this.dossiers[indexDossier].contenus.push(this.contenuId)
						}
					})
					if (this.onglet === this.dossierActuel.id) {
						this.contenus = this.contenus.filter((contenu) => contenu.code !== this.contenuId)
						this.resultats = this.resultats.filter((contenu) => contenu.code !== this.contenuId)
					}
					this.notification = this.$t('interactionDeplacee')
					this.fermerModaleDeplacer()
				}).catch((err) => {
					this.chargement = false
					this.fermerModaleDeplacer()
					if (err.response?.data === 'non_connecte') {
						window.location.replace('/')
					} else if (err.response?.data === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		definirId (event, id) {
			event.dataTransfer.setData('id', id)
		},
		gererDrag (event) {
			event.preventDefault()
			event.stopPropagation()
		},
		glisserDeplacer (event, destination) {
			let contenuId = event.dataTransfer.getData('id')
			if (contenuId !== '') {
				contenuId = parseInt(contenuId)
				let dossierActuel = { id: 'aucun', nom: '' }
				this.dossiers.forEach((dossier) => {
					if (dossier.contenus.includes(contenuId)) {
						dossierActuel = { id: dossier.id, nom: dossier.nom }
					}
				})
				if (destination !== dossierActuel.id) {
					this.chargement = true
					axios.post(this.hote + '/api/deplacer-interaction', {
						code: contenuId,
						destination: destination,
						identifiant: this.identifiant
					}).then(() => {
						this.chargement = false
						this.dossiers.forEach((dossier, indexDossier) => {
							if (dossier.contenus.includes(contenuId)) {
								this.dossiers[indexDossier].contenus = dossier.contenus.filter((contenu) => contenu !== contenuId)
							}
							if (dossier.id === destination) {
								this.dossiers[indexDossier].contenus.push(contenuId)
							}
						})
						if (this.onglet === dossierActuel.id) {
							this.contenus = this.contenus.filter((contenu) => contenu.code !== contenuId)
							this.resultats = this.resultats.filter((contenu) => contenu.code !== contenuId)
						}
						this.notification = this.$t('interactionDeplacee')
					}).catch((err) => {
						this.chargement = false
						if (err.response?.data === 'non_connecte') {
							window.location.replace('/')
						} else if (err.response?.data === 'non_autorise') {
							this.message = this.$t('actionNonAutorisee')
						} else {
							this.message = this.$t('erreurCommunicationServeur')
						}
					})
				}
			}
		},
		fermerModaleDeplacer () {
			this.modale = ''
			this.contenuId = ''
			this.dossierActuel = {}
			this.gererFocus()
		},
		dupliquer () {
			this.modaleConfirmation = ''
			this.chargement = true
			const onglets = ['contenus-crees', 'contenus-favoris', 'contenus-corbeille']
			let dossierId = ''
			if (this.onglet !== '' && !onglets.includes(this.onglet)) {
				dossierId = this.onglet
			}
			axios.post(this.hote + '/api/dupliquer-interaction', {
				code: this.code,
				identifiant: this.identifiant,
				dossier: dossierId
			}).then((reponse) => {
				this.chargement = false
				const donnees = reponse.data
				this.contenus.push(donnees)
				this.interactions.push(donnees)
				if (dossierId !== '') {
					this.dossiers.forEach((dossier, indexDossier) => {
						if (dossier.id === dossierId) {
							this.dossiers[indexDossier].contenus.push(parseInt(donnees.code))
						}
					})
				} else {
					this.onglet = 'contenus-crees'
				}
				this.filtrer(this.filtre)
				this.$nextTick(() => {
					document.querySelector('#interaction-' + donnees.code + ' a.meta')?.focus()
				})
				this.notification = this.$t('interactionDupliquee')
				this.code = ''
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'non_connecte') {
					window.location.replace('/')
				} else if (err.response?.data === 'erreur_code') {
					this.message = this.$t('codeNonValide')
				} else if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		exporter () {
			this.modaleConfirmation = ''
			this.chargement = true
			axios.post(this.hote + '/api/exporter-interaction', {
				code: this.code,
				identifiant: this.identifiant,
				admin: ''
			}).then((reponse) => {
				this.chargement = false
				saveAs('/temp/' + reponse.data, this.code + '.zip')
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'non_connecte') {
					window.location.replace('/')
				} else if (err.response?.data === 'erreur_donnees') {
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
		restaurer (interaction) {
			this.chargement = true
			const code = interaction.code
			axios.post(this.hote + '/api/restaurer-interaction', {
				code: code,
				identifiant: this.identifiant
			}).then(() => {
				this.chargement = false
				this.interactions.push(interaction)
				const interactionCorbeille = this.corbeille.find((element) => element.code === code)
				if (interactionCorbeille) {
					if (interactionCorbeille.favori === true) {
						this.favoris.push(interactionCorbeille)
						this.listeFavoris.push(code)
					}
					if (interactionCorbeille.dossier !== '') {
						this.dossiers.forEach((dossier, indexDossier) => {
							if (dossier.id === interactionCorbeille.dossier) {
								this.dossiers[indexDossier].contenus.push(code)
							}
						})
					}
					this.corbeille = this.corbeille.filter((element) => element.code !== code)
				}
				this.contenus = this.contenus.filter((element) => element.code !== code)
				this.resultats = this.resultats.filter((element) => element.code !== code)
				this.filtrer(this.filtre)
				this.notification = this.$t('interactionRestauree')
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'non_connecte') {
					window.location.replace('/')
				} else if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		mettreCorbeille (interaction) {
			this.chargement = true
			const code = interaction.code
			axios.post(this.hote + '/api/mettre-a-la-corbeille', {
				code: code,
				identifiant: this.identifiant
			}).then(() => {
				this.chargement = false
				interaction.favori = false
				interaction.dossier = ''
				if (this.favoris.some((favori) => favori.code === code)) {
					this.favoris = this.favoris.filter((favori) => favori.code !== code)
					interaction.favori = true
				}
				this.dossiers.forEach((dossier, index) => {
					if (dossier.contenus.includes(parseInt(code))) {
						this.dossiers[index].contenus = dossier.contenus.filter((contenu) => contenu !== parseInt(code))
						interaction.dossier = dossier.id
					}
				})
				this.corbeille.push(interaction)
				this.interactions = this.interactions.filter((element) => element.code !== code)
				this.contenus = this.contenus.filter((element) => element.code !== code)
				this.listeFavoris = this.listeFavoris.filter((favoriCode) => favoriCode !== code)
				this.resultats = this.resultats.filter((element) => element.code !== code)
				this.filtrer(this.filtre)
				this.notification = this.$t('interactionMiseCorbeille')
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'non_connecte') {
					window.location.replace('/')
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
				this.chargement = false
				this.corbeille = this.corbeille.filter((element) => element.code !== this.code)
				this.contenus = this.contenus.filter((element) => element.code !== this.code)
				this.resultats = this.resultats.filter((element) => element.code !== this.code)
				this.notification = this.$t('interactionSupprimee')
				this.code = ''
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'non_connecte') {
					window.location.replace('/')
				} else if (err.response?.data === 'erreur_code') {
					this.message = this.$t('codeNonValide')
				} else if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		viderCorbeille () {
			this.modaleConfirmation = ''
			this.chargement = true
			const contenus = this.corbeille.map((element) => element.code)
			axios.post(this.hote + '/api/vider-corbeille', {
				contenus: contenus,
				identifiant: this.identifiant
			}).then(() => {
				this.chargement = false
				this.corbeille = []
				this.contenus = this.contenus.filter((element) => !contenus.includes(element.code))
				this.resultats = this.resultats.filter((element) => !contenus.includes(element.code))
				this.notification = this.$t('corbeilleVidee')
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'non_connecte') {
					window.location.replace('/')
				} else if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		rechercher () {
			const resultats = this.contenus.filter((element) => {
				return element.titre.toLowerCase().includes(this.requete.toLowerCase()) || element.code.toString().includes(this.requete)
			})
			this.resultats = resultats
		},
		filtrer (filtre) {
			let interactions = this.contenus
			if (this.requete !== '') {
				interactions = this.resultats
			}
			switch (filtre) {
			case 'date-asc':
				interactions.sort((a, b) => {
					const dateA = new Date(a.date).getTime()
					const dateB = new Date(b.date).getTime()
					return dateA > dateB ? 1 : -1
				})
				break
			case 'date-desc':
				interactions.sort((a, b) => {
					const dateA = new Date(a.date).getTime()
					const dateB = new Date(b.date).getTime()
					return dateA < dateB ? 1 : -1
				})
				break
			case 'alpha-asc':
				interactions.sort((a, b) => {
					const a1 = a.titre.toLowerCase()
					const b1 = b.titre.toLowerCase()
					return a1 < b1 ? -1 : a1 > b1 ? 1 : 0
				})
				break
			case 'alpha-desc':
				interactions.sort((a, b) => {
					const a1 = a.titre.toLowerCase()
					const b1 = b.titre.toLowerCase()
					return a1 > b1 ? -1 : a1 < b1 ? 1 : 0
				})
				break
			}
			if (this.requete === '') {
				this.contenus = interactions
			} else {
				this.resultats = interactions
			}
		},
		modifierFiltre (filtre) {
			if (this.filtre !== filtre) {
				this.chargement = true
				axios.post(this.hote + '/api/modifier-filtre', {
					identifiant: this.identifiant,
					filtre: filtre
				}).then(() => {
					this.chargement = false
					this.filtrer(filtre)
					this.filtre = filtre
					this.notification = this.$t('filtreModifie')
				}).catch((err) => {
					this.chargement = false
					if (err.response?.data === 'non_connecte') {
						window.location.replace('/')
					} else if (err.response?.data === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		modifierInformations () {
			const nom = document.querySelector('#nom').value.trim()
			const email = document.querySelector('#email').value.trim()
			if ((nom !== '' && nom !== this.nom) || (email !== '' && email !== this.email)) {
				if (email !== '' && this.$verifierEmail(email) === false) {
					this.message = this.$t('erreurEmail')
					return
				}
				this.chargement = true
				axios.post(this.hote + '/api/modifier-informations-utilisateur', {
					identifiant: this.identifiant,
					nom: nom,
					email: email
				}).then(() => {
					this.chargement = false
					this.nom = nom
					this.email = email
					this.notification = this.$t('informationsModifiees')
				}).catch((err) => {
					this.chargement = false
					if (err.response?.data === 'non_connecte') {
						window.location.replace('/')
					} else if (err.response?.data === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		afficherModaleMotDePasse () {
			this.modale = 'motdepasse'
			this.$nextTick(() => {
				document.querySelector('.modale input')?.focus()
			})
		},
		modifierMotDePasse () {
			const motDePasse = this.motDePasse
			const nouveauMotDePasse = this.nouveauMotDePasse
			const confirmationNouveauMotDePasse = this.confirmationNouveauMotDePasse
			if (nouveauMotDePasse === confirmationNouveauMotDePasse) {
				this.chargement = true
				axios.post(this.hote + '/api/modifier-mot-de-passe-utilisateur', {
					identifiant: this.identifiant,
					motdepasse: motDePasse,
					nouveaumotdepasse: nouveauMotDePasse
				}).then(() => {
					this.chargement = false
					this.notification = this.$t('motDePasseModifie')
					this.fermerModaleMotDePasse()
				}).catch((err) => {
					this.chargement = false
					if (err.response?.data === 'non_connecte') {
						window.location.replace('/')
					} else if (err.response?.data === 'motdepasse_incorrect') {
						this.message = this.$t('motDePasseActuelPasCorrect')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			} else {
				this.message = this.$t('nouveauxMotsDePasseCorrespondentPas')
			}
		},
		fermerModaleMotDePasse () {
			this.modale = ''
			this.motDePasse = ''
			this.nouveauMotDePasse = ''
			this.confirmationNouveauMotDePasse = ''
			this.gererFocus()
		},
		modifierLangue (langue) {
			if (this.langue !== langue) {
				this.chargement = true
				axios.post(this.hote + '/api/modifier-langue-utilisateur', {
					identifiant: this.identifiant,
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
					if (err.response?.data === 'non_connecte') {
						window.location.replace('/')
					} else if (err.response?.data === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		modifierOnglet (onglet) {
			this.onglet = onglet
		},
		afficherModaleAjouterDossier () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'ajouter-dossier'
			this.$nextTick(() => {
				document.querySelector('#modale-ajouter-dossier input')?.focus()
			})
		},
		ajouterDossier () {
			if (this.dossier !== '') {
				this.modale = ''
				this.chargement = true
				axios.post(this.hote + '/api/ajouter-dossier', {
					dossier: this.dossier,
					identifiant: this.identifiant
				}).then((reponse) => {
					this.chargement = false
					const donnees = reponse.data
					this.dossiers.push(donnees)
					this.notification = this.$t('dossierAjoute')
					this.dossier = ''
				}).catch((err) => {
					this.chargement = false
					this.dossier = ''
					if (err.response?.data === 'non_connecte') {
						window.location.replace('/')
					} else if (err.response?.data === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		fermerModaleAjouterDossier () {
			this.modale = ''
			this.dossier = ''
			this.gererFocus()
		},
		afficherModaleModifierDossier (event, id) {
			event.preventDefault()
			event.stopPropagation()
			this.dossiers.forEach((dossier) => {
				if (dossier.id === id) {
					this.dossier = dossier.nom
				}
			})
			this.dossierId = id
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'modifier-dossier'
			this.$nextTick(() => {
				document.querySelector('#modale-modifier-dossier input')?.focus()
			})
		},
		modifierDossier () {
			if (this.dossier !== '') {
				this.modale = ''
				this.chargement = true
				axios.post(this.hote + '/api/modifier-dossier', {
					dossier: this.dossier,
					dossierId: this.dossierId,
					identifiant: this.identifiant
				}).then(() => {
					this.chargement = false
					this.dossiers.forEach((dossier, index) => {
						if (dossier.id === this.dossierId) {
							this.dossiers[index].nom = this.dossier
						}
					})
					this.notification = this.$t('dossierModifie')
					this.fermerModaleModifierDossier()
				}).catch((err) => {
					this.chargement = false
					this.fermerModaleModifierDossier()
					if (err.response?.data === 'non_connecte') {
						window.location.replace('/')
					} else if (err.response?.data === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else {
						this.message = this.$t('erreurCommunicationServeur')
					}
				})
			}
		},
		fermerModaleModifierDossier () {
			this.modale = ''
			this.dossier = ''
			this.dossierId = ''
			this.gererFocus()
		},
		supprimerDossier () {
			this.modaleConfirmation = ''
			this.chargement = true
			axios.post(this.hote + '/api/supprimer-dossier', {
				dossierId: this.dossierId,
				identifiant: this.identifiant
			}).then(() => {
				this.chargement = false
				this.dossiers = this.dossiers.filter((dossier) => dossier.id !== this.dossierId)
				this.onglet = 'contenus-crees'
				this.notification = this.$t('dossierSupprime')
				this.dossierId = ''
			}).catch((err) => {
				this.chargement = false
				this.dossierId = ''
				if (err.response?.data === 'non_connecte') {
					window.location.replace('/')
				} else if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		supprimerCompte () {
			this.chargement = true
			axios.post(this.hote + '/api/supprimer-compte', {
				identifiant: this.identifiant,
				admin: ''
			}).then(() => {
				window.location.replace('/')
			}).catch((err) => {
				this.chargement = false
				if (err.response?.data === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.message = this.$t('erreurCommunicationServeur')
				}
			})
		},
		seDeconnecter () {
			this.chargementPage = true
			axios.post(this.hote + '/api/se-deconnecter').then(() => {
				window.location.href = '/'
			}).catch(() => {
				this.chargementPage = false
				this.message = this.$t('erreurCommunicationServeur')
			})
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
			} else if (event.key === 'Escape' && this.modale === 'parametres') {
				this.fermerModaleParametres()
			} else if (event.key === 'Escape' && this.modale === 'motdepasse') {
				this.fermerModaleMotDePasse()
			} else if (event.key === 'Escape' && this.modale === 'creer') {
				this.fermerModaleCreer()
			} else if (event.key === 'Escape' && this.modale === 'importer') {
				this.fermerModaleImporter()
			} else if (event.key === 'Escape' && this.modale === 'deplacer') {
				this.fermerModaleDeplacer()
			} else if (event.key === 'Escape' && this.modale === 'ajouter-dossier') {
				this.fermerModaleAjouterDossier()
			} else if (event.key === 'Escape' && this.modale === 'modifier-dossier') {
				this.fermerModaleModifierDossier()
			} else if (event.key === 'Escape' && this.modale !== '') {
				this.modale = ''
				this.gererFocus()
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
		}
	}
}
</script>

<style scoped>
#compte > header {
	display: flex;
	align-items: center;
	text-align: left;
	background: #242f3d;
	height: 40px;
	width: 100%;
	padding: 0;
	z-index: 100;
	position: relative;
}

#conteneur-header {
	display: flex;
	padding: 0 15px;
	margin: auto;
	width: 100%;
}

#titre {
	margin-left: 15px;
	color: #fff;
	letter-spacing: 0!important;
}

#titre .titre {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

#parametres {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	font-size: 24px;
	margin-left: 20px;
}

#parametres span,
#parametres button {
	color: #fff;
	line-height: 1;
	cursor: pointer;
}

#parametres span:last-child,
#parametres button:last-child {
	margin-left: 20px;
	color: #ff6259;
}

#conteneur {
	position: absolute;
	top: 40px;
	left: 300px;
	padding: 30px 15px;
	height: calc(100% - 40px);
	width: calc(100% - 300px);
	overflow: auto;
	-webkit-overflow-scrolling: touch;
}

#conteneur .section {
	width: 100%;
}

#boutons {
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
	margin-bottom: 15px;
	padding: 0 1.5rem;
}

#bouton-importer,
#bouton-creer {
	display: inline-flex;
	justify-content: center;
	align-items: center;
	width: 150px;
	line-height: 1;
	font-size: 16px;
	font-weight: 700;
	text-transform: uppercase;
	padding: 0.75em 1em;
	border: 2px solid #00ced1;
	border-radius: 2em;
	margin-bottom: 15px;
	background: #46fbff;
	cursor: pointer;
	transition: all ease-in 0.1s;
}

#bouton-creer {
	margin-right: 1em;
}

#bouton-importer:hover,
#bouton-creer:hover {
	text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);
	background: #fff;
}

.vide {
	text-align: center;
	font-size: 16px;
	padding: 25px 0;
	border-top: 1px dotted #ddd;
	border-bottom: 1px dotted #ddd;
	margin: 25px 0 40px;
}

#filtrer {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	margin-bottom: 30px;
	width: 100%;
}

#filtrer .rechercher,
#filtrer .filtrer {
	display: flex;
	align-items: center;
	width: calc(50% - 10px);
}

#filtrer .rechercher {
	margin-right: 20px;
}

#filtrer .filtrer span,
#filtrer .rechercher span {
	font-size: 24px;
	margin-right: 10px;
}

#filtrer .filtrer select,
#filtrer .rechercher input {
	width: calc(100% - 34px);
}

#filtrer select,
#filtrer input[type="search"] {
	font-size: 16px;
	border: 1px solid #ddd;
	border-radius: 4px;
	padding: 10px 15px;
	text-align: left;
}

#filtrer select {
	background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 0 29 14" width="29"><path fill="%23000000" d="M9.37727 3.625l5.08154 6.93523L19.54036 3.625" /></svg>') center right no-repeat;
	padding-right: 30px;
}

#actions-corbeille,
#actions-dossier {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	font-size: 16px;
	margin-bottom: 30px;
}

#actions-dossier .conteneur {
	display: flex;
	justify-content: flex-start;
	align-items: center;
	padding: 3px 10px;
	background: rgba(0, 0, 0, 0.25);
	border-radius: 4px;
}

#actions-dossier button {
	color: #fff;
	font-size: 24px;
	margin-left: 14px;
}

#actions-dossier button.supprimer {
	color: #ff6259;
}

.interactions {
	margin-bottom: 40px;
}

.interaction {
	border-top: 1px solid #ddd;
	padding: 20px 0;
	display: flex;
	align-items: center;
}

.interaction:last-child {
	border-bottom: 1px solid #ddd;
}

.interaction.ouvert .type {
	background: #232f3c;
	color: #fff;
}

.interaction .type {
	width: 40px;
	height: 40px;
	line-height: 40px;
	border-radius: 50%;
	background: #00ced1;
	text-align: center;
	font-weight: 700;
	font-size: 20px;
	margin-right: 15px;
	flex-shrink: 0;
}

.interaction .meta {
	width: calc(100% - 55px);
	flex-grow: 1;
}

.interaction .titre {
	font-size: 18px;
	font-weight: 700;
}

.interaction .date {
	font-size: 12px;
	color: #777;
}

.interaction .actions {
	display: flex;
	margin-left: 5px;
}

.interaction .actions span,
.interaction .actions button {
	font-size: 24px;
	margin-left: 15px;
	line-height: 1;
	cursor: pointer;
}

.interaction .actions span.supprimer-favori,
.interaction .actions button.supprimer-favori {
	color: #fdcc33;
}

.interaction .actions span.supprimer,
.interaction .actions button.supprimer {
	color: #ff6259;
}

.interaction .actions span.deplacer.actif,
.interaction .actions button.deplacer.actif {
	color: #e32f6c;
}

.progression .chargement {
	margin-top: 10px;
}

#onglets {
	position: absolute;
	top: 40px;
	left: 0;
	height: calc(100% - 40px);
	width: 300px;
	padding: 30px 15px;
	border-right: 1px solid #ddd;
	overflow: auto;
	-webkit-overflow-scrolling: touch;
}

#onglets .onglet {
	position: relative;
	display: block;
	width: 100%;
	background: none;
	border: none;
	border-bottom: 3px solid transparent;
	padding: 0 0 5px 0;
	margin-bottom: 20px;
	font-size: 18px;
	color: inherit;
	font-family: inherit;
	text-align: left;
	cursor: pointer;
	user-select: none;
}

#onglets .onglet.actif {
	font-weight: 700;
	border-bottom: 3px solid #00ced1;
}

#actions-corbeille button,
#onglets .bouton-ajouter {
	display: inline-block;
	font-weight: 700;
	font-size: 12px;
	text-transform: uppercase;
	height: 32px;
	line-height: 32px;
	padding: 0 20px;
	color: #001d1d;
	text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.1);
	background: #00ced1;
	border-radius: 5px;
	letter-spacing: 1px;
	text-indent: 1px;
	text-align: center;
	transition: all 0.1s ease-in;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	width: 100%;
	margin-bottom: 30px;
	user-select: none;
	cursor: pointer;
}

#actions-corbeille button:hover,
#onglets .bouton-ajouter:hover {
	color: #fff;
	background: #001d1d;
}

#actions-corbeille button:disabled,
#actions-corbeille button:disabled:hover {
	color: #001d1d;
	background: #bfbfbf;
}

#actions-corbeille button {
	width: auto;
	margin-bottom: 0;
}

#onglets .onglet .menu-dossier {
	visibility: hidden;
	position: absolute;
	color: #fff;
	top: -2.5px;
	right: 0;
	line-height: 1;
	font-size: 24px;
	padding: 3px 10px;
	background: rgba(0, 0, 0, 0.25);
	border-radius: 4px;
	opacity: 0;
	transition: opacity 0.25s ease-in-out;
}

#onglets .onglet:hover .menu-dossier {
	visibility: visible;
	opacity: 1;
}

#onglets .onglet .menu-dossier button.supprimer {
	color: #ff6259;
	cursor: pointer;
}

#onglets .onglet .menu-dossier button + button {
	margin-left: 10px;
}

#onglets .onglet > span {
	vertical-align: middle;
}

#onglets .onglet > span:first-child {
	margin-right: 7px;
}

#onglets .onglet .badge {
	display: inline-block;
	width: 20px;
	height: 20px;
	background: #e32f6c;
	border-radius: 50%;
	font-size: 12px;
	color: #fff;
	line-height: 20px;
	text-align: center;
	vertical-align: middle;
}

#modale-importer label.bouton {
	width: 100%;
	text-align: center;
	margin-bottom: 0;
}

#modale-importer .contenu {
	font-size: 0;
}

.modale .conteneur-interrupteur {
	display: flex;
	justify-content: space-between;
	margin-bottom: 20px;
	line-height: 22px;
}

.modale .conteneur-interrupteur > span {
	font-size: 16px;
}

.modale .bouton-interrupteur {
	position: relative;
	display: inline-block!important;
	width: 38px!important;
	height: 22px;
	margin: 0;
}

.modale .bouton-interrupteur input {
	opacity: 0;
	width: 0;
	height: 0;
}

.modale .bouton-interrupteur .barre {
	position: absolute;
	cursor: pointer;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: #ccc;
	transition: 0.3s;
	border-radius: 30px;
}

.modale .bouton-interrupteur .barre:before {
	position: absolute;
	content: '';
	height: 16px;
	width: 16px;
	left: 3px;
	bottom: 3px;
	background-color: #fff;
	transition: 0.3s;
	border-radius: 50%;
}

.modale .bouton-interrupteur input:checked + .barre {
	background-color: #00ced1;
}

.modale .bouton-interrupteur input:focus + .barre {
	box-shadow: 0 0 1px #00ced1;
}

.modale .bouton-interrupteur input:checked + .barre:before {
	transform: translateX(16px);
}

#modale-confirmation {
	text-align: center;
	max-width: 500px;
}

#modale-confirmation .conteneur {
	padding: 30px 25px;
}

#modale-parametres .bouton {
	width: 100%;
}

#modale-parametres #nom {
	margin-bottom: 10px;
}

#modale-parametres .modifier {
	margin-bottom: 20px;
}

#modale-parametres .supprimer .bouton {
	color: #fff;
	background: #ff6259;
	margin-bottom: 0;
}

#modale-parametres .supprimer .bouton:hover {
	background: #d70b00;
}

@media screen and (orientation: landscape) and (max-height: 359px) {
	#modale-creer {
		height: 90%;
	}
}

@media screen and (orientation: landscape) and (max-height: 479px) {
	#modale-parametres,
	#modale-motdepasse {
		height: 90%;
	}
}

@media screen and (max-width: 399px) {
	#bouton-importer,
	#bouton-creer {
		width: 200px;
	}

	#bouton-creer {
		margin-right: 0;
	}

	#filtrer {
		flex-wrap: wrap;
	}

	#filtrer .rechercher {
		width: 100%;
		margin-right: 0;
		margin-bottom: 15px;
	}

	#filtrer .filtrer {
		width: 100%;
		margin-right: 0;
		margin-bottom: 15px;
	}
}

@media screen and (max-width: 599px) {
	.interaction {
		flex-wrap: wrap;
		padding: 20px 0 10px;
	}

	.interaction .actions {
		width: 100%;
		justify-content: space-around;
		margin-left: 0;
		margin-top: 20px;
		padding-top: 10px;
		border-top: 1px dotted #ddd;
	}

	.interaction .actions span,
	.interaction .actions button {
		margin-left: 0;
	}

	.interaction .type {
		width: 35px;
		height: 35px;
		line-height: 35px;
	}

	.interaction .meta {
		width: calc(100% - 50px);
	}
}

@media screen and (max-width: 1023px) {
	#onglets {
		height: 50px;
		width: 100%;
		display: flex;
		align-items: center;
		padding: 0 15px;
		border-bottom: 1px solid #ddd;
	}

	#onglets .onglet {
		text-align: left;
		padding-bottom: 0;
		margin-right: 20px;
		margin-bottom: 0;
		border-bottom: 3px solid transparent;
		flex: 0 0 auto;
		line-height: 1.5;
	}

	#onglets .onglet:hover .menu-dossier,
	#onglets .onglet .menu-dossier {
		display: none;
	}

	#onglets .bouton-ajouter {
		min-width: 200px;
		max-width: 250px;
		margin-bottom: 0!important;
	}

	#conteneur {
		position: absolute;
		top: 90px;
		left: 0;
		padding: 30px 15px;
		height: calc(100% - 90px);
		width: 100%;
	}
}

@media screen and (min-width: 1024px) and (max-width: 1439px) {
	#onglets {
		width: 230px;
	}

	#conteneur {
		left: 230px;
		width: calc(100% - 230px);
	}
}
</style>
