// French (fr-FR). The keys mirror en-US.js, the reference catalog; a key
// missing here is looked for along this locale's fallback chain in locales.js,
// then in en-US.js.
//
// Placeholders are written {name} and substituted at render time. Counts that
// change the wording carry .one and .other keys (see en-US.js).

export default {

  // --- shared ------------------------------------------------------------
  'common.theme': 'Thème',
  'common.language': 'Langue',
  'common.back': 'Retour',
  'common.cancel': 'Annuler',
  'common.save': 'Enregistrer',
  'common.submit': 'Envoyer',
  'common.apply': 'Appliquer',
  'common.appearance': 'Apparence',
  'common.appearanceLight': 'Clair',
  'common.appearanceDark': 'Sombre',
  'common.appearanceSystem': 'Système',
  'common.done': 'Terminé',
  'common.close': 'Fermer',
  'common.explicit': 'Explicite',
  'common.restricted': 'Restreint',
  'common.dismiss': 'Ignorer',
  'common.settings': 'Réglages',
  'common.search': 'Rechercher',
  'common.queue': 'File d’attente',
  'common.play': 'Lecture',
  'common.pause': 'Pause',
  'common.stop': 'Arrêter',
  'common.next': 'Suivant',
  'common.previous': 'Précédent',
  'common.shuffle': 'Lecture aléatoire',
  'common.repeat': 'Répéter',
  'common.mute': 'Couper le son',
  'common.unmute': 'Rétablir le son',
  'common.viewAll': 'Tout afficher',
  'common.reconnecting': 'reconnexion',
  'desk.lc.noNetwork': 'Vous devez être connecté à un réseau filaire ou sans fil pour utiliser Sonora. Vérifiez vos paramètres réseau.',
  'desk.lc.noSonora': "Cette page a perdu la connexion à Sonora. Elle se reconnectera d'elle-même dès que Sonora répondra.",
  'local.room': 'Ce navigateur',
  'local.cannotGroup.title': 'Ce navigateur ne peut pas être groupé',
  'local.cannotGroup.detail':
    'Le groupement maintient les enceintes sur une horloge commune, via '
    + 'leur propre réseau. Un navigateur n’y prend aucune part : il joue donc '
    + 'seul.',
  'local.cannotPlay.title': 'Ce navigateur ne peut pas lire cela',
  'local.cannotPlay.needsSpeaker':
    'Seule une enceinte peut le récupérer : un service de musique remet son '
    + 'flux au système, et un partage de bibliothèque musicale est monté par '
    + 'les lecteurs. La radio Internet, elle, s’écoute ici.',
  'local.cannotPlay.unknown':
    'Sonora ne sait pas lire cette source dans un navigateur. La radio '
    + 'Internet, elle, s’écoute ici.',
  'local.cannotPlay.needsQueue':
    'Un album, une liste de lecture ou une file d’attente est une liste de '
    + 'titres, et cette liste appartient à l’enceinte qui la lit. Choisis ici '
    + 'un titre seul ou une station.',
  'local.cannotPlay.needsLink':
    'Sonora parcourt {service} par l’intermédiaire des enceintes et n’a pas '
    + 'de compte propre pour lui demander un flux. Associe le service à '
    + 'Sonora et la lecture fonctionnera ici.',
  'local.cannotPlay.serviceRefused':
    '{service} n’autorise pas Sonora à diffuser ce contenu en dehors de '
    + 'l’écosystème Sonos. Essaie de le diffuser directement sur un lecteur '
    + 'Sonos.',
  'local.cannotPlay.protected':
    '{service} n’autorise pas Sonora à diffuser ce contenu en dehors de '
    + 'l’écosystème Sonos. Essaie de le diffuser directement sur un lecteur '
    + 'Sonos.',
  'local.cannotDo.title': 'Seule une enceinte peut faire cela',
  'local.cannotDo.detail':
    'Ce navigateur est une sortie audio, pas un lecteur : ni égaliseur, ni '
    + 'voyant d’état, ni file d’attente, ni paire stéréo. Le volume, la '
    + 'lecture et la pause fonctionnent.',
  'common.rooms.one': '{count} pièce',
  'common.rooms.other': '{count} pièces',
  'common.speakers.one': '{count} enceinte',
  'common.speakers.other': '{count} enceintes',
  'common.groups.one': '{count} groupe',
  'common.groups.other': '{count} groupes',
  'common.items.one': '{count} élément',
  'common.items.other': '{count} éléments',
  'common.tracks.one': '{count} titre',
  'common.tracks.other': '{count} titres',
  'common.noResults': 'Aucun résultat',
  'common.offline': 'hors ligne',
  'common.system': 'Système {generation}',

  // --- start-up and failure states ---------------------------------------
  'splash.loading.title': 'Recherche d’enceintes',
  'splash.loading.detail':
    'Envoi d’une requête de découverte, puis interrogation de la première '
    + 'enceinte qui répond pour connaître le reste du système.',
  'splash.empty.title': 'Aucune enceinte trouvée',
  'splash.empty.detail':
    'La découverte utilise le multicast : la machine qui exécute ce '
    + 'contrôleur doit être sur le même réseau que les enceintes, et non sur '
    + 'un réseau invité ou un autre VLAN.',
  'splash.error.title': 'Contrôleur injoignable',
  'splash.error.detail':
    'Le serveur n’a pas répondu. Vérifie qu’il est bien en cours '
    + 'd’exécution.',
  'splash.searchAgain': 'Relancer la recherche',
  'splash.crash.title': 'Ce thème ne fonctionne plus',
  'splash.crash.detail': 'Un problème est survenu pendant son affichage. Rechargez la page ou choisissez un autre design ci-dessous.',
  'splash.reload': 'Recharger',
  'rating.cannotUndo': '{service} ne permet pas d\'annuler ceci',
  'splash.connected': 'Connecté au contrôleur',
  'splash.notConnected': 'Non connecté',

  // --- notices ------------------------------------------------------------
  'notice.conflict.title': 'L’enceinte a refusé',
  'notice.skipLimit.title': 'Limite de sauts atteinte',
  'notice.skipLimit.body': 'Vous avez atteint la limite de sauts de cette station. Réessayez plus tard.',
  'notice.silent.title': 'L’enceinte n’a pas répondu',
  'notice.silent.body':
    '{room} a cessé de répondre un instant. Elle revient généralement '
    + 'd’elle-même ; réessaie dans quelques secondes.',
  'notice.error.title': 'Une erreur est survenue',
  'notice.network.title': 'Erreur réseau',

  // --- what a room is doing ----------------------------------------------
  'search.category.artists': 'Artistes',
  'search.category.albums': 'Albums',
  'search.category.tracks': 'Morceaux',
  'search.category.playlists': 'Listes de lecture',
  'search.category.stations': 'Stations',
  'search.category.genres': 'Genres',
  'search.category.podcasts': 'Podcasts et émissions',
  'search.category.shows': 'Podcasts et émissions',
  'search.category.audiobooks': 'Livres audio',
  'search.category.people': 'Personnes',
  'search.category.episodes': 'Épisodes',
  'search.category.hosts': 'Animateurs',
  'source.queue': 'File d’attente',
  'source.grouped': 'Groupé',
  'source.line_in': 'Entrée ligne',
  'source.radio': 'Radio',
  'source.service_stream': 'Radio',
  'source.service_radio': 'Radio',
  'source.service_hls': 'Radio',
  'source.service_track': 'Service de streaming',
  'source.service_container': 'Service de streaming',
  'source.library_track': 'Bibliothèque musicale',
  'source.http_stream': 'Flux réseau',
  'source.external_session': 'AirPlay ou Spotify Connect',
  'source.tv': 'Téléviseur',
  'source.playlist': 'Liste de lecture',
  'source.idle': 'Inactif',
  'source.unknown': 'Source inconnue',

  // --- web theme ----------------------------------------------------------
  'common.noMusicSelected': 'Aucune musique sélectionnée',
  'common.queueIsEmpty': 'La file d’attente est vide',
  'common.roomsGrouped': '{count} pièces groupées',
  'common.groupLabel': '{room} + {count}',
  'common.nothingQueued': 'Rien dans la file d’attente',
  'common.setActive': 'Activer {room}',
  'common.openQueue': 'Ouvrir la file d’attente',
  'common.seek': 'Naviguer dans le titre',
  'common.live': 'En direct',
  'common.tv': 'Téléviseur',
  'desk.browse.lineIn': 'Entrée ligne',
  'desk.browse.noSelections': 'Aucune sélection disponible.',
  'desk.browse.lineInNone':
    'Pour utiliser l’entrée ligne, connecte un appareil à un produit Sonos '
    + 'doté d’une entrée ligne.',
  'common.kind.playlist': 'Liste de lecture',
  'common.kind.album': 'Album',

  // grouping

  // queue

  // settings
  'net.connection': 'Connexion',
  'net.live': 'en direct',
  'net.rescan': 'Réanalyser le réseau',

  // a service's own page
  'services.needsAccount':
    '{service} n’affichera rien sans le jeton de connexion de ton compte. '
    + 'Ce jeton est conservé par les enceintes et n’est jamais exposé sur le '
    + 'réseau : son catalogue ne peut donc pas être parcouru ici. Ce qui en a '
    + 'été enregistré dans les Favoris Sonos ou les listes de lecture Sonos '
    + 'reste lisible.',

  // --- Sonos account, network check and TV audio, used across themes -------
  'account.title': 'Compte Sonos',
  'account.blurb': 'Vos enceintes déjà configurées donnent à Sonora tout ce dont il a besoin pour contrôler votre système Sonos au quotidien.',
  'account.optional': 'La connexion à votre compte Sonos est facultative. Elle affiche la liste complète des services de musique configurés sur votre système avec leurs logos, les services Sonos Labs disponibles et le nom de l\'entrée TV qu\'une barre de son est en train de lire.',
  'account.signIn': 'Se connecter',
  'account.signOut': 'Se déconnecter',
  'account.signingIn': 'Connexion…',
  'account.email': 'E-mail',
  'account.password': 'Mot de passe',
  'account.signedInAs': 'Connecté en tant que : {email}',
  'account.notSignedIn': 'non connecté',
  'net.scanning': 'Analyse du réseau…',
  'net.scanDone': '{rooms} trouvées dans {systems}',
  'common.systems.one': '{count} système',
  'common.systems.other': '{count} systèmes',
  'source.noSignal': 'Aucun signal',
  'desk.now.tvInput': 'Entrée',
  'desk.now.tvFormat': 'Format',
  'tvFormat.0': 'Aucune entrée connectée',
  'tvFormat.2': 'Stéréo',
  'tvFormat.7': 'Dolby 2.0',
  'tvFormat.18': 'Dolby 5.1',
  'tvFormat.21': 'Aucune entrée',
  'tvFormat.22': 'Aucun son',
  'tvFormat.59': 'Dolby Atmos (DD+)',
  'tvFormat.61': 'Dolby Atmos (TrueHD)',
  'tvFormat.63': 'Dolby Atmos (MAT 2.0)',
  'tvFormat.33554434': 'PCM 2.0',
  'tvFormat.33554454': 'PCM 2.0 sans son',
  'tvFormat.33554488': 'Dolby 2.0',
  'tvFormat.33554490': 'Dolby Digital Plus 2.0',
  'tvFormat.33554492': 'Dolby TrueHD 2.0',
  'tvFormat.33554494': 'Dolby PCM multicanal 2.0',
  'tvFormat.84934658': 'PCM multicanal 5.1',
  'tvFormat.84934713': 'Dolby 5.1',
  'tvFormat.84934714': 'Dolby Digital Plus 5.1',
  'tvFormat.84934716': 'Dolby TrueHD 5.1',
  'tvFormat.84934718': 'Dolby PCM multicanal 5.1',
  'tvFormat.84934721': 'DTS 5.1',
  'tvFormat.118489090': 'PCM multicanal 7.1',
  'tvFormat.118489146': 'Dolby Digital Plus 7.1',
  'tvFormat.118489148': 'Dolby TrueHD 7.1',

  // --- Sonos macOS Desktop theme ------------------------------------------------
  'desk.menu.edit': 'Édition',
  'desk.menu.view': 'Affichage',
  'desk.menu.manage': 'Gérer',
  'desk.menu.help': 'Aide',
  'desk.menu.preferences': 'Préférences…',
  'desk.menu.checkUpdates': 'Rechercher les mises à jour…',
  'desk.menu.cut': 'Couper',
  'desk.menu.copy': 'Copier',
  'desk.menu.paste': 'Coller',
  'desk.menu.mainWindow': 'Contrôleur Sonos',
  'desk.menu.miniController': 'Mini-contrôleur',
  'desk.menu.musicLibrarySettings': 'Paramètres de la bibliothèque musicale…',
  'desk.menu.serviceSettings': 'Paramètres des services…',
  'desk.menu.addRadioStation': 'Ajouter une station de radio…',
  'desk.radio.myShows': 'Mes émissions de radio',
  'desk.radio.changeLocation': 'Changer de lieu',
  'desk.radio.enterZip': 'Saisir le code postal',
  'desk.radio.zipBody': 'Saisis ton code postal :',
  'desk.radio.pickCity': 'Choisir une ville',
  'desk.radio.locationSet': 'La radio locale est maintenant {city}.',
  'desk.radio.localRadio': 'Radio locale',
  'desk.radio.localRadioIn': 'Radio locale ({city})',
  'desk.radio.myStations': 'Mes stations de radio',
  'desk.radio.addNew': 'Ajouter une nouvelle station de radio',
  'desk.playlists.new': 'Nouvelle liste de lecture',
  'desk.playlists.addTitle': 'Ajouter le morceau à une liste de lecture',
  'desk.playlists.removeSong': 'Supprimer le morceau',
  'desk.playlists.removedSong': '{title} a été retiré de la liste de lecture.',
  'desk.playlists.added': '{title} a été ajouté à {playlist}.',
  'desk.playlists.addedMany': '{count} morceaux ont été ajoutés à {playlist}.',
  'desk.playlists.nameTitle': 'Nommer cette liste de lecture',
  'desk.playlists.nameBody': 'Nomme cette liste de lecture :',
  'desk.playlists.rename': 'Renommer la liste de lecture',
  'desk.playlists.renameBody':
    'Saisis un nouveau nom pour cette liste de lecture :',
  'desk.playlists.delete': 'Supprimer la liste de lecture',
  'desk.playlists.deleted': '« {title} » a été supprimée.',
  'desk.queue.editedTitle': 'La file d’attente a été modifiée',
  'desk.queue.editedBody':
    'Lancer cette lecture remplacera la file d’attente.',
  'desk.queue.playAnyway': 'Lire quand même',
  'desk.radio.title': 'Ajouter une station de radio',
  'desk.radio.intro':
    'Saisis les informations de la nouvelle station de radio.',
  'desk.radio.where':
    'La nouvelle station sera ajoutée à TuneIn > Mes stations de radio.',
  'desk.radio.url': 'URL du flux',
  'desk.radio.name': 'Nom de la station',
  'desk.radio.added': '« {title} » a été ajoutée à Mes stations de radio.',
  'desk.radio.exists': '« {title} » figure déjà dans Mes stations de radio.',
  'desk.menu.updateLibrary':
    'Mettre à jour la bibliothèque musicale maintenant',
  'desk.menu.systemHelp': 'Aide du système Sonos',
  'desk.menu.supportSite': 'Site d’assistance technique',
  'desk.menu.submitDiagnostics': 'Envoyer un diagnostic',
  'desk.menu.about': 'À propos de mon système Sonos',
  'desk.menu.disabledNote':
    'Les éléments grisés ne sont disponibles que dans l’application Sonos.',
  'desk.transport.groupVolume': 'Volume du groupe',
  'desk.transport.back30': 'Reculer de 30 secondes',
  'desk.transport.forward30': 'Avancer de 30 secondes',
  'desk.transport.repeatOff': 'Répétition désactivée',
  'desk.transport.repeatOne': 'Répéter le morceau',
  'desk.transport.repeatAll': 'Tout répéter',
  'desk.transport.crossfade': 'Fondu enchaîné',
  'desk.rooms.title': 'Pièces',
  'desk.rooms.system': 'Système',
  'desk.rooms.pauseAll': 'Tout mettre en pause',
  'desk.rooms.pause': 'Pause',
  'desk.rooms.confirmPauseAll':
    'Veux-tu vraiment mettre en pause la musique de toutes les pièces ?',
  'desk.rooms.playGroup': 'Lire le groupe',
  'desk.rooms.pauseGroup': 'Mettre le groupe en pause',
  'desk.rooms.stopGroup': 'Arrêter le groupe',
  'desk.rooms.offline': 'Hors ligne',
  'desk.rooms.batteryLevel': '{level} %',
  'desk.rooms.battery': 'Batterie {level} %',
  'desk.rooms.batteryCharging': 'Batterie {level} %, en charge',
  'desk.now.title': 'Lecture en cours',
  'desk.now.next': 'Suivant',
  'desk.now.noMusic': '[Aucune musique sélectionnée]',
  'desk.now.episode': 'Épisode',
  'desk.now.podcast': 'Podcast',
  'desk.now.releaseDate': 'Date de sortie',
  'desk.now.chapter': 'Chapitre',
  'desk.now.author': 'Auteur',
  'desk.now.narrator': 'Narrateur',
  'desk.now.book': 'Livre',
  'desk.now.station': 'Station',
  'desk.now.onNow': 'À l’antenne',
  'desk.now.information': 'Informations',
  'desk.now.zp.connecting': 'Connexion...',
  'desk.now.zp.buffering': 'Démarrage...',
  'desk.now.zp.starting': 'Démarrage...',
  'desk.now.artist': 'Artiste',
  'desk.now.album': 'Album',
  'desk.now.song': 'Morceau [{n}/{total}]',
  'desk.now.songLabel': 'Morceau',
  'desk.now.infoOptions': 'Infos et options',
  'desk.now.thumbsUp': 'J’aime',
  'desk.now.thumbsDown': 'Je n’aime pas',
  'desk.info.source': 'Source',
  'desk.info.room': 'Pièce',
  'desk.info.duration': 'Durée',
  'desk.info.station': 'Station',
  'desk.info.addMyStations': 'Ajouter à Mes stations de radio',
  'desk.info.removeMyStations': 'Retirer de Mes stations de radio',
  'desk.radio.removedMine': '{title} a été retiré de Mes stations de radio',
  'desk.info.addMyShows': 'Ajouter à Mes émissions de radio',
  'desk.radio.addedMine': '{title} a été ajoutée à Mes stations de radio',
  'desk.radio.addedShow': '{title} a été ajoutée à Mes émissions de radio',
  'desk.radio.alreadyShow': '{title} figure déjà dans Mes émissions de radio',
  'desk.radio.alreadyMine': '{title} figure déjà dans Mes stations de radio',
  'desk.info.startRadio': 'Lancer la radio',
  'desk.info.addToServicePlaylist':
    'Ajouter le morceau à une liste de lecture {service}',
  'desk.info.saveToMusic': 'Enregistrer dans Ma musique',
  'desk.info.addSongFavorite': 'Ajouter le morceau aux Favoris Sonos',
  'desk.info.removeFavorite': 'Retirer des Favoris Sonos',
  'desk.info.removedFavorite': '{title} a été retiré des Favoris Sonos',
  'desk.info.albumInfo': 'Infos sur l’album',
  'desk.info.artistInfo': 'Infos sur l’artiste',
  'desk.info.podcastInfo': 'Infos sur le podcast',
  'desk.info.provider': 'Fournisseur',
  'desk.info.addEpisodeFavorite': 'Ajouter l’épisode aux Favoris Sonos',
  'desk.info.addEpisodePlaylist':
    'Ajouter l’épisode à une liste de lecture Sonos',
  'desk.info.actionDone': 'Terminé.',
  'desk.info.actionFailed': 'Le service a refusé la demande.',
  'desk.info.viewAllSongs': 'Voir tous les morceaux de l’album',
  'desk.info.addAlbumFavorite': 'Ajouter l’album aux Favoris Sonos',
  'desk.info.addBookFavorite': 'Ajouter le livre aux Favoris Sonos',
  'desk.info.addAlbumPlaylist': 'Ajouter l’album à une liste de lecture Sonos',
  'desk.info.addToSonosPlaylist':
    'Ajouter le morceau à une liste de lecture Sonos',
  'desk.info.addStationFavorite': 'Ajouter la station aux Favoris Sonos',
  'desk.info.addedFavorite': '« {title} » a été ajouté aux Favoris Sonos.',
  'desk.info.alreadyFavorite':
    '« {title} » figure déjà dans les Favoris Sonos.',
  'desk.queue.title': 'File d’attente',
  'desk.queue.notInUse': '(Non utilisée)',
  'desk.queue.collapse': 'Afficher la lecture en cours',
  'desk.queue.expand': 'Agrandir la file d’attente',
  'desk.queue.songs.one': '{count} morceau',
  'desk.queue.songs.other': '{count} morceaux',
  'desk.queue.empty': 'La file d’attente est vide',
  'win.queue.empty': 'La file d’attente est vide.',
  'win.queue.confirmTitle': 'Confirmer',
  'win.queue.confirmClear': 'Veux-tu vraiment vider la file d’attente ?',
  'win.queue.clearAction': 'Vider',
  'desk.queue.clear': 'Vider la file d’attente',
  'desk.queue.save': 'Enregistrer la file d’attente',
  'desk.queue.confirmClear': 'Vider la file d’attente',
  'desk.queue.playSong': 'Lire le morceau',
  'desk.queue.removeSong': 'Supprimer le morceau',
  'desk.queue.playEpisode': 'Lire l’épisode',
  'desk.queue.removeEpisode': 'Supprimer l’épisode',
  'desk.queue.playTrack': 'Lire le titre {n}',
  'desk.browse.root': 'Sélectionner une source de musique',
  'desk.browse.music': 'Musique',
  'desk.browse.favorites': 'Favoris Sonos',
  'desk.browse.updateNow': 'Mettre à jour maintenant',
  'desk.update.title': 'Mise à jour disponible',
  'desk.update.body': 'Une mise à jour est prête pour tes enceintes Sonos : version {version}. La musique s\'arrête dans chaque pièce pendant l\'installation, qui peut prendre plusieurs minutes.',
  'desk.update.bodySystem': 'Une mise à jour est prête pour tes enceintes Sonos {system} : version {version}. La musique s\'arrête dans chaque pièce pendant l\'installation, qui peut prendre plusieurs minutes.',
  'desk.update.start': 'Mettre à jour',
  'desk.update.notNow': 'Pas maintenant',
  'desk.update.started': 'La mise à jour a commencé. Chaque pièce redémarre une fois terminée.',
  'desk.browse.library': 'Bibliothèque musicale',
  'desk.browse.playlists': 'Listes de lecture Sonos',
  'desk.browse.radio': 'TuneIn',
  'desk.browse.addServices': 'Ajouter des services de musique',
  'desk.browse.addServicesFor': 'Ajouter des services de musique {gen}',
  'desk.browse.switchAccount': 'Changer de compte',
  'desk.browse.sleepTimer': 'Minuteur de veille',
  'desk.browse.alarms': 'Alarmes',
  'desk.browse.results': 'Résultats : {query}',
  'desk.search.in': 'Rechercher dans {service}',
  'desk.search.clear': 'Effacer la recherche',
  'desk.search.recent': 'Recherches récentes',
  'desk.search.clearRecent': 'Effacer les recherches récentes',
  'desk.search.scope': 'Choisir la portée de la recherche',
  'desk.browse.noResults':
    'La recherche n’a donné aucun résultat pour « {query} ». Essaie une '
    + 'autre catégorie ou un nouveau terme.',
  'desk.browse.selectRoom':
    'Sélectionne une pièce pour parcourir la musique qui lui est destinée.',
  'desk.browse.loading': 'Chargement…',
  'desk.browse.empty': 'Aucune sélection disponible.',
  'desk.browse.unableToBrowse': 'Impossible de parcourir la musique',
  'desk.browse.actions': 'Plus d’options',
  'desk.browse.select': 'Sélectionner',
  'desk.browse.needsLink.body':
    '{service} est associé à ton système Sonos {gen}.\nPour le parcourir et '
    + 'le contrôler, tu devras également l’associer à Sonora. Il s’agit d’une '
    + 'connexion distincte, qui ne touche pas à ton application Sonos.',
  'desk.browse.needsLink.action': 'Associer {service} à Sonora',
  'desk.actions.playNow': 'Lire maintenant',
  'desk.actions.playNext': 'Lire ensuite',
  'desk.actions.addToQueue': 'Ajouter à la fin de la file d’attente',
  'desk.actions.addFavorite': 'Ajouter aux Favoris Sonos',
  'desk.actions.unselectAll': 'Tout désélectionner',
  'desk.actions.replaceQueue': 'Remplacer la file d’attente',
  'desk.favorites.addToSonosPlaylist': 'Ajouter à une liste de lecture Sonos',
  'desk.favorites.addToServicePlaylist':
    'Ajouter à une liste de lecture {service}',
  'desk.favorites.rename': 'Renommer le favori Sonos',
  'desk.favorites.remove': 'Retirer des Favoris Sonos',
  'desk.favorites.renameBody': 'Saisis un nouveau nom pour ce favori Sonos :',
  'desk.favorites.removed': '« {title} » a été retiré des Favoris Sonos.',
  'common.ok': 'OK',
  'desk.grouping.title': 'Grouper les pièces',
  'desk.grouping.willPlay': 'Les pièces sélectionnées liront :',
  'desk.grouping.select': 'Sélectionner les pièces à regrouper :',
  'desk.grouping.partyMode': 'Tout sélectionner – Mode fête',
  'desk.grouping.noMusic': '[aucune musique]',
  'desk.grouping.chooseMusic': 'Clique sur Terminé pour choisir la musique',
  'desk.grouping.pickTitle': 'Choisir la musique',
  'desk.grouping.pickHeading':
    'Choisis la musique à lire dans la pièce sélectionnée',
  'desk.grouping.unselectAll': 'Tout désélectionner',
  'desk.grouping.noneTitle': 'Pas de pièce sélectionnée',
  'desk.grouping.noneBody': 'Toute la musique en cours de lecture sera arrêtée. Veux-tu continuer ?',
  'desk.grouping.noneYes': 'Oui',
  'desk.prefs.title': 'Préférences',
  'desk.prefs.general': 'Général',
  'desk.prefs.basic': 'Base',
  'desk.prefs.themeShot': 'Aperçu du thème {theme}',
  'desk.prefs.themeNoShot': 'Aucun aperçu pour ce thème.',
  'desk.prefs.themeVersion': 'version {version}',
  'desk.prefs.themeInstalled': 'installé',
  'desk.prefs.manageThemes': 'Gérer les thèmes',
  'desk.prefs.themeUpload': 'Installer un thème…',
  'desk.prefs.themeDelete': 'Supprimer le thème',
  'desk.prefs.themeBuiltIn':
    'Les thèmes fournis avec Sonora ne peuvent pas être supprimés.',
  'desk.room.nightSound': 'Son nocturne',
  'desk.room.speech': 'Amélioration des dialogues',
  'desk.room.sub': 'Caisson',
  'desk.room.subLevel': 'Niveau du caisson',
  'desk.room.surround': 'Surround',
  'desk.room.surroundLevel': 'Niveau TV',
  'desk.room.musicSurroundLevel': 'Niveau musique',
  'desk.room.audioDelay': 'Retard audio (synchro labiale)',
  'desk.room.heightLevel': 'Niveau des voies en hauteur',
  'desk.room.lineInName': 'Nom de la source d’entrée ligne',
  'desk.room.lineInLevel': 'Niveau de la source d’entrée ligne',
  'desk.room.autoplayRoom': 'Pièce de lecture automatique',
  'desk.room.autoplayOff': 'Désactivé',
  'desk.room.autoplayLinked': 'Inclure les pièces groupées',
  'desk.room.autoplayUseVolume': 'Utiliser le volume de lecture automatique',
  'desk.room.autoplayVolume': 'Volume de lecture automatique',
  'desk.room.stereoPair': 'Paire stéréo',
  'desk.room.separate': 'Séparer la paire stéréo',
  'desk.room.separateBody':
    'Séparer la paire stéréo « {room} » en deux pièces ? La lecture '
    + 's’arrête pendant que les enceintes se reconfigurent.',
  'desk.room.pairWith': 'Choisir l’enceinte droite…',
  'desk.room.createPair': 'Créer une paire stéréo',
  'desk.room.pairBody':
    'Faire de « {left} » le canal gauche et de « {right} » le canal droit '
    + 'd’une même paire stéréo ? La paire conserve le nom « {left} » ; la '
    + 'lecture s’arrête pendant que les enceintes se reconfigurent.',
  'desk.rooms.showMore': 'Afficher {n} de plus…',
  'desk.rooms.showLess': 'Afficher moins…',
  'desk.rooms.allSystems': 'Tous',
  'desk.rooms.menu.play': 'Lire {name}',
  'desk.rooms.menu.pause': 'Mettre {name} en pause',
  'desk.rooms.menu.stop': 'Arrêter {name}',
  'desk.rooms.menu.mute': 'Couper le son de {name}',
  'desk.rooms.menu.unmute': 'Rétablir le son de {name}',
  'desk.rooms.menu.eq': 'Égaliseur de {name}…',
  'desk.rooms.menu.group': 'Grouper',
  'desk.prefs.musicLibrary': 'Paramètres de la bibliothèque musicale',
  'desk.prefs.services': 'Paramètres des services',
  'desk.prefs.parental': 'Contrôle parental',
  'desk.prefs.dateTime': 'Réglages de date et d’heure',
  // The Mac Preferences window (S1 57.x on Tahoe, 2026-09-15).
  'desk.prefs.eqSettings': 'Réglages de l’égaliseur',
  'desk.prefs.musicLibraryShort': 'Bibliothèque musicale',
  'desk.prefs.servicesShort': 'Services',
  'desk.prefs.dateTimeShort': 'Date et heure',
  'desk.prefs.sonora': 'Sonora',
  'desk.prefs.mobileNote':
    'Ouvre l’application Sonos sur un appareil mobile pour gérer ton '
    + 'système.',
  'desk.prefs.getMobileApp': 'Obtenir l’application mobile',
  'desk.prefs.eqFor': 'Réglages de l’égaliseur musique pour',
  'desk.prefs.eqCaption': 'Règle les aigus et les graves à ta convenance.',
  'desk.prefs.roomFor': 'Réglages de la pièce pour',
  'desk.prefs.noRooms': 'Aucune pièce Sonos n’a été trouvée.',
  'desk.prefs.folderCol': 'Dossier',
  'desk.prefs.pathCol': 'Chemin',
  'desk.prefs.serviceNameCol': 'Nom du service',
  'desk.prefs.nameCol': 'Nom',
  'desk.prefs.loginCol': 'Identifiant du compte',
  'desk.prefs.anonymous': '<Anonyme>',
  'desk.prefs.changeName': 'Modifier le nom',
  'desk.prefs.reauthorize': 'Réautoriser le compte',
  'desk.prefs.visitLabs': 'Visiter Sonos Labs',
  'desk.menu.settings': 'Réglages…',
  // The Mac app's sheets and About window (2026-09-15).
  'desk.queue.confirmTitle': 'Confirmer',
  'desk.queue.clearBody': 'Veux-tu vraiment vider la file d’attente ?',
  'desk.queue.enterName': 'Saisis un nouveau nom de liste de lecture :',
  'desk.queue.orReplace':
    'Ou sélectionne une liste de lecture Sonos existante à remplacer :',
  'desk.sleep.setFor': 'Définir un minuteur de veille pour « {room} » :',
  'desk.about.sonosOs': 'Sonos OS',
  'desk.about.products': 'Produits',
  'desk.about.systemLine': 'Sonos OS {gen} : {count} produits',
  'desk.about.serial': 'Numéro de série',
  'desk.about.hardware': 'Version du matériel',
  'desk.about.series': 'ID de série',
  'desk.about.ip': 'Adresse IP',
  'desk.about.wm': 'WM',
  'desk.about.copy': 'Copier',
  'desk.about.copied': 'Copié',
  'desk.alarms.note':
    'Les alarmes se créent et se modifient dans l’application Sonos ; ici, '
    + 'on peut les activer, les désactiver ou les supprimer.',
  'desk.alarms.deleteBody': 'Supprimer l’alarme de {time} dans {room} ?',
  'desk.alarms.deleteTitle': 'Supprimer l’alarme',
  'desk.alarms.recurrence.WEEKENDS': 'Week-ends',
  'desk.alarms.recurrence.WEEKDAYS': 'Jours de semaine',
  'desk.alarms.recurrence.DAILY': 'Tous les jours',
  'desk.alarms.recurrence.ONCE': 'Une fois',
  'desk.alarms.repeat': 'Répéter',
  'desk.alarms.room': 'Pièce',
  'desk.alarms.time': 'Heure',
  'desk.alarms.enabled': 'Activée',
  'desk.alarms.delete': 'Supprimer',
  'desk.alarms.none': 'Aucune alarme sur ce système.',
  'win.saveQueue.name': 'Saisis un nouveau nom de liste de lecture :',
  'win.saveQueue.replace':
    'Ou sélectionne une liste de lecture Sonos existante à remplacer :',
  'win.alarm.addTitle': 'Ajouter une alarme',
  'win.alarm.editTitle': 'Modifier l’alarme',
  'win.alarm.alarm': 'Alarme',
  'win.alarm.on': 'Activée',
  'win.alarm.off': 'Désactivée',
  'win.alarm.music': 'Musique',
  'win.alarm.select': 'Sélectionner…',
  'win.alarm.schedule': 'Programmation',
  'win.alarm.onceOnly': 'Une seule fois',
  'win.alarm.volume': 'Volume',
  'win.alarm.duration': 'Durée',
  'win.alarm.noLimit': 'Sans limite',
  'win.alarm.linked': 'Inclure les pièces groupées',
  'win.alarm.shuffle': 'Lecture aléatoire',
  'win.alarm.chime': 'Carillon Sonos',
  'win.alarm.browseTitle': 'Parcourir la musique d’alarme',
  'win.alarm.alarmMusic': 'Musique de l’alarme',
  'win.alarm.importedPlaylists': 'Listes de lecture importées',
  'win.alarm.setMusic': 'Définir la musique de l’alarme',
  'win.alarm.day.1': 'Lundi',
  'win.alarm.day.2': 'Mardi',
  'win.alarm.day.3': 'Mercredi',
  'win.alarm.day.4': 'Jeudi',
  'win.alarm.day.5': 'Vendredi',
  'win.alarm.day.6': 'Samedi',
  'win.alarm.day.0': 'Dimanche',
  'win.alarms.manage': 'Gérer les alarmes Sonos',
  'win.alarms.currentTime': 'Heure actuelle : {time}',
  'desk.alarms.currentTime': 'Heure actuelle : {date} - {time} {zone}',
  'win.alarms.where': 'Où',
  'win.alarms.when': 'Quand',
  'win.alarms.on': 'ACTIVÉE',
  'win.alarms.add': 'Ajouter',
  'win.alarms.edit': 'Modifier',
  'win.alarms.remove': 'Supprimer',
  'win.alarms.deleteConfirm': 'Veux-tu vraiment supprimer cette alarme ?',
  'win.alarms.help1': 'Ajouter',
  'win.alarms.help2': 'Supprimer',
  'desk.alarms.day.0': 'Dim',
  'desk.alarms.day.1': 'Lun',
  'desk.alarms.day.2': 'Mar',
  'desk.alarms.day.3': 'Mer',
  'desk.alarms.day.4': 'Jeu',
  'desk.alarms.day.5': 'Ven',
  'desk.alarms.day.6': 'Sam',
  'desk.queue.saveHint': 'Nom de la liste de lecture',
  'desk.queue.saveBody':
    'La file d’attente sera enregistrée comme liste de lecture Sonos.',
  'desk.queue.saveTitle': 'Enregistrer la file d’attente',
  'desk.queue.mixName': 'Mix du {weekday} {part}',
  'desk.queue.part.morning': 'matin',
  'desk.queue.part.afternoon': 'après-midi',
  'desk.queue.part.night': 'soir',
  'desk.sleep.none': 'Aucun minuteur de veille défini.',
  'desk.sleep.elsewhere': 'Également actif ailleurs',
  'desk.sleep.remaining': 'Minuteur de veille : {time} restantes',
  'desk.sleep.minutes': '{count} minutes',
  'desk.sleep.off': 'Désactivé',
  'desk.sleep.hours.one': '{count} heure',
  'desk.sleep.hours.other': '{count} heures',
  'services.needsSignIn':
    '{service} exige une connexion avant d’afficher quoi que ce soit. '
    + 'Associe-le à Sonora pour le parcourir ici ; ce qui en a été enregistré '
    + 'dans les Favoris Sonos ou les listes de lecture Sonos reste lisible.',
  'desk.library.folders': 'Dossiers',
  'desk.library.advanced': 'Avancé',
  'desk.library.mine': 'Mes dossiers de musique sur Sonos',
  'desk.library.none':
    'Aucun dossier de musique n’a été ajouté à ce système Sonos.',
  'desk.library.addFolder': 'Ajouter…',
  'desk.library.add': 'Ajouter',
  'desk.library.remove': 'Supprimer',
  'desk.library.pathHint': '//nas/Musique',
  'desk.library.pathNote':
    'Sonora ajoute les dossiers par leur chemin réseau (par exemple '
    + '//nas/Musique). Le dossier doit déjà être partagé sur ton réseau. Les '
    + 'lecteurs S1 n’acceptent que les partages SMBv1 ; les lecteurs S2 '
    + 'parlent aussi SMBv2 et SMBv3.',
  'desk.shareWizard.windowTitle': 'Configuration de Sonora',
  'desk.shareWizard.whereTitle': 'Ajouter un dossier de musique',
  'desk.shareWizard.wherePrompt': 'Où se trouve la musique que tu veux écouter sur Sonos ?',
  'desk.shareWizard.myMusic': 'Dossier Musique',
  'desk.shareWizard.otherFolder': 'Un autre dossier ou un disque connecté à mon ordinateur',
  'desk.shareWizard.network': 'Appareil réseau (par ex. un disque NAS)',
  'desk.shareWizard.serverNote': 'Sonora tourne sur un serveur, les dossiers de cet ordinateur sont donc hors de sa portée : il peut ajouter un dossier partagé sur ton réseau.',
  'desk.shareWizard.pathTitle': 'Ajouter de la musique depuis ton partage réseau',
  'desk.shareWizard.pathPrompt': 'Saisis le chemin de ton partage réseau :',
  'desk.shareWizard.loginTitle': 'Nom d\'utilisateur et mot de passe',
  'desk.shareWizard.loginPrompt': 'Saisis le nom d\'utilisateur et le mot de passe du disque réseau qui contient ta musique. Laisse-les vides pour un partage qui n\'en demande pas.',
  'desk.shareWizard.fieldLabel': '{label} :',
  'desk.shareWizard.adding': 'Ajout des informations du partage au système Sonos.',
  'desk.shareWizard.done': '« {path} » est maintenant configuré sur ton système Sonos. Sa musique est ajoutée à la bibliothèque.',
  'desk.shareWizard.failedTitle': 'Sonos n\'a pas pu ajouter le dossier de musique',
  'desk.shareWizard.pathExamples': 'Exemples :\n\\\\MyOtherComputer\\Shared\\Music\n\\\\MyNetworkedStorage\\Shared\\Music',
  'desk.library.username': 'Nom d’utilisateur',
  'desk.library.password': 'Mot de passe',
  'desk.library.credHint':
    'Ne laisse les deux champs vides que si le partage autorise les '
    + 'invités. Beaucoup de serveurs ne le font plus.',
  'desk.library.removeTitle': 'Supprimer le dossier de musique',
  'desk.library.removeBody':
    'Retirer {folder} de la bibliothèque musicale de ton système Sonos ? La '
    + 'musique qu’il contient n’apparaîtra plus dans Sonos.',
  'desk.library.indexTitle': 'Mises à jour de la bibliothèque',
  'desk.library.schedule': 'Mettre à jour l’index musical chaque jour à',
  'desk.library.updateNow': 'Mettre à jour l’index musical maintenant',
  'desk.library.noFolders': 'Tu n\'as encore ajouté aucun dossier de musique à ton système Sonos.',
  'desk.library.addHint': 'Pour ajouter de la musique à Sonos, choisis {link} dans le menu {menu}.',
  'desk.library.working':
    'Mise à jour des paramètres de ta bibliothèque musicale…',
  'desk.library.indexing':
    'Mise à jour de la bibliothèque musicale… Patiente.',
  'desk.library.indexError':
    'Sonos n’a pas pu terminer la mise à jour de l’index musical : {error}',
  'desk.library.addPending':
    'Sonos ajoute encore ce dossier. Il apparaîtra ici une fois monté par '
    + 'les lecteurs.',
  'desk.library.adding': 'Ajout du dossier de musique',
  'desk.library.addedIndexing':
    'Ajouté. Sonos met à jour l’index musical, ce qui peut prendre '
    + 'plusieurs minutes pour un dossier volumineux.',
  'desk.library.addingPath':
    '{path} — les lecteurs sont en train de le monter. Cela peut prendre '
    + 'plusieurs minutes pour un dossier volumineux.',
  'desk.library.addFailed':
    'Sonos n’a pas pu ajouter le dossier de musique {path}.',
  'desk.library.addFailedWhy':
    'Vérifie que le chemin du dossier, ainsi que le nom d’utilisateur et le '
    + 'mot de passe si nécessaire, sont corrects.',
  'desk.library.addReason': 'Motif : {reason}',
  'desk.library.compilations': 'Grouper les albums selon',
  'desk.library.updateDaily': 'Mettre à jour le contenu chaque jour à :',
  'desk.library.showContributing':
    'Afficher les artistes participants dans la bibliothèque musicale. '
    + 'Cette préférence ne concerne que ce contrôleur.',
  'desk.library.sortFolders': 'Trier les dossiers par',
  'desk.library.sort.songNumber': 'Numéro de piste',
  'desk.library.sort.songName': 'Nom du morceau',
  'desk.library.sort.fileName': 'Nom de fichier',
  'desk.library.artists': 'Artistes',
  'desk.library.contributingArtists': 'Artistes participants',
  'desk.library.albums': 'Albums',
  'desk.library.composers': 'Compositeurs',
  'desk.library.genres': 'Genres',
  'desk.library.songs': 'Morceaux',
  'desk.library.importedPlaylists': 'Listes de lecture importées',
  'desk.library.foldersNode': 'Dossiers',
  'desk.library.groupBy': 'Grouper les compilations selon',
  'desk.library.group.ITUNES': 'Compilations iTunes®',
  'desk.library.group.WMP': 'Artistes d’album',
  'desk.library.group.NONE': 'Ne pas grouper les compilations',
  'desk.library.compilationsNote':
    'Modifier le groupement des compilations met à jour l’index musical.',
  'desk.time.timeZone': 'Fuseau horaire',
  'desk.time.autoDst': 'Ajuster automatiquement à l’heure d’été',
  'desk.time.internet': 'Régler la date et l’heure depuis Internet',
  'desk.time.date': 'Date',
  'desk.time.time': 'Heure',
  'desk.time.dateFormat': 'Format de date',
  'desk.time.timeFormat': 'Format d’heure',
  'desk.time.fmt.MDY': 'Mois/Jour/Année',
  'desk.time.fmt.DMY': 'Jour/Mois/Année',
  'desk.time.fmt.YMD': 'Année/Mois/Jour',
  'desk.time.fmt.12H': '12 heures',
  'desk.time.fmt.24H': '24 heures',
  'desk.time.notSet': 'Non défini',
  'desk.time.setNow': 'Régler',
  'desk.time.loading': 'Lecture des réglages d’heure…',
  'desk.time.server': 'Serveur de temps : {server}',
  'desk.parental.body':
    'Le filtrage des contenus explicites est un réglage propre à ton '
    + 'système Sonos, partagé par toutes les applications qui le pilotent. '
    + 'Sonora le lit sur tes enceintes et l’affiche ci-dessous.\nLe modifier '
    + 'exige une autorisation que Sonos ne délivre qu’à ses propres '
    + 'applications : les enceintes acceptent l’écriture de n’importe quel '
    + 'contrôleur, mais uniquement avec un jeton émis pour l’application '
    + 'Sonos, et la seule permission que Sonos propose aux autres '
    + 'développeurs ne couvre que la lecture. L’application Sonos peut le '
    + 'faire ; celle-ci attend Sonos.\nTous les services ne prennent pas en '
    + 'charge le filtrage des contenus.',
  'desk.parental.filter': 'Filtrer les contenus explicites',
  'desk.parental.filterFor': 'Filtrer les contenus explicites sur {system}',
  'desk.parental.on': 'Filtres de contenu activés',
  'desk.parental.off': 'Filtres de contenu désactivés',
  'desk.parental.unknown': 'Impossible de lire l’état des filtres de contenu',
  'desk.parental.reading': 'Lecture du réglage…',
  'desk.parental.turnOn': 'Activer le filtrage des contenus explicites',
  'desk.parental.moreInfo': 'Plus d’informations',
  'desk.parental.unavailable':
    'Sonos réserve cette modification à ses propres applications',
  'desk.prefs.roomSettings': 'Réglages de la pièce',
  'desk.prefs.settingsFor': 'Réglages de {room}',
  'desk.prefs.musicEq': 'Égaliseur musique',
  'desk.prefs.device': 'Appareil',
  'desk.prefs.bass': 'Graves',
  'desk.prefs.treble': 'Aigus',
  'desk.prefs.balance': 'Balance',
  'desk.prefs.left': 'G',
  'desk.prefs.right': 'D',
  'desk.prefs.loudness': 'Loudness',
  'desk.prefs.reset': 'Réinitialiser',
  'desk.prefs.eqFixed':
    'Les réglages d’égalisation ne sont pas disponibles tant que la sortie '
    + 'ligne d’une enceinte Sonos est réglée sur Fixe.',
  'desk.prefs.roomName': 'Nom de la pièce',
  'desk.prefs.apply': 'Appliquer',
  'desk.prefs.statusLight': 'Voyant d’état',
  'desk.prefs.on': 'Activé',
  'desk.prefs.off': 'Désactivé',
  'desk.prefs.servicesTitle': 'Mes comptes de services sur Sonos',
  'desk.prefs.servicesSignIn':
    'Aucun service configuré n’est listé. Sonora les lit directement sur '
    + 'les enceintes : cela signifie généralement qu’aucune n’a pu être '
    + 'jointe.',
  'desk.about.title': 'À propos de mon système Sonos',
  'desk.about.body': 'Enceintes présentes sur ce réseau, par système.',
  'desk.about.model': 'Modèle',
  'desk.about.version': 'Version',
  'desk.about.address': 'Adresse',
  'desk.about.speakers': 'Enceintes',
  'desk.about.system': 'Système',
  'desk.shortcuts.title': 'Raccourcis clavier',
  'desk.shortcuts.playPause': 'Lecture/Pause',
  'desk.shortcuts.volUp': 'Augmenter le volume',
  'desk.shortcuts.volDown': 'Diminuer le volume',
  'desk.shortcuts.mute':
    'Couper/rétablir le son de la pièce ou du groupe actuel',
  'desk.shortcuts.nextZone': 'Sélectionner le groupe de pièces suivant',
  'desk.shortcuts.prevZone': 'Sélectionner le groupe de pièces précédent',
  'notice.cannotPlay.title': 'La lecture a échoué',
  'notice.cannotPlay.detail': '{room} n’a pas pu lire {item}. {reason}',
  'notice.cannotPlay.stream':
    '{room} n’a pas pu lire {item} : aucune réponse de {host}. {reason}',
  'notice.cannotPlay.format': 'L’enceinte ne prend pas en charge ce format.',
  'notice.cannotPlay.connect': 'L’enceinte n’a pas pu l’atteindre.',
  'notice.cannotPlay.refused': 'Le service a refusé de le lire.',
  'notice.cannotPlay.missing': 'Ce contenu n’existe plus.',
  'notice.cannotPlay.permission': 'Ce compte n’est pas autorisé à le lire.',
  'notice.notPlaying.title': 'Rien ne s’est lancé',
  'notice.notPlaying.detail':
    '{room} a accepté la lecture puis s’est arrêtée. Sa source actuelle n’a '
    + 'pas pu être lue ; choisis autre chose dans le volet Musique.',
  'notice.notPlaying.stream':
    '{room} a accepté la lecture puis s’est arrêtée. Sa source est un flux '
    + 'de {host}, qui semble hors ligne.',
  'desk.menu.quit': 'Quitter Sonos',
  'desk.menu.delete': 'Supprimer',
  'desk.menu.selectAll': 'Tout sélectionner',
  'desk.menu.fullScreen': 'Passer en plein écran',
  'desk.menu.updatePlaylists':
    'Mettre à jour les listes de lecture iTunes maintenant',
  'desk.menu.updateAlbumArt': 'Mettre à jour les pochettes maintenant',
  'desk.menu.window': 'Fenêtre',
  'desk.menu.close': 'Fermer',
  'desk.menu.uninstall': 'Désinstaller…',
  'desk.menu.services': 'Services',
  'desk.menu.hideSonos': 'Masquer Sonos',
  'desk.menu.hideOthers': 'Masquer les autres',
  'desk.menu.showAll': 'Tout afficher',
  'desk.menu.autofill': 'Remplissage automatique',
  'desk.menu.dictation': 'Lancer la dictée…',
  'desk.menu.emoji': 'Emoji et symboles',
  'desk.menu.fill': 'Remplir',
  'desk.menu.center': 'Centrer',
  'desk.menu.moveResize': 'Déplacer et redimensionner',
  'desk.menu.fullScreenTile': 'Mosaïque en plein écran',
  'desk.menu.removeFromSet': 'Retirer la fenêtre de l’ensemble',
  'win.menu.file': 'Fichier',
  'win.menu.exit': 'Quitter',
  'win.menu.showMini': 'Afficher le mini-contrôleur',
  'win.shortcuts.toggleMini': 'Afficher/masquer le mini-contrôleur',
  'win.setup.title': 'Configuration de Sonora',
  'win.setup.lib.pathTitle': 'Ajouter de la musique depuis un partage réseau',
  'win.setup.lib.pathText': 'Saisis le chemin de ton partage réseau :',
  'win.setup.lib.examples': 'Exemples :',
  'win.setup.lib.browse': 'Parcourir',
  'win.setup.lib.credTitle': 'Nom d’utilisateur et mot de passe',
  'win.setup.lib.credText':
    'Saisis le nom d’utilisateur et le mot de passe, le cas échéant, du '
    + 'lecteur réseau contenant ta musique :',
  'win.setup.lib.username': 'Nom d’utilisateur :',
  'win.setup.lib.password': 'Mot de passe :',
  'win.setup.lib.adding': 'Ajout du dossier de musique',
  'win.setup.lib.doneTitle': 'Configuration de la bibliothèque musicale',
  'win.setup.lib.doneSetUp':
    '« {folder} » est maintenant configuré sur ton système Sonos.',
  'win.setup.lib.doneAdding':
    'Ta musique est en cours d’ajout à ton système Sonos. Cela peut prendre '
    + 'plusieurs minutes.',
  'win.setup.lib.doneNotice':
    'Tu pourras ajouter de la musique à Sonos plus tard via « Gérer la '
    + 'bibliothèque musicale » dans les Réglages.',
  'win.setup.lib.errorTitle': 'Erreur lors de l’ajout de la musique',
  'win.setup.lib.errorMessage':
    'Sonos n’a pas pu ajouter le dossier de musique',
  'win.setup.lib.errorDetails':
    'Vérifie que le chemin du dossier, ainsi que le nom d’utilisateur et le '
    + 'mot de passe si nécessaire, sont corrects.',
  'win.setup.lib.errorReason': 'Motif : {reason}',
  'win.services.addHint':
    'Clique sur « Ajouter » pour ajouter un nouveau service à ton système '
    + 'Sonos.',
  'win.services.labsHint':
    'Clique sur « Sonos Labs » pour essayer les services à venir sur ton '
    + 'système Sonos.',
  'win.services.serviceName': 'Nom du service',
  'win.services.name': 'Nom',
  'win.services.login': 'Identifiant du compte',
  'win.services.anonymous': '<Anonyme>',
  'win.services.add': 'Ajouter',
  'win.services.signInWith': 'Se connecter avec {service}',
  'win.services.labs': 'Sonos Labs',
  'win.services.addTitle': 'Ajouter un service',
  'win.services.labsTitle': 'Bienvenue dans Sonos Labs',
  'win.services.labsPrompt':
    'Sélectionne le service Sonos Labs que tu souhaites ajouter :',
  'win.services.labsSignedOut':
    'Connecte-toi à ton compte Sonos pour voir les services Sonos Labs.',
  'win.services.labsFailed':
    'La liste des services Sonos Labs n’a pas pu être récupérée : {error}',
  'win.services.edit': 'Modifier',
  'win.services.editTitle': 'Modifier le service',
  'win.services.editHeading': 'Modifier le compte {service}',
  'win.services.editPrompt': 'Saisis un nom de compte :',
  'win.services.editName': 'Nom :',
  'win.services.replace': 'Remplacer',
  'win.services.reauthorize': 'Réautoriser',
  'win.services.removeTitle': 'Supprimer le compte',
  'win.services.removeBody':
    'Veux-tu vraiment supprimer ce compte {service} de ton système Sonos ?',
  'win.eq.tab': 'Égaliseur',
  'win.eq.intro': 'Règle les aigus et les graves à ta convenance.',
  'win.errorLog.title': 'Journal des erreurs système de Sonora',
  'desk.errorLog.empty': 'Aucune erreur n’a été enregistrée ces sept derniers jours.',
  'win.library.title': 'Mes dossiers de musique sur Sonos',
  'win.library.addHint':
    'Clique sur « Ajouter » pour ajouter un nouveau dossier de musique à '
    + 'ton système Sonos.',
  'win.library.removeHint':
    'Clique sur « Supprimer » pour retirer le dossier sélectionné.',
  'win.library.name': 'Nom',
  'win.library.path': 'Chemin',
  // The Windows app's own two lines while the library updates.
  'win.library.indexing1': 'Mise à jour de la bibliothèque musicale…',
  'win.library.indexing2': 'Patiente.',
  'win.mini.noMusic': '[aucune musique]',
  'win.mini.volume': 'Volume',
  'win.mini.larger': 'Plus grand',
  'win.mini.smaller': 'Plus petit',
  'win.menu.checkUpdates': 'Rechercher les mises à jour logicielles…',
  'win.menu.changeLanguage': 'Changer de langue…',
  'win.menu.settings': 'Réglages…',
  'win.settings.title': 'Réglages',
  'win.sleep.title': 'Minuteur de veille ({state})',
  'win.sleep.choose':
    'Choisis une durée de minuteur de veille pour « {room} » :',
  'desk.window.controller': 'Contrôleur Sonora {systems}',
  'win.about.title': 'À propos',
  'win.about.version': 'Version :',
  'win.about.os': 'Sonos OS :',
  'win.about.license': 'Licence :',
  'win.about.system': 'Système Sonos {gen} :',
  'win.about.serial': 'Numéro de série',
  'win.about.ip': 'Adresse IP',
  'win.about.associated': 'Produit associé :',
  'win.about.hardware': 'Version du matériel',
  'win.about.series': 'ID de série',
  'win.about.wm': 'WM',
  'win.shortcuts.intro':
    'Sonora prend en charge les raccourcis clavier suivants :',
  'win.shortcuts.function': 'Fonction',
  'win.shortcuts.shortcut': 'Raccourci',
  'win.shortcuts.toggleShuffle': 'Activer/désactiver la lecture aléatoire',
  'win.shortcuts.toggleRepeat': 'Activer/désactiver la répétition',
  'win.shortcuts.muteAll': 'Couper le son partout',
  'win.shortcuts.topMenu': 'Revenir au menu Musique principal',
  'win.shortcuts.favorites': 'Aller aux favoris',
  'win.shortcuts.toggleCrossfade': 'Activer/désactiver le fondu enchaîné',
  'win.shortcuts.scrollCurrent':
    'Aller au titre en cours dans la file d’attente',
  'win.shortcuts.closeWindow': 'Fermer la fenêtre active',
  'win.shortcuts.browserNote':
    'Trois d’entre eux diffèrent de l’application Sonos : un navigateur '
    + 'garde Ctrl+T, Ctrl+L et Ctrl+W pour lui.',
  'win.shortcuts.jumpSearch': 'Aller au champ de recherche',
  'win.shortcuts.playNext': 'Lire le titre sélectionné ensuite',
  'win.shortcuts.replaceQueue': 'Remplacer la file d’attente par la sélection',
  'win.shortcuts.playLater': 'Lire la sélection plus tard',
  'win.shortcuts.resizeQueue': 'Redimensionner la file d’attente',
  'win.shortcuts.prevTrack': 'Titre précédent',
  'win.shortcuts.nextTrack': 'Titre suivant',
  'win.shortcuts.showShortcuts': 'Afficher la liste des raccourcis clavier',
  'win.settings.sonora': 'Sonora',
  'win.parental.title': 'Contrôle parental',
  'win.parental.enabled':
    'Le filtrage des contenus explicites est activé. Clique sur le bouton '
    + 'ci-dessous pour autoriser la lecture de contenus explicites sur ton '
    + 'système Sonos.\n\nTous les services ne prennent pas en charge le '
    + 'filtrage des contenus.',
  'win.parental.disabled':
    'Le filtrage des contenus explicites est désactivé. Clique sur le '
    + 'bouton ci-dessous pour empêcher la lecture de contenus explicites sur '
    + 'ton système Sonos.\n\nTous les services ne prennent pas en charge le '
    + 'filtrage des contenus.',
  'win.parental.noServices':
    'Aucun service de musique de ton système Sonos ne prend en charge le '
    + 'filtrage des contenus.',
  'win.parental.unreadable':
    'Ce système n’a pas indiqué si le filtrage des contenus explicites est '
    + 'activé.',
  'win.parental.turnOn': 'Activer le filtrage des contenus explicites',
  'win.parental.turnOff': 'Désactiver le filtrage des contenus explicites',
  'win.parental.moreInfo': 'Plus d’informations',
  'win.settings.eq': 'Réglages de l’égaliseur',
  'win.settings.library': 'Bibliothèque musicale',
  'win.settings.services': 'Services',
  'win.settings.eqFor': 'Réglages de l’égaliseur pour',
  'win.settings.mobileNote':
    'Ouvre l’application Sonos sur un appareil mobile pour gérer ton '
    + 'système.',
  'win.settings.getApp': 'Obtenir l’application mobile',
  'win.maximize': 'Agrandir',
  'win.restore': 'Restaurer',
  'desk.menu.minimize': 'Réduire',
  'desk.menu.zoom': 'Zoom',
  'desk.menu.bringAllToFront': 'Tout ramener au premier plan',
  'desk.menu.shop': 'Acheter des produits Sonos',
  'desk.menu.firewallHelp': 'Aide à la configuration du pare-feu',
  'desk.menu.errorLog': 'Journal des erreurs',
  'desk.menu.reset': 'Réinitialiser le contrôleur',
  'desk.menu.forget': 'Oublier le système Sonos actuel',
  'desk.window.title': 'Sonora',
  'desk.add.title': 'Ajouter des services de musique',
  'desk.add.button': 'Ajouter…',
  'desk.add.intro': 'Sélectionne un service à ajouter à ton système Sonos.',
  'win.addService.title': 'Ajouter un service',
  'win.addService.heading': 'Services disponibles',
  'win.addService.intro': 'Sélectionnez le service à ajouter à votre système Sonos.',
  'desk.add.auth.Anonymous': 'Aucun compte nécessaire',
  'desk.add.appOnly': 'Application Sonos uniquement',
  'desk.add.another': 'Un autre compte',
  'desk.add.unpairable':
    '{service} ne peut être ajouté qu’avec l’application Sonos officielle : '
    + 'son fournisseur refuse de connecter un contrôleur non Sonos.',
  'desk.add.auth.DeviceLink': 'Connexion sur le site du fournisseur',
  'desk.add.auth.AppLink': 'Connexion sur le site du fournisseur, si proposée',
  'desk.add.needsApp':
    '{service} n’autorise pas la connexion depuis Sonora ; son fournisseur '
    + 'n’accepte la connexion que via l’application Sonos officielle. '
    + 'Ajoute-le là-bas pour l’utiliser dans les applications Sonos. Ce qui '
    + 'en a été enregistré dans les Favoris Sonos ou les listes de lecture '
    + 'Sonos reste lisible dans Sonora.',
  'desk.add.instructions': 'Va sur {url}, connecte-toi et saisis ce code :',
  'desk.add.instructionsNoCode':
    'Va sur {url} et connecte-toi pour autoriser Sonos.',
  'desk.add.open': 'Ouvrir dans le navigateur',
  'desk.add.waiting': 'En attente de confirmation de {service}…',
  'desk.add.authorizeTitle': 'Ajouter un compte {service}',
  'desk.add.authorizeBody': 'Connectez-vous à {service} dans votre navigateur pour que Sonos puisse utiliser votre compte.',
  'desk.add.authorize': 'Autoriser',
  'desk.add.doneSystem.multi':
    '{service} a été ajouté à ton système {gen} et est prêt sur tes '
    + 'appareils {gen}, dans Sonora comme dans l’application Sonos '
    + 'officielle. Pour l’utiliser aussi sur tes appareils {other}, ajoute-le '
    + 'de nouveau depuis les {link}.',
  'desk.add.doneSystem.solo':
    '{service} a été ajouté à ton système Sonos et est prêt sur tes '
    + 'appareils, dans Sonora comme dans l’application Sonos officielle.',
  'desk.add.doneAnon.multi':
    '{service} est désormais disponible dans Sonora sur tes appareils '
    + '{gen}. Il n’a pas pu être ajouté à ton système Sonos et n’apparaîtra '
    + 'donc pas dans les applications Sonos. Pour l’utiliser sur tes '
    + 'appareils {other} dans Sonora, ajoute-le de nouveau depuis les {link}.',
  'desk.add.doneAnon.solo':
    '{service} est désormais disponible dans Sonora sur tes appareils. Il '
    + 'n’a pas pu être ajouté à ton système Sonos et n’apparaîtra donc pas '
    + 'dans les applications Sonos.',
  'desk.add.failed': 'Impossible d’ajouter {service} : {error}',
  // --- About dialog ------------------------------------------------------
  'about.title': 'À propos de Sonora',
  'about.menu': 'À propos de Sonora',
  'about.version': 'Version {version}',
  'about.tagline': 'Un contrôleur web auto-hébergé pour toutes les enceintes Sonos.',
  'about.pointLocal': 'Contrôle local avant tout',
  'about.pointThemes': 'Des thèmes très soignés',
  'about.pointNetwork': 'Diagnostic réseau',
  'about.pointUpgrade': 'Conseiller de mise à niveau matérielle',
  'about.pointMore': 'Et bien plus encore…',
  'about.license': 'Sonora est un logiciel libre, publié sous la licence {license}.',
  'about.github': 'Voir sur GitHub',
  'about.thirdParty': 'Licences tierces',
  'about.support': 'Soutenir Sonora',
  'about.supportNote': 'Si Sonora vous est utile, pensez à soutenir le projet.',
  'about.trademark': 'Sonora n’est ni affilié à Sonos ni approuvé par Sonos.\nSonos est une marque de Sonos, Inc.',
  'desk.showSystem': 'Afficher le système',
  'desk.services.tab': 'Services {system}',
  'desk.add.starting': 'Demande d’un lien de connexion à {service}…',
  'desk.add.linking': 'Association à {service}…',
  // --- removing a music service (every theme) --------------------------------
  'services.remove': 'Supprimer',
  'services.rename': 'Renommer',
  'services.renameTitle': 'Renommer le compte {service}',
  'services.renamed': 'Compte {service} renommé en {name}',
  'services.removeHint': 'Supprimer le service sélectionné',
  'services.removeTitle': 'Supprimer {service} ?',
  'services.removeChoose': 'Où souhaites-tu supprimer {service} ?',
  'services.removeSonora': 'Sonora',
  'services.removeSonoraSub': 'sa connexion et son affichage ici',
  'services.removeSonos': 'Sonos {gen}',
  'services.removeSonosSub': 'le compte sur ton système Sonos',
  'services.confirmRemove': 'Supprimer',
  'services.removing': 'Suppression de {service}…',
  'services.removeFailed': 'Impossible de supprimer {service} : {error}',
  'services.removeFromSonos': 'Supprimer de Sonos',
  'services.removeSonosBody':
    'Supprimer {service} de ton système Sonos ? Il sera retiré de toutes '
    + 'les applications Sonos, pas seulement de Sonora.',
  'services.removeSonoraBody': 'Retirer {service} de Sonora ? Sonora oublie sa connexion.',
  'desk.add.doneSonora.multi':
    '{service} est maintenant associé dans Sonora.\nTu devras également '
    + 'associer {service} une seconde fois — directement dans l’une des '
    + 'applications Sonos {gen} — pour que Sonora puisse piloter tes '
    + 'appareils {gen}.\nPour utiliser {service} sur tes appareils {other} '
    + 'dans Sonora, associe-le de nouveau depuis les {link}.',
  'services.relinkLinkText': 'services {other}',
  'services.caution.sonos': 'Associé à Sonos {gen}, pas encore à Sonora',
  'services.needsSonora.title': 'Association à Sonora requise',
  'services.needsSonos.title': 'Association à Sonos {gen} requise',
  'services.caution.sonora': 'Associé à Sonora, pas encore à Sonos {gen}',
  'services.sonoraOnly.body':
    '{service} est associé à Sonora mais pas à ton système Sonos '
    + '{gen}.\nSonora peut le parcourir, mais tes appareils {gen} ne pourront '
    + 'pas le lire tant que tu n’auras pas associé {service} dans l’une des '
    + 'applications Sonos {gen}.',
  'desk.add.doneSonora.solo':
    '{service} est maintenant associé dans Sonora.\nTu devras également '
    + 'associer {service} une seconde fois — directement dans l’une des '
    + 'applications Sonos {gen} — pour que Sonora puisse piloter tes '
    + 'appareils {gen}.',

  // --- Sonofuture ---

  // --- S2 Upgrade Info ---
  's2.title': 'Conseiller de mise à niveau Sonos',
  's2.lede':
    'Comprends quel matériel serait nécessaire pour passer entièrement à S2 '
    + 'ou S2.1, et à quel coût approximatif.',
  's2.con4':
    'L’application S1 n’a pas changé depuis des années et reste stable. '
    + 'L’application S2 a été réécrite en 2024 et cette version a été '
    + 'mouvementée.',
  's2.colRoom': 'Pièce',
  's2.colProduct': 'Produit',
  's2.colReplacement': 'Équivalent S2',
  's2.colReplacementS21': 'Équivalent S2.1',
  's2.colPrice': 'Prix public US',
  's2.ready': 'Oui',
  's2.notReady': 'Non, S1 uniquement',
  's2.unknown': 'Inconnu',
  's2.replaceTitle': 'Ce que coûterait le passage à S2 dans toutes les pièces',
  's2.replaceBlurb': 'Chaque appareil du foyer et ce qu\'il lui faut pour passer à S2 : une mise à jour logicielle, un remplacement à son prix catalogue, ou rien.',
  's2.noReplacement': 'Rien à acheter',
  's2.noReplacementWhy':
    'une enceinte filaire porte le réseau, et l’application a remplacé le '
    + 'contrôleur',
  's2.total': 'Total pour faire passer ce système à S2',
  's2.amazonDisclosure': 'En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises.',
  's2.pricesNote': 'Prix catalogue aux États-Unis, vérifiés au T{quarter} {year}. Les prix peuvent changer : vérifie avant d’acheter.',
  's2.timelineTitle': 'Trois générations de matériel',
  's2.era.s1': 'S1 uniquement',
  's2.era.s20': 'S2.0',
  's2.era.s21': 'S2.1',
  's2.eraSpan': 'de {from} à {to}',
  's2.eraOpen': 'de {from} à aujourd’hui',
  's2.eraBounds.s1':
    'Du ZonePlayer 100 (janvier 2005) au Play:5 gén. 1 (novembre 2015). '
    + 'Rien de ces années-là ne peut exécuter S2.',
  's2.eraBounds.s20':
    'Du Play:3 (juillet 2011) à la lampe de table Symfonisk gén. 1 (janvier '
    + '2022). Exécute S2, privé des nouvelles fonctions depuis 2025.',
  's2.eraBounds.s21':
    'Du Sonos One (octobre 2017) à aujourd’hui. Tout ce que Sonos vend '
    + 'actuellement.',
  's2.mark.s2app': 'Application S2, juin 2020',
  's2.mark.freeze': 'S2.0 figé, 2025',
  's2.linksIntro': 'Dans les mots de Sonos :',
  's2.linkS2Launch': 'Présentation de S2, juin 2020',
  's2.linkS21Launch': 'La mise à jour des produits hérités de 2025',
  's2.allReady':
    'Tous les appareils S1 présents ici peuvent exécuter S2. Ce système '
    + 'peut migrer sans rien acheter.',
  's2.allS21':
    'Tous tes appareils sont sur la plateforme Sonos S2.1. Tu n’as rien à '
    + 'mettre à niveau. Tu es soit très nouveau chez Sonos, soit très riche. '
    + 'Dans les deux cas, félicitations !',

  // --- the network map ---
  'net.mapTitle': 'Tous les appareils du réseau',
  'net.mapBlurb': 'Une carte par enceinte. Chacune indique si sa connexion est saine et pourquoi, selon la rapidité et la fiabilité de ses réponses. Ouvrez Détails pour le reste.',
  'net.mapEmpty': 'Aucun appareil n’a répondu.',
  'net.wired': 'Filaire',
  'net.onSonosnet': 'SonosNet',
  'net.onWifi': 'Wi-Fi',
  'net.channel': 'Canal {n}',
  'net.unreachable': 'N’a pas répondu',
  'net.notMeasurable': 'Aucun voisin à mesurer',
  'net.drop.title': 'Coupures de lecture',
  'net.drop.blurb': 'Les moments des sept derniers jours où la musique d\'une pièce s\'est coupée.',
  'net.drop.none': 'Aucune coupure ces sept derniers jours.',
  'net.drop.buffering': 'En pause {seconds} s pour la mise en mémoire tampon',
  'net.drop.skipped': 'A sauté un élément illisible',
  'net.drop.failed': 'Arrêté : lecture impossible',
  'net.drop.more': 'Et {count} plus anciennes.',
  'net.fix.no_answer': 'Vérifiez qu\'elle est allumée et toujours sur votre réseau.',
  'net.fix.lost': 'Souvent une couverture faible à cet endroit ou un canal chargé. Essayez-la plus près du routeur.',
  'net.fix.slow': 'Souvent un signal faible du routeur. Rapprocher l\'enceinte ou le routeur aide généralement.',
  'net.fix.slow_often': 'Souvent d\'autres échanges Wi-Fi ou des interférences sur son canal : micro-ondes, babyphones et réseaux des voisins sont des causes courantes.',
  'net.fix.uneven': 'Souvent d\'autres échanges Wi-Fi ou des interférences sur son canal : micro-ondes, babyphones et réseaux des voisins sont des causes courantes.',
  'net.fix.stall': 'Une seule longue pause vient généralement d\'une rafale d\'autres échanges Wi-Fi. Si cela se répète dans cette pièce, cherchez une source d\'interférence à proximité.',
  'net.fix.dropping': 'Sa propre liaison Wi-Fi perd des paquets. Un signal faible ou des interférences à proximité en sont les causes habituelles.',
  'net.fix.extender': 'Les répéteurs ajoutent du délai. Connectez-la au routeur principal si elle le capte.',
  'net.summary.clear': 'Rien à signaler. Toutes les enceintes répondent rapidement.',
  'net.summary.issues': '{parts}. La carte de chaque enceinte ci-dessous indique pourquoi.',
  'net.summary.and': ' et ',
  'net.probing': 'Sondage des enceintes. Patientez...',
  'net.health.good': 'Bon',
  'net.health.watch': 'À surveiller',
  'net.health.problem': 'Problème',
  'net.health.unmeasured': 'Non mesuré',
  'net.why.ok': 'Répond en {median} ms',
  'net.why.no_answer': 'Aucune réponse sur {attempts} essais',
  'net.why.lost': '{failed} réponses manquées sur {attempts}',
  'net.why.slow': 'Répond généralement en {median} ms',
  'net.why.slow_often': '1 réponse sur 20 prend plus de {p95} ms',
  'net.why.uneven': '1 réponse sur 20 prend plus de {p95} ms',
  'net.why.stall': 'Une réponse a pris {worst} ms',
  'net.why.dropping': 'Perd {rate} paquets par minute',
  'net.why.extender': 'Connecté via un répéteur Wi-Fi',
  'net.details': 'Détails',
  'net.replies': 'Réponses',
  'net.repliesLine': 'en général {median} ms · 1 sur 20 au-delà de {p95} ms · la plus lente {worst} ms · {failed} manquées sur {attempts}',
  'net.dropped': 'Paquets perdus',
  'net.perMinute': '{n} par minute',
  'net.notReported': 'Non indiqué',
  'net.hears': 'Entend d\'autres enceintes Sonos',
  'net.hearsHint': 'À quel point cette enceinte entend les autres enceintes de son système. Cela décrit son emplacement, pas sa connexion Wi-Fi : aucune enceinte Sonos n\'indique comment elle capte votre routeur.',
  'net.noiseLabel': 'Bruit radio',
  'net.count.problem.one': '{count} problème',
  'net.count.problem.other': '{count} problèmes',
  'net.count.watch.one': '{count} à surveiller',
  'net.count.watch.other': '{count} à surveiller',
  'net.margin': 'marge de {n} dB',
  'net.alone': 'Aucune enceinte à portée',
  's2.tier.s21': 'S2.1',
  's2.tier.s20': 'S2.0',
  's2.tier.unknown': 'Inconnu',
  's2.s21Title': 'Ce que coûterait le passage à S2.1 dans toutes les pièces',
  's2.s21Blurb': 'Chaque appareil du foyer et ce qu\'il lui faut pour atteindre S2.1. Un appareil qui ne peut pas du tout exécuter S2, ou qui n\'atteindrait que S2.0, est remplacé par le produit actuel qui prend sa place. Ce total inclut le coût du passage à S2.',
  's2.colWhy': 'Motif',
  's2.why.legacy': 'Ne peut pas exécuter S2',
  's2.why.lower': 'S2.0 uniquement',
  's2.why.upgradable': 'Mise à niveau possible',
  's2.why.runningS2': 'Sous S2',
  's2.why.runningS21': 'Sous S2.1',
  's2.totalS21': 'Total pour atteindre S2.1 dans toutes les pièces',
  's2.s21AllReady':
    'Toutes les pièces seraient déjà en S2.1. Il n’y a rien à acheter.',
  's2.tierUnknownNote.one':
    'Un appareil n’a pas pu être classé : Sonos ne répertorie que certaines '
    + 'générations de ce produit, et l’enceinte n’indique pas laquelle elle '
    + 'est.',
  's2.tierUnknownNote.other':
    '{count} appareils n’ont pas pu être classés : Sonos ne répertorie que '
    + 'certaines générations de ces produits, et les enceintes n’indiquent '
    + 'pas lesquelles elles sont.',
  's2.choiceTitle': 'Que souhaites-tu faire ?',
  's2.choiceKeepBoth': 'Conserver deux systèmes séparés S1 et S2',
  's2.choiceKeepBothNote':
    'Conserver deux systèmes Sonos distincts : S1 et S2, comme aujourd’hui. '
    + '(Certains appareils S1 peuvent être mis à niveau logiciellement vers '
    + 'S2.)',
  's2.choiceStayS1': 'Continuer avec votre système S1',
  's2.choiceStayS1Note': 'Continuez à utiliser votre système S1 comme maintenant. Aucune action n\'est nécessaire.',
  's2.choiceStayS2': 'Continuer avec votre système S2',
  's2.choiceStayS2Note': 'Continuez à utiliser votre système S2 comme maintenant. Aucune action n\'est nécessaire.',
  's2.choiceS2': 'Passer à S2',
  's2.choiceS2Note':
    'Mettre à niveau logiciellement toutes les enceintes S1 éligibles vers '
    + 'S2 et acheter de nouveaux appareils pour remplacer celles qui ne '
    + 'peuvent pas franchir le pas.',
  's2.choiceS21': 'Passer à S2.1',
  's2.choiceS21Note':
    'Acheter de nouveaux appareils pour remplacer tous les appareils Sonos '
    + 'qui ne sont pas compatibles S2.1. L’option sans compromis, à l’épreuve '
    + 'du temps.',
  's2.choiceFree': 'Rien à acheter',
  's2.colBuy': 'Action',
  's2.buyNow': 'Acheter',
  's2.updateNow': 'Mettre à jour',
}
