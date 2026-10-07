// Italian (it-IT). The keys mirror en-US.js, the reference catalog; a key
// missing here is looked for along this locale's fallback chain in locales.js,
// then in en-US.js.
//
// Placeholders are written {name} and substituted at render time. Counts that
// change the wording carry .one and .other keys (see en-US.js).

export default {

  // --- shared ------------------------------------------------------------
  'common.theme': 'Tema',
  'common.language': 'Lingua',
  'common.back': 'Indietro',
  'common.cancel': 'Annulla',
  'common.save': 'Salva',
  'common.submit': 'Invia',
  'common.apply': 'Applica',
  'common.appearance': 'Aspetto',
  'common.appearanceLight': 'Chiaro',
  'common.appearanceDark': 'Scuro',
  'common.appearanceSystem': 'Sistema',
  'common.done': 'Fatto',
  'common.close': 'Chiudi',
  'common.explicit': 'Esplicito',
  'common.restricted': 'Con restrizioni',
  'common.dismiss': 'Ignora',
  'common.settings': 'Impostazioni',
  'common.search': 'Cerca',
  'common.queue': 'Coda',
  'common.play': 'Riproduci',
  'common.pause': 'Pausa',
  'common.stop': 'Interrompi',
  'common.next': 'Successivo',
  'common.previous': 'Precedente',
  'common.shuffle': 'Riproduzione casuale',
  'common.repeat': 'Ripeti',
  'common.mute': 'Disattiva audio',
  'common.unmute': 'Riattiva audio',
  'common.viewAll': 'Mostra tutto',
  'common.reconnecting': 'riconnessione',
  'desk.lc.noNetwork': 'Per usare Sonora devi essere connesso a una rete cablata o wireless. Controlla le impostazioni di rete.',
  'desk.lc.noSonora': 'Questa pagina ha perso la connessione con Sonora. Si ricollegherà da sola appena Sonora risponde.',
  'local.room': 'Questo browser',
  'local.cannotGroup.title': 'Questo browser non può essere raggruppato',
  'local.cannotGroup.detail':
    'Il raggruppamento tiene gli speaker su un orologio condiviso, sulla '
    + 'loro rete. Un browser non ne fa parte, quindi riproduce per conto '
    + 'proprio.',
  'local.cannotPlay.title': 'Questo browser non può riprodurlo',
  'local.cannotPlay.needsSpeaker':
    'Solo uno speaker può recuperarlo: un servizio musicale consegna il '
    + 'flusso al sistema, e una condivisione della libreria musicale viene '
    + 'montata dai lettori. La radio Internet, invece, si ascolta qui.',
  'local.cannotPlay.unknown':
    'Sonora non sa come riprodurre questa sorgente in un browser. La radio '
    + 'Internet, invece, si ascolta qui.',
  'local.cannotPlay.needsQueue':
    'Un album, una playlist o una coda è un elenco di brani, e l’elenco '
    + 'appartiene allo speaker che lo riproduce. Scegli qui un singolo brano '
    + 'o una stazione.',
  'local.cannotPlay.needsLink':
    'Sonora esplora {service} attraverso gli speaker e non ha un accesso '
    + 'proprio per chiedergli un flusso. Collega il servizio a Sonora e '
    + 'potrai ascoltarlo qui.',
  'local.cannotPlay.serviceRefused':
    '{service} non consente a Sonora di trasmetterlo al di fuori '
    + 'dell’ecosistema Sonos. Prova a trasmetterlo direttamente a un lettore '
    + 'Sonos.',
  'local.cannotPlay.protected':
    '{service} non consente a Sonora di trasmetterlo al di fuori '
    + 'dell’ecosistema Sonos. Prova a trasmetterlo direttamente a un lettore '
    + 'Sonos.',
  'local.cannotDo.title': 'Solo uno speaker può farlo',
  'local.cannotDo.detail':
    'Questo browser è un’uscita, non un lettore: niente equalizzatore, '
    + 'niente spia di stato, niente coda e nessuna coppia stereo. Volume, '
    + 'riproduzione e pausa funzionano.',
  'common.rooms.one': '{count} stanza',
  'common.rooms.other': '{count} stanze',
  'common.speakers.one': '{count} speaker',
  'common.speakers.other': '{count} speaker',
  'common.groups.one': '{count} gruppo',
  'common.groups.other': '{count} gruppi',
  'common.items.one': '{count} elemento',
  'common.items.other': '{count} elementi',
  'common.tracks.one': '{count} brano',
  'common.tracks.other': '{count} brani',
  'common.noResults': 'Nessun risultato',
  'common.offline': 'non in linea',
  'common.system': 'Sistema {generation}',

  // --- start-up and failure states ---------------------------------------
  'splash.loading.title': 'Ricerca degli speaker',
  'splash.loading.detail':
    'Invio di una richiesta di rilevamento e interrogazione del primo '
    + 'speaker che risponde per conoscere il resto del sistema.',
  'splash.empty.title': 'Nessuno speaker trovato',
  'splash.empty.detail':
    'Il rilevamento usa il multicast: la macchina su cui gira questo '
    + 'controller deve stare sulla stessa rete degli speaker, non su una rete '
    + 'ospiti o su un’altra VLAN.',
  'splash.error.title': 'Controller irraggiungibile',
  'splash.error.detail':
    'Il backend non ha risposto. Verifica che sia in esecuzione.',
  'splash.searchAgain': 'Cerca di nuovo',
  'splash.crash.title': 'Questo tema ha smesso di funzionare',
  'splash.crash.detail': 'Si è verificato un problema durante la visualizzazione. Ricarica la pagina o scegli un altro design qui sotto.',
  'splash.reload': 'Ricarica',
  'rating.cannotUndo': '{service} non permette di annullarlo',
  'splash.connected': 'Connesso al controller',
  'splash.notConnected': 'Non connesso',

  // --- notices ------------------------------------------------------------
  'notice.conflict.title': 'Lo speaker ha rifiutato',
  'notice.skipLimit.title': 'Limite di salti raggiunto',
  'notice.skipLimit.body': 'Hai raggiunto il limite di salti per questa stazione. Riprova più tardi.',
  'notice.silent.title': 'Lo speaker non ha risposto',
  'notice.silent.body':
    '{room} ha smesso di rispondere per un momento. Di solito torna da '
    + 'solo; riprova tra qualche secondo.',
  'notice.error.title': 'Qualcosa è andato storto',
  'notice.network.title': 'Errore di rete',

  // --- what a room is doing ----------------------------------------------
  'search.category.artists': 'Artisti',
  'search.category.albums': 'Album',
  'search.category.tracks': 'Brani',
  'search.category.playlists': 'Playlist',
  'search.category.stations': 'Stazioni',
  'search.category.genres': 'Generi',
  'search.category.podcasts': 'Podcast e programmi',
  'search.category.shows': 'Podcast e programmi',
  'search.category.audiobooks': 'Audiolibri',
  'search.category.people': 'Persone',
  'search.category.episodes': 'Episodi',
  'search.category.hosts': 'Conduttori',
  'source.queue': 'Coda',
  'source.grouped': 'Raggruppato',
  'source.line_in': 'Ingresso linea',
  'source.radio': 'Radio',
  'source.service_stream': 'Radio',
  'source.service_radio': 'Radio',
  'source.service_hls': 'Radio',
  'source.service_track': 'Servizio di streaming',
  'source.service_container': 'Servizio di streaming',
  'source.library_track': 'Libreria musicale',
  'source.http_stream': 'Flusso di rete',
  'source.external_session': 'AirPlay o Spotify Connect',
  'source.tv': 'TV',
  'source.playlist': 'Playlist',
  'source.idle': 'Inattivo',
  'source.unknown': 'Sorgente sconosciuta',

  // --- web theme ----------------------------------------------------------
  'common.noMusicSelected': 'Nessuna musica selezionata',
  'common.queueIsEmpty': 'La coda è vuota',
  'common.roomsGrouped': '{count} stanze raggruppate',
  'common.groupLabel': '{room} + {count}',
  'common.nothingQueued': 'Niente in coda',
  'common.setActive': 'Rendi attiva {room}',
  'common.openQueue': 'Apri la coda',
  'common.seek': 'Scorri il brano',
  'common.live': 'In diretta',
  'common.tv': 'TV',
  'desk.browse.lineIn': 'Ingresso linea',
  'desk.browse.noSelections': 'Nessuna selezione disponibile.',
  'desk.browse.lineInNone':
    'Per usare l’ingresso linea, collega un dispositivo a un prodotto Sonos '
    + 'dotato di ingresso linea.',
  'common.kind.playlist': 'Playlist',
  'common.kind.album': 'Album',

  // grouping

  // queue

  // settings
  'net.connection': 'Connessione',
  'net.live': 'in diretta',
  'net.rescan': 'Analizza di nuovo la rete',

  // a service's own page
  'services.needsAccount':
    '{service} non mostra nulla senza il token di accesso del tuo account. '
    + 'Quel token è custodito dagli speaker e non viene mai esposto in rete, '
    + 'quindi il suo catalogo non può essere esplorato qui; ciò che ne hai '
    + 'salvato nei Preferiti Sonos o nelle playlist Sonos continua a suonare.',

  // --- Sonos account, network check and TV audio, used across themes -------
  'account.title': 'Account Sonos',
  'account.blurb': 'I diffusori che hai già configurato danno a Sonora tutto ciò che serve per controllare ogni giorno il tuo sistema Sonos.',
  'account.optional': 'L\'accesso al tuo account Sonos è facoltativo. Mostra l\'elenco completo dei servizi musicali configurati nel tuo sistema con i relativi loghi, i servizi Sonos Labs disponibili e il nome dell\'ingresso TV che una soundbar sta riproducendo.',
  'account.signIn': 'Accedi',
  'account.signOut': 'Esci',
  'account.signingIn': 'Accesso in corso…',
  'account.email': 'E-mail',
  'account.password': 'Password',
  'account.signedInAs': 'Connesso come: {email}',
  'account.notSignedIn': 'non connesso',
  'net.scanning': 'Analisi della rete…',
  'net.scanDone': 'Trovate {rooms} in {systems}',
  'common.systems.one': '{count} sistema',
  'common.systems.other': '{count} sistemi',
  'source.noSignal': 'Nessun segnale',
  'desk.now.tvInput': 'Ingresso',
  'desk.now.tvFormat': 'Formato',
  'tvFormat.0': 'Nessun ingresso collegato',
  'tvFormat.2': 'Stereo',
  'tvFormat.7': 'Dolby 2.0',
  'tvFormat.18': 'Dolby 5.1',
  'tvFormat.21': 'Nessun ingresso',
  'tvFormat.22': 'Nessun audio',
  'tvFormat.59': 'Dolby Atmos (DD+)',
  'tvFormat.61': 'Dolby Atmos (TrueHD)',
  'tvFormat.63': 'Dolby Atmos (MAT 2.0)',
  'tvFormat.33554434': 'PCM 2.0',
  'tvFormat.33554454': 'PCM 2.0 senza audio',
  'tvFormat.33554488': 'Dolby 2.0',
  'tvFormat.33554490': 'Dolby Digital Plus 2.0',
  'tvFormat.33554492': 'Dolby TrueHD 2.0',
  'tvFormat.33554494': 'Dolby PCM multicanale 2.0',
  'tvFormat.84934658': 'PCM multicanale 5.1',
  'tvFormat.84934713': 'Dolby 5.1',
  'tvFormat.84934714': 'Dolby Digital Plus 5.1',
  'tvFormat.84934716': 'Dolby TrueHD 5.1',
  'tvFormat.84934718': 'Dolby PCM multicanale 5.1',
  'tvFormat.84934721': 'DTS 5.1',
  'tvFormat.118489090': 'PCM multicanale 7.1',
  'tvFormat.118489146': 'Dolby Digital Plus 7.1',
  'tvFormat.118489148': 'Dolby TrueHD 7.1',

  // --- Sonos macOS Desktop theme ------------------------------------------------
  'desk.menu.edit': 'Modifica',
  'desk.menu.view': 'Visualizza',
  'desk.menu.manage': 'Gestisci',
  'desk.menu.help': 'Aiuto',
  'desk.menu.preferences': 'Preferenze…',
  'desk.menu.checkUpdates': 'Cerca aggiornamenti…',
  'desk.menu.cut': 'Taglia',
  'desk.menu.copy': 'Copia',
  'desk.menu.paste': 'Incolla',
  'desk.menu.mainWindow': 'Controller Sonos',
  'desk.menu.miniController': 'Mini controller',
  'desk.menu.musicLibrarySettings': 'Impostazioni della libreria musicale…',
  'desk.menu.serviceSettings': 'Impostazioni dei servizi…',
  'desk.menu.addRadioStation': 'Aggiungi stazione radio…',
  'desk.radio.myShows': 'I miei programmi radio',
  'desk.radio.changeLocation': 'Cambia località',
  'desk.radio.enterZip': 'Inserisci il CAP',
  'desk.radio.zipBody': 'Inserisci il tuo CAP:',
  'desk.radio.pickCity': 'Scegli una città',
  'desk.radio.locationSet': 'La radio locale ora è {city}.',
  'desk.radio.localRadio': 'Radio locale',
  'desk.radio.localRadioIn': 'Radio locale ({city})',
  'desk.radio.myStations': 'Le mie stazioni radio',
  'desk.radio.addNew': 'Aggiungi una nuova stazione radio',
  'desk.playlists.new': 'Nuova playlist',
  'desk.playlists.addTitle': 'Aggiungi il brano a una playlist',
  'desk.playlists.removeSong': 'Rimuovi il brano',
  'desk.playlists.removedSong': '{title} è stato rimosso dalla playlist.',
  'desk.playlists.added': '{title} è stato aggiunto a {playlist}.',
  'desk.playlists.addedMany':
    '{count} brani sono stati aggiunti a {playlist}.',
  'desk.playlists.nameTitle': 'Dai un nome a questa playlist',
  'desk.playlists.nameBody': 'Dai un nome a questa playlist:',
  'desk.playlists.rename': 'Rinomina la playlist',
  'desk.playlists.renameBody': 'Inserisci un nuovo nome per questa playlist:',
  'desk.playlists.delete': 'Elimina la playlist',
  'desk.playlists.deleted': '«{title}» è stata eliminata.',
  'desk.queue.editedTitle': 'La coda è stata modificata',
  'desk.queue.editedBody': 'Riprodurlo sostituirà la coda.',
  'desk.queue.playAnyway': 'Riproduci comunque',
  'desk.radio.title': 'Aggiungi una stazione radio',
  'desk.radio.intro': 'Inserisci i dati della nuova stazione radio.',
  'desk.radio.where':
    'La nuova stazione sarà aggiunta in TuneIn > Le mie stazioni radio.',
  'desk.radio.url': 'URL dello streaming',
  'desk.radio.name': 'Nome della stazione',
  'desk.radio.added': '«{title}» è stata aggiunta a Le mie stazioni radio.',
  'desk.radio.exists': '«{title}» è già in Le mie stazioni radio.',
  'desk.menu.updateLibrary': 'Aggiorna ora la libreria musicale',
  'desk.menu.systemHelp': 'Guida del sistema Sonos',
  'desk.menu.supportSite': 'Sito di assistenza tecnica',
  'desk.menu.submitDiagnostics': 'Invia diagnostica',
  'desk.menu.about': 'Informazioni sul mio sistema Sonos',
  'desk.menu.disabledNote':
    'Le voci in grigio sono disponibili solo nell’app Sonos.',
  'desk.transport.groupVolume': 'Volume del gruppo',
  'desk.transport.back30': 'Indietro di 30 secondi',
  'desk.transport.forward30': 'Avanti di 30 secondi',
  'desk.transport.repeatOff': 'Ripetizione disattivata',
  'desk.transport.repeatOne': 'Ripeti il brano',
  'desk.transport.repeatAll': 'Ripeti tutto',
  'desk.transport.crossfade': 'Dissolvenza incrociata',
  'desk.rooms.title': 'Stanze',
  'desk.rooms.system': 'Sistema',
  'desk.rooms.pauseAll': 'Metti tutto in pausa',
  'desk.rooms.pause': 'Pausa',
  'desk.rooms.confirmPauseAll':
    'Vuoi davvero mettere in pausa la musica in tutte le stanze?',
  'desk.rooms.playGroup': 'Riproduci il gruppo',
  'desk.rooms.pauseGroup': 'Metti il gruppo in pausa',
  'desk.rooms.stopGroup': 'Interrompi il gruppo',
  'desk.rooms.offline': 'Non in linea',
  'desk.rooms.batteryLevel': '{level}%',
  'desk.rooms.battery': 'Batteria {level}%',
  'desk.rooms.batteryCharging': 'Batteria {level}%, in carica',
  'desk.now.title': 'In riproduzione',
  'desk.now.next': 'Successivo',
  'desk.now.noMusic': '[Nessuna musica selezionata]',
  'desk.now.episode': 'Episodio',
  'desk.now.podcast': 'Podcast',
  'desk.now.releaseDate': 'Data di uscita',
  'desk.now.chapter': 'Capitolo',
  'desk.now.author': 'Autore',
  'desk.now.narrator': 'Narratore',
  'desk.now.book': 'Libro',
  'desk.now.station': 'Stazione',
  'desk.now.onNow': 'Ora in onda',
  'desk.now.information': 'Informazioni',
  'desk.now.zp.connecting': 'Connessione...',
  'desk.now.zp.buffering': 'Avvio...',
  'desk.now.zp.starting': 'Avvio...',
  'desk.now.artist': 'Artista',
  'desk.now.album': 'Album',
  'desk.now.song': 'Brano [{n}/{total}]',
  'desk.now.songLabel': 'Brano',
  'desk.now.infoOptions': 'Info e opzioni',
  'desk.now.thumbsUp': 'Mi piace',
  'desk.now.thumbsDown': 'Non mi piace',
  'desk.info.source': 'Sorgente',
  'desk.info.room': 'Stanza',
  'desk.info.duration': 'Durata',
  'desk.info.station': 'Stazione',
  'desk.info.addMyStations': 'Aggiungi a Le mie stazioni radio',
  'desk.info.removeMyStations': 'Rimuovi da Le mie stazioni radio',
  'desk.radio.removedMine': '{title} è stato rimosso da Le mie stazioni radio',
  'desk.info.addMyShows': 'Aggiungi a I miei programmi radio',
  'desk.radio.addedMine': '{title} è stata aggiunta a Le mie stazioni radio',
  'desk.radio.addedShow': '{title} è stato aggiunto a I miei programmi radio',
  'desk.radio.alreadyShow': '{title} è già in I miei programmi radio',
  'desk.radio.alreadyMine': '{title} è già in Le mie stazioni radio',
  'desk.info.startRadio': 'Avvia la radio',
  'desk.info.addToServicePlaylist':
    'Aggiungi il brano a una playlist {service}',
  'desk.info.saveToMusic': 'Salva nella tua musica',
  'desk.info.addSongFavorite': 'Aggiungi il brano ai Preferiti Sonos',
  'desk.info.removeFavorite': 'Rimuovi dai Preferiti Sonos',
  'desk.info.removedFavorite': '{title} è stato rimosso dai Preferiti Sonos',
  'desk.info.albumInfo': 'Info sull’album',
  'desk.info.artistInfo': 'Info sull’artista',
  'desk.info.podcastInfo': 'Info sul podcast',
  'desk.info.provider': 'Fornitore',
  'desk.info.addEpisodeFavorite': 'Aggiungi l’episodio ai Preferiti Sonos',
  'desk.info.addEpisodePlaylist': 'Aggiungi l’episodio a una playlist Sonos',
  'desk.info.actionDone': 'Fatto.',
  'desk.info.actionFailed': 'Il servizio ha rifiutato la richiesta.',
  'desk.info.viewAllSongs': 'Mostra tutti i brani dell’album',
  'desk.info.addAlbumFavorite': 'Aggiungi l’album ai Preferiti Sonos',
  'desk.info.addBookFavorite': 'Aggiungi il libro ai Preferiti Sonos',
  'desk.info.addAlbumPlaylist': 'Aggiungi l’album a una playlist Sonos',
  'desk.info.addToSonosPlaylist': 'Aggiungi il brano a una playlist Sonos',
  'desk.info.addStationFavorite': 'Aggiungi la stazione ai Preferiti Sonos',
  'desk.info.addedFavorite': '«{title}» è stato aggiunto ai Preferiti Sonos.',
  'desk.info.alreadyFavorite': '«{title}» è già nei Preferiti Sonos.',
  'desk.queue.title': 'Coda',
  'desk.queue.notInUse': '(Non in uso)',
  'desk.queue.collapse': 'Mostra la riproduzione in corso',
  'desk.queue.expand': 'Espandi la coda',
  'desk.queue.songs.one': '{count} brano',
  'desk.queue.songs.other': '{count} brani',
  'desk.queue.empty': 'La coda è vuota',
  'win.queue.empty': 'La coda è vuota.',
  'win.queue.confirmTitle': 'Conferma',
  'win.queue.confirmClear': 'Vuoi davvero svuotare la coda?',
  'win.queue.clearAction': 'Svuota',
  'desk.queue.clear': 'Svuota la coda',
  'desk.queue.save': 'Salva la coda',
  'desk.queue.confirmClear': 'Svuota la coda',
  'desk.queue.playSong': 'Riproduci il brano',
  'desk.queue.removeSong': 'Rimuovi il brano',
  'desk.queue.playEpisode': 'Riproduci l’episodio',
  'desk.queue.removeEpisode': 'Rimuovi l’episodio',
  'desk.queue.playTrack': 'Riproduci il brano {n}',
  'desk.browse.root': 'Seleziona una sorgente musicale',
  'desk.browse.music': 'Musica',
  'desk.browse.favorites': 'Preferiti Sonos',
  'desk.browse.updateNow': 'Aggiorna ora',
  'desk.update.title': 'Aggiornamento disponibile',
  'desk.update.body': 'È pronto un aggiornamento per i tuoi diffusori Sonos: versione {version}. La musica si interrompe in ogni stanza durante l\'installazione, che può richiedere alcuni minuti.',
  'desk.update.start': 'Aggiorna',
  'desk.update.notNow': 'Non ora',
  'desk.update.started': 'L\'aggiornamento è iniziato. Ogni stanza si riavvia al termine.',
  'desk.browse.library': 'Libreria musicale',
  'desk.browse.playlists': 'Playlist Sonos',
  'desk.browse.radio': 'TuneIn',
  'desk.browse.addServices': 'Aggiungi servizi musicali',
  'desk.browse.addServicesFor': 'Aggiungi servizi musicali {gen}',
  'desk.browse.switchAccount': 'Cambia account',
  'desk.browse.sleepTimer': 'Timer di spegnimento',
  'desk.browse.alarms': 'Sveglie',
  'desk.browse.results': 'Risultati: {query}',
  'desk.search.in': 'Cerca in {service}',
  'desk.search.clear': 'Cancella ricerca',
  'desk.search.recent': 'Ricerche recenti',
  'desk.search.clearRecent': 'Cancella le ricerche recenti',
  'desk.search.scope': 'Scegli dove cercare',
  'desk.browse.noResults':
    'La ricerca di «{query}» non ha dato risultati. Prova un’altra '
    + 'categoria o un nuovo termine.',
  'desk.browse.selectRoom':
    'Seleziona una stanza per esplorare la musica destinata a essa.',
  'desk.browse.loading': 'Caricamento…',
  'desk.browse.empty': 'Nessuna selezione disponibile.',
  'desk.browse.unableToBrowse': 'Impossibile sfogliare la musica',
  'desk.browse.actions': 'Altre opzioni',
  'desk.browse.select': 'Seleziona',
  'desk.browse.needsLink.body':
    '{service} è collegato al tuo sistema Sonos {gen}.\nPer esplorarlo e '
    + 'controllarlo dovrai collegarlo anche a Sonora. È un accesso separato e '
    + 'non tocca la tua app Sonos.',
  'desk.browse.needsLink.action': 'Collega {service} a Sonora',
  'desk.actions.playNow': 'Riproduci ora',
  'desk.actions.playNext': 'Riproduci dopo',
  'desk.actions.addToQueue': 'Aggiungi in fondo alla coda',
  'desk.actions.addFavorite': 'Aggiungi ai Preferiti Sonos',
  'desk.actions.unselectAll': 'Deseleziona tutto',
  'desk.actions.replaceQueue': 'Sostituisci la coda',
  'desk.favorites.addToSonosPlaylist': 'Aggiungi a una playlist Sonos',
  'desk.favorites.addToServicePlaylist': 'Aggiungi a una playlist {service}',
  'desk.favorites.rename': 'Rinomina il preferito Sonos',
  'desk.favorites.remove': 'Rimuovi dai Preferiti Sonos',
  'desk.favorites.renameBody':
    'Inserisci un nuovo nome per questo preferito Sonos:',
  'desk.favorites.removed': '«{title}» è stato rimosso dai Preferiti Sonos.',
  'common.ok': 'OK',
  'desk.grouping.title': 'Raggruppa le stanze',
  'desk.grouping.willPlay': 'Le stanze selezionate riprodurranno:',
  'desk.grouping.select': 'Seleziona stanze da raggruppare:',
  'desk.grouping.partyMode': 'Seleziona tutto – Modalità festa',
  'desk.grouping.noMusic': '[nessuna musica]',
  'desk.grouping.chooseMusic': 'Fai clic su Fatto per scegliere la musica',
  'desk.grouping.pickTitle': 'Scegli la musica',
  'desk.grouping.pickHeading':
    'Scegli la musica da riprodurre nella stanza selezionata',
  'desk.grouping.unselectAll': 'Deseleziona tutto',
  'desk.grouping.noneTitle': 'Nessuna stanza selezionata',
  'desk.grouping.noneBody': 'La musica in riproduzione verrà interrotta. Vuoi continuare?',
  'desk.grouping.noneYes': 'Sì',
  'desk.prefs.title': 'Preferenze',
  'desk.prefs.general': 'Generali',
  'desk.prefs.basic': 'Base',
  'desk.prefs.themeShot': 'Anteprima del tema {theme}',
  'desk.prefs.themeNoShot': 'Nessuna anteprima per questo tema.',
  'desk.prefs.themeVersion': 'versione {version}',
  'desk.prefs.themeInstalled': 'installato',
  'desk.prefs.manageThemes': 'Gestisci i temi',
  'desk.prefs.themeUpload': 'Installa un tema…',
  'desk.prefs.themeDelete': 'Elimina il tema',
  'desk.prefs.themeBuiltIn':
    'I temi inclusi in Sonora non possono essere eliminati.',
  'desk.room.nightSound': 'Modalità notte',
  'desk.room.speech': 'Miglioramento del parlato',
  'desk.room.sub': 'Sub',
  'desk.room.subLevel': 'Livello del sub',
  'desk.room.surround': 'Surround',
  'desk.room.surroundLevel': 'Livello TV',
  'desk.room.musicSurroundLevel': 'Livello musica',
  'desk.room.audioDelay': 'Ritardo audio (sincronia labiale)',
  'desk.room.heightLevel': 'Livello dei canali in altezza',
  'desk.room.lineInName': 'Nome della sorgente a ingresso linea',
  'desk.room.lineInLevel': 'Livello della sorgente a ingresso linea',
  'desk.room.autoplayRoom': 'Stanza per la riproduzione automatica',
  'desk.room.autoplayOff': 'Disattivata',
  'desk.room.autoplayLinked': 'Includi le stanze raggruppate',
  'desk.room.autoplayUseVolume': 'Usa il volume della riproduzione automatica',
  'desk.room.autoplayVolume': 'Volume della riproduzione automatica',
  'desk.room.stereoPair': 'Coppia stereo',
  'desk.room.separate': 'Separa la coppia stereo',
  'desk.room.separateBody':
    'Separare la coppia stereo «{room}» in due stanze? La riproduzione si '
    + 'interrompe mentre gli speaker si riconfigurano.',
  'desk.room.pairWith': 'Scegli lo speaker destro…',
  'desk.room.createPair': 'Crea una coppia stereo',
  'desk.room.pairBody':
    'Rendere «{left}» il canale sinistro e «{right}» il canale destro di '
    + 'un’unica coppia stereo? La coppia mantiene il nome «{left}»; la '
    + 'riproduzione si interrompe mentre gli speaker si riconfigurano.',
  'desk.rooms.showMore': 'Mostra altre {n}…',
  'desk.rooms.showLess': 'Mostra meno…',
  'desk.rooms.allSystems': 'Tutti',
  'desk.rooms.menu.play': 'Riproduci {name}',
  'desk.rooms.menu.pause': 'Metti in pausa {name}',
  'desk.rooms.menu.stop': 'Interrompi {name}',
  'desk.rooms.menu.mute': 'Disattiva l’audio di {name}',
  'desk.rooms.menu.unmute': 'Riattiva l’audio di {name}',
  'desk.rooms.menu.eq': 'Equalizzatore di {name}…',
  'desk.rooms.menu.group': 'Raggruppa',
  'desk.prefs.musicLibrary': 'Impostazioni della libreria musicale',
  'desk.prefs.services': 'Impostazioni dei servizi',
  'desk.prefs.parental': 'Controllo parentale',
  'desk.prefs.dateTime': 'Impostazioni di data e ora',
  // The Mac Preferences window (S1 57.x on Tahoe, 2026-09-15).
  'desk.prefs.eqSettings': 'Impostazioni EQ',
  'desk.prefs.musicLibraryShort': 'Libreria musicale',
  'desk.prefs.servicesShort': 'Servizi',
  'desk.prefs.dateTimeShort': 'Data e ora',
  'desk.prefs.sonora': 'Sonora',
  'desk.prefs.mobileNote':
    'Apri l’app Sonos su un dispositivo mobile per gestire il tuo sistema.',
  'desk.prefs.getMobileApp': 'Scarica l’app mobile',
  'desk.prefs.eqFor': 'Impostazioni EQ musica per',
  'desk.prefs.eqCaption': 'Regola alti e bassi a tuo gusto.',
  'desk.prefs.roomFor': 'Impostazioni della stanza per',
  'desk.prefs.noRooms': 'Non è stata trovata alcuna stanza Sonos.',
  'desk.prefs.folderCol': 'Cartella',
  'desk.prefs.pathCol': 'Percorso',
  'desk.prefs.serviceNameCol': 'Nome del servizio',
  'desk.prefs.nameCol': 'Nome',
  'desk.prefs.loginCol': 'Accesso account',
  'desk.prefs.anonymous': '<Anonimo>',
  'desk.prefs.changeName': 'Cambia nome',
  'desk.prefs.reauthorize': 'Autorizza di nuovo l’account',
  'desk.prefs.visitLabs': 'Visita Sonos Labs',
  'desk.menu.settings': 'Impostazioni…',
  // The Mac app's sheets and About window (2026-09-15).
  'desk.queue.confirmTitle': 'Conferma',
  'desk.queue.clearBody': 'Vuoi davvero svuotare la coda?',
  'desk.queue.enterName': 'Inserisci un nuovo nome per la playlist:',
  'desk.queue.orReplace':
    'Oppure seleziona una playlist Sonos esistente da sostituire:',
  'desk.sleep.setFor': 'Imposta un timer di spegnimento per «{room}»:',
  'desk.about.sonosOs': 'Sonos OS',
  'desk.about.products': 'Prodotti',
  'desk.about.systemLine': 'Sonos OS {gen}: {count} prodotti',
  'desk.about.serial': 'Numero di serie',
  'desk.about.hardware': 'Versione hardware',
  'desk.about.series': 'ID serie',
  'desk.about.ip': 'Indirizzo IP',
  'desk.about.wm': 'WM',
  'desk.about.copy': 'Copia',
  'desk.about.copied': 'Copiato',
  'desk.alarms.note':
    'Le sveglie si creano e si modificano nell’app Sonos; qui si possono '
    + 'attivare, disattivare ed eliminare.',
  'desk.alarms.deleteBody': 'Eliminare la sveglia delle {time} in {room}?',
  'desk.alarms.deleteTitle': 'Elimina la sveglia',
  'desk.alarms.recurrence.WEEKENDS': 'Fine settimana',
  'desk.alarms.recurrence.WEEKDAYS': 'Giorni feriali',
  'desk.alarms.recurrence.DAILY': 'Tutti i giorni',
  'desk.alarms.recurrence.ONCE': 'Una volta',
  'desk.alarms.repeat': 'Ripeti',
  'desk.alarms.room': 'Stanza',
  'desk.alarms.time': 'Ora',
  'desk.alarms.enabled': 'Attiva',
  'desk.alarms.delete': 'Elimina',
  'desk.alarms.none': 'Nessuna sveglia su questo sistema.',
  'win.saveQueue.name': 'Inserisci un nuovo nome per la playlist:',
  'win.saveQueue.replace':
    'Oppure seleziona una playlist Sonos esistente da sostituire:',
  'win.alarm.addTitle': 'Aggiungi sveglia',
  'win.alarm.editTitle': 'Modifica sveglia',
  'win.alarm.alarm': 'Sveglia',
  'win.alarm.on': 'Attiva',
  'win.alarm.off': 'Disattiva',
  'win.alarm.music': 'Musica',
  'win.alarm.select': 'Seleziona…',
  'win.alarm.schedule': 'Programmazione',
  'win.alarm.onceOnly': 'Solo una volta',
  'win.alarm.volume': 'Volume',
  'win.alarm.duration': 'Durata',
  'win.alarm.noLimit': 'Nessun limite',
  'win.alarm.linked': 'Includi le stanze raggruppate',
  'win.alarm.shuffle': 'Riproduci la musica in ordine casuale',
  'win.alarm.chime': 'Suono Sonos',
  'win.alarm.browseTitle': 'Sfoglia la musica della sveglia',
  'win.alarm.alarmMusic': 'Musica della sveglia',
  'win.alarm.importedPlaylists': 'Playlist importate',
  'win.alarm.setMusic': 'Imposta la musica della sveglia',
  'win.alarm.day.1': 'Lunedì',
  'win.alarm.day.2': 'Martedì',
  'win.alarm.day.3': 'Mercoledì',
  'win.alarm.day.4': 'Giovedì',
  'win.alarm.day.5': 'Venerdì',
  'win.alarm.day.6': 'Sabato',
  'win.alarm.day.0': 'Domenica',
  'win.alarms.manage': 'Gestisci le sveglie Sonos',
  'win.alarms.currentTime': 'Ora attuale: {time}',
  'desk.alarms.currentTime': 'Ora corrente: {date} - {time} {zone}',
  'win.alarms.where': 'Dove',
  'win.alarms.when': 'Quando',
  'win.alarms.on': 'ATTIVA',
  'win.alarms.add': 'Aggiungi',
  'win.alarms.edit': 'Modifica',
  'win.alarms.remove': 'Rimuovi',
  'win.alarms.deleteConfirm': 'Vuoi davvero eliminare questa sveglia?',
  'win.alarms.help1': 'Aggiungi',
  'win.alarms.help2': 'Rimuovi',
  'desk.alarms.day.0': 'Dom',
  'desk.alarms.day.1': 'Lun',
  'desk.alarms.day.2': 'Mar',
  'desk.alarms.day.3': 'Mer',
  'desk.alarms.day.4': 'Gio',
  'desk.alarms.day.5': 'Ven',
  'desk.alarms.day.6': 'Sab',
  'desk.queue.saveHint': 'Nome della playlist',
  'desk.queue.saveBody': 'La coda sarà salvata come playlist Sonos.',
  'desk.queue.saveTitle': 'Salva la coda',
  'desk.queue.mixName': 'Mix del {weekday} {part}',
  'desk.queue.part.morning': 'mattina',
  'desk.queue.part.afternoon': 'pomeriggio',
  'desk.queue.part.night': 'sera',
  'desk.sleep.none': 'Nessun timer di spegnimento impostato.',
  'desk.sleep.elsewhere': 'Attivo anche altrove',
  'desk.sleep.remaining': 'Timer di spegnimento: {time} rimanenti',
  'desk.sleep.minutes': '{count} minuti',
  'desk.sleep.off': 'Disattivato',
  'desk.sleep.hours.one': '{count} ora',
  'desk.sleep.hours.other': '{count} ore',
  'services.needsSignIn':
    '{service} richiede un accesso prima di mostrare qualcosa. Collegalo a '
    + 'Sonora per esplorarlo qui; ciò che ne hai salvato nei Preferiti Sonos '
    + 'o nelle playlist Sonos continua a suonare.',
  'desk.library.folders': 'Cartelle',
  'desk.library.advanced': 'Avanzate',
  'desk.library.mine': 'Le mie cartelle musicali su Sonos',
  'desk.library.none':
    'A questo sistema Sonos non è stata aggiunta alcuna cartella musicale.',
  'desk.library.addFolder': 'Aggiungi…',
  'desk.library.add': 'Aggiungi',
  'desk.library.remove': 'Rimuovi',
  'desk.library.pathHint': '//nas/Musica',
  'desk.library.pathNote':
    'Sonora aggiunge le cartelle tramite il loro percorso di rete (per '
    + 'esempio //nas/Musica). La cartella deve essere già condivisa sulla tua '
    + 'rete. I lettori S1 supportano solo condivisioni SMBv1; quelli S2 '
    + 'parlano anche SMBv2 e SMBv3.',
  'desk.shareWizard.windowTitle': 'Configurazione di Sonora',
  'desk.shareWizard.whereTitle': 'Aggiungi cartella musicale',
  'desk.shareWizard.wherePrompt': 'Dove si trova la musica che vuoi riprodurre su Sonos?',
  'desk.shareWizard.myMusic': 'Cartella Musica',
  'desk.shareWizard.otherFolder': 'Un\'altra cartella o un\'unità collegata al mio computer',
  'desk.shareWizard.network': 'Dispositivo di rete (ad es. unità NAS)',
  'desk.shareWizard.serverNote': 'Sonora gira su un server, quindi le cartelle di questo computer sono fuori portata: può aggiungere una cartella condivisa in rete.',
  'desk.shareWizard.pathTitle': 'Aggiungi musica dalla condivisione di rete',
  'desk.shareWizard.pathPrompt': 'Digita il percorso della condivisione di rete:',
  'desk.shareWizard.loginTitle': 'Nome utente e password',
  'desk.shareWizard.loginPrompt': 'Inserisci nome utente e password dell\'unità di rete con la tua musica. Lasciali vuoti se la condivisione non li richiede.',
  'desk.shareWizard.fieldLabel': '{label}:',
  'desk.shareWizard.adding': 'Aggiunta delle informazioni della condivisione al sistema Sonos.',
  'desk.shareWizard.done': '«{path}» è ora configurata nel sistema Sonos. La sua musica viene aggiunta alla libreria.',
  'desk.shareWizard.failedTitle': 'Sonos non è riuscito ad aggiungere la cartella musicale',
  'desk.shareWizard.pathExamples': 'Esempi:\n\\\\MyOtherComputer\\Shared\\Music\n\\\\MyNetworkedStorage\\Shared\\Music',
  'desk.library.username': 'Nome utente',
  'desk.library.password': 'Password',
  'desk.library.credHint':
    'Lascia entrambi i campi vuoti solo se la condivisione consente gli '
    + 'ospiti. Molti server non lo fanno più.',
  'desk.library.removeTitle': 'Rimuovi la cartella musicale',
  'desk.library.removeBody':
    'Rimuovere {folder} dalla libreria musicale del tuo sistema Sonos? La '
    + 'musica contenuta non comparirà più in Sonos.',
  'desk.library.indexTitle': 'Aggiornamenti della libreria',
  'desk.library.schedule': 'Aggiorna l’indice musicale ogni giorno alle',
  'desk.library.updateNow': 'Aggiorna ora l’indice musicale',
  'desk.library.noFolders': 'Non hai ancora aggiunto cartelle musicali al tuo sistema Sonos.',
  'desk.library.addHint': 'Per aggiungere musica a Sonos, scegli {link} dal menu {menu}.',
  'desk.library.working':
    'Aggiornamento delle impostazioni della libreria musicale…',
  'desk.library.indexing': 'Aggiornamento della libreria musicale… Attendi.',
  'desk.library.indexError':
    'Sonos non è riuscito a completare l’aggiornamento dell’indice '
    + 'musicale: {error}',
  'desk.library.addPending':
    'Sonos sta ancora aggiungendo quella cartella. Comparirà qui una volta '
    + 'montata dai lettori.',
  'desk.library.adding': 'Aggiunta della cartella musicale',
  'desk.library.addedIndexing':
    'Aggiunta. Sonos sta aggiornando l’indice musicale: con una cartella '
    + 'grande può volerci qualche minuto.',
  'desk.library.addingPath':
    '{path} — i lettori la stanno montando. Con una cartella grande può '
    + 'volerci qualche minuto.',
  'desk.library.addFailed':
    'Sonos non è riuscito ad aggiungere la cartella musicale {path}.',
  'desk.library.addFailedWhy':
    'Verifica che il percorso della cartella e, se servono, nome utente e '
    + 'password siano corretti.',
  'desk.library.addReason': 'Motivo: {reason}',
  'desk.library.compilations': 'Raggruppa gli album per',
  'desk.library.updateDaily': 'Aggiorna i contenuti ogni giorno alle:',
  'desk.library.showContributing':
    'Mostra gli artisti collaboratori nella libreria musicale. Questa '
    + 'preferenza vale solo per questo controller.',
  'desk.library.sortFolders': 'Ordina le cartelle per',
  'desk.library.sort.songNumber': 'Numero del brano',
  'desk.library.sort.songName': 'Nome del brano',
  'desk.library.sort.fileName': 'Nome del file',
  'desk.library.artists': 'Artisti',
  'desk.library.contributingArtists': 'Artisti collaboratori',
  'desk.library.albums': 'Album',
  'desk.library.composers': 'Compositori',
  'desk.library.genres': 'Generi',
  'desk.library.songs': 'Brani',
  'desk.library.importedPlaylists': 'Playlist importate',
  'desk.library.foldersNode': 'Cartelle',
  'desk.library.groupBy': 'Raggruppa le compilation per',
  'desk.library.group.ITUNES': 'Compilation iTunes®',
  'desk.library.group.WMP': 'Artisti dell’album',
  'desk.library.group.NONE': 'Non raggruppare le compilation',
  'desk.library.compilationsNote':
    'Cambiare il raggruppamento delle compilation aggiorna l’indice '
    + 'musicale.',
  'desk.time.timeZone': 'Fuso orario',
  'desk.time.autoDst': 'Regola automaticamente per l’ora legale',
  'desk.time.internet': 'Imposta data e ora da Internet',
  'desk.time.date': 'Data',
  'desk.time.time': 'Ora',
  'desk.time.dateFormat': 'Formato data',
  'desk.time.timeFormat': 'Formato ora',
  'desk.time.fmt.MDY': 'Mese/Giorno/Anno',
  'desk.time.fmt.DMY': 'Giorno/Mese/Anno',
  'desk.time.fmt.YMD': 'Anno/Mese/Giorno',
  'desk.time.fmt.12H': '12 ore',
  'desk.time.fmt.24H': '24 ore',
  'desk.time.notSet': 'Non impostata',
  'desk.time.setNow': 'Imposta',
  'desk.time.loading': 'Lettura delle impostazioni dell’ora…',
  'desk.time.server': 'Server orario: {server}',
  'desk.parental.body':
    'Il filtro dei contenuti espliciti è un’impostazione del tuo sistema '
    + 'Sonos, condivisa da tutte le app che lo controllano. Sonora la legge '
    + 'dai tuoi speaker e la mostra qui sotto.\nModificarla richiede una '
    + 'credenziale che Sonos rilascia solo alle proprie app: gli speaker '
    + 'accettano la scrittura da qualsiasi controller, ma soltanto con un '
    + 'token emesso per l’app Sonos, e l’unico permesso che Sonos offre agli '
    + 'altri sviluppatori riguarda la sola riproduzione. L’app Sonos può '
    + 'farlo; questa aspetta Sonos.\nNon tutti i servizi supportano il filtro '
    + 'dei contenuti.',
  'desk.parental.filter': 'Filtra i contenuti espliciti',
  'desk.parental.filterFor': 'Filtra i contenuti espliciti su {system}',
  'desk.parental.on': 'Filtri dei contenuti attivi',
  'desk.parental.off': 'Filtri dei contenuti disattivati',
  'desk.parental.unknown': 'Impossibile leggere i filtri dei contenuti',
  'desk.parental.reading': 'Lettura dell’impostazione…',
  'desk.parental.turnOn': 'Attiva il filtro dei contenuti espliciti',
  'desk.parental.moreInfo': 'Altre informazioni',
  'desk.parental.unavailable':
    'Sonos consente questa modifica solo alle proprie app',
  'desk.prefs.roomSettings': 'Impostazioni della stanza',
  'desk.prefs.settingsFor': 'Impostazioni per {room}',
  'desk.prefs.musicEq': 'EQ musica',
  'desk.prefs.device': 'Dispositivo',
  'desk.prefs.bass': 'Bassi',
  'desk.prefs.treble': 'Alti',
  'desk.prefs.balance': 'Bilanciamento',
  'desk.prefs.left': 'S',
  'desk.prefs.right': 'D',
  'desk.prefs.loudness': 'Loudness',
  'desk.prefs.reset': 'Ripristina',
  'desk.prefs.eqFixed':
    'Le impostazioni di equalizzazione non sono disponibili finché il '
    + 'livello Line-Out di uno speaker Sonos è impostato su Fisso.',
  'desk.prefs.roomName': 'Nome della stanza',
  'desk.prefs.apply': 'Applica',
  'desk.prefs.statusLight': 'Spia di stato',
  'desk.prefs.on': 'Attiva',
  'desk.prefs.off': 'Disattivata',
  'desk.prefs.servicesTitle': 'I miei account dei servizi su Sonos',
  'desk.prefs.servicesSignIn':
    'Non è elencato alcun servizio configurato. Sonora li legge '
    + 'direttamente dagli speaker, quindi di solito significa che nessuno è '
    + 'stato raggiunto.',
  'desk.about.title': 'Informazioni sul mio sistema Sonos',
  'desk.about.body': 'Gli speaker su questa rete, per sistema.',
  'desk.about.model': 'Modello',
  'desk.about.version': 'Versione',
  'desk.about.address': 'Indirizzo',
  'desk.about.speakers': 'Speaker',
  'desk.about.system': 'Sistema',
  'desk.shortcuts.title': 'Scorciatoie da tastiera',
  'desk.shortcuts.playPause': 'Riproduci/Pausa',
  'desk.shortcuts.volUp': 'Aumenta il volume',
  'desk.shortcuts.volDown': 'Riduci il volume',
  'desk.shortcuts.mute':
    'Disattiva/riattiva l’audio della stanza o del gruppo attuale',
  'desk.shortcuts.nextZone': 'Seleziona il gruppo di stanze successivo',
  'desk.shortcuts.prevZone': 'Seleziona il gruppo di stanze precedente',
  'notice.cannotPlay.title': 'Non è stato possibile riprodurlo',
  'notice.cannotPlay.detail':
    '{room} non è riuscita a riprodurre {item}. {reason}',
  'notice.cannotPlay.stream':
    '{room} non è riuscita a riprodurre {item}: da {host} non è arrivato '
    + 'nulla. {reason}',
  'notice.cannotPlay.format': 'Lo speaker non supporta questo formato.',
  'notice.cannotPlay.connect': 'Lo speaker non è riuscito a raggiungerlo.',
  'notice.cannotPlay.refused': 'Il servizio ne ha rifiutato la riproduzione.',
  'notice.cannotPlay.missing': 'Non è più disponibile.',
  'notice.cannotPlay.permission':
    'Questo account non è autorizzato a riprodurlo.',
  'notice.notPlaying.title': 'Non è partito nulla',
  'notice.notPlaying.detail':
    '{room} ha accettato la riproduzione e poi si è fermata. La sorgente '
    + 'attuale non è riproducibile; scegli altro dal pannello Musica.',
  'notice.notPlaying.stream':
    '{room} ha accettato la riproduzione e poi si è fermata. La sua '
    + 'sorgente è un flusso da {host}, che risulta non in linea.',
  'desk.menu.quit': 'Esci da Sonos',
  'desk.menu.delete': 'Elimina',
  'desk.menu.selectAll': 'Seleziona tutto',
  'desk.menu.fullScreen': 'Attiva schermo intero',
  'desk.menu.updatePlaylists': 'Aggiorna ora le playlist di iTunes',
  'desk.menu.updateAlbumArt': 'Aggiorna ora le copertine',
  'desk.menu.window': 'Finestra',
  'desk.menu.close': 'Chiudi',
  'desk.menu.uninstall': 'Disinstalla…',
  'desk.menu.services': 'Servizi',
  'desk.menu.hideSonos': 'Nascondi Sonos',
  'desk.menu.hideOthers': 'Nascondi altre',
  'desk.menu.showAll': 'Mostra tutte',
  'desk.menu.autofill': 'Riempimento automatico',
  'desk.menu.dictation': 'Avvia dettatura…',
  'desk.menu.emoji': 'Emoji e simboli',
  'desk.menu.fill': 'Riempi',
  'desk.menu.center': 'Centra',
  'desk.menu.moveResize': 'Sposta e ridimensiona',
  'desk.menu.fullScreenTile': 'Affianca a tutto schermo',
  'desk.menu.removeFromSet': 'Rimuovi finestra dal gruppo',
  'win.menu.file': 'File',
  'win.menu.exit': 'Esci',
  'win.menu.showMini': 'Mostra il mini controller',
  'win.shortcuts.toggleMini': 'Mostra/nascondi il mini controller',
  'win.setup.title': 'Configurazione di Sonora',
  'win.setup.lib.pathTitle': 'Aggiungi musica da una condivisione di rete',
  'win.setup.lib.pathText':
    'Digita il percorso della tua condivisione di rete:',
  'win.setup.lib.examples': 'Esempi:',
  'win.setup.lib.browse': 'Sfoglia',
  'win.setup.lib.credTitle': 'Nome utente e password',
  'win.setup.lib.credText':
    'Inserisci nome utente e password, se richiesti, dell’unità di rete che '
    + 'contiene la tua musica:',
  'win.setup.lib.username': 'Nome utente:',
  'win.setup.lib.password': 'Password:',
  'win.setup.lib.adding': 'Aggiunta della cartella musicale',
  'win.setup.lib.doneTitle': 'Configurazione della libreria musicale',
  'win.setup.lib.doneSetUp':
    '«{folder}» è ora configurata sul tuo sistema Sonos.',
  'win.setup.lib.doneAdding':
    'La tua musica è in fase di aggiunta al sistema Sonos. L’operazione può '
    + 'richiedere alcuni minuti.',
  'win.setup.lib.doneNotice':
    'In futuro potrai aggiungere musica a Sonos da «Gestisci libreria '
    + 'musicale» nelle Impostazioni.',
  'win.setup.lib.errorTitle': 'Errore nell’aggiunta della musica',
  'win.setup.lib.errorMessage':
    'Sonos non è riuscito ad aggiungere la cartella musicale',
  'win.setup.lib.errorDetails':
    'Verifica che il percorso della cartella e, se servono, nome utente e '
    + 'password siano corretti.',
  'win.setup.lib.errorReason': 'Motivo: {reason}',
  'win.services.addHint':
    'Fai clic su «Aggiungi» per aggiungere un nuovo servizio al tuo sistema '
    + 'Sonos.',
  'win.services.labsHint':
    'Fai clic su «Sonos Labs» per provare i servizi in arrivo sul tuo '
    + 'sistema Sonos.',
  'win.services.serviceName': 'Nome del servizio',
  'win.services.name': 'Nome',
  'win.services.login': 'Accesso account',
  'win.services.anonymous': '<Anonimo>',
  'win.services.add': 'Aggiungi',
  'win.services.signInWith': 'Accedi con {service}',
  'win.services.labs': 'Sonos Labs',
  'win.services.addTitle': 'Aggiungi un servizio',
  'win.services.labsTitle': 'Benvenuto in Sonos Labs',
  'win.services.labsPrompt':
    'Seleziona il servizio Sonos Labs che vuoi aggiungere:',
  'win.services.labsSignedOut':
    'Accedi al tuo account Sonos per vedere i servizi Sonos Labs.',
  'win.services.labsFailed':
    'Impossibile recuperare l’elenco dei servizi Sonos Labs: {error}',
  'win.services.edit': 'Modifica',
  'win.services.editTitle': 'Modifica servizio',
  'win.services.editHeading': 'Modifica l’account {service}',
  'win.services.editPrompt': 'Inserisci un nome per l’account:',
  'win.services.editName': 'Nome:',
  'win.services.replace': 'Sostituisci',
  'win.services.reauthorize': 'Riautorizza',
  'win.services.removeTitle': 'Rimuovi account',
  'win.services.removeBody':
    'Vuoi davvero rimuovere questo account {service} dal tuo sistema Sonos?',
  'win.eq.tab': 'EQ',
  'win.eq.intro': 'Regola alti e bassi a tuo gusto.',
  'win.errorLog.title': 'Registro degli errori di sistema di Sonora',
  'desk.errorLog.empty': 'Negli ultimi sette giorni non è stato registrato alcun errore.',
  'win.library.title': 'Le mie cartelle musicali su Sonos',
  'win.library.addHint':
    'Fai clic su «Aggiungi» per aggiungere una nuova cartella musicale al '
    + 'tuo sistema Sonos.',
  'win.library.removeHint':
    'Fai clic su «Rimuovi» per togliere la cartella evidenziata.',
  'win.library.name': 'Nome',
  'win.library.path': 'Percorso',
  // The Windows app's own two lines while the library updates.
  'win.library.indexing1': 'Aggiornamento della libreria musicale…',
  'win.library.indexing2': 'Attendi.',
  'win.mini.noMusic': '[nessuna musica]',
  'win.mini.volume': 'Volume',
  'win.mini.larger': 'Più grande',
  'win.mini.smaller': 'Più piccolo',
  'win.menu.checkUpdates': 'Cerca aggiornamenti software…',
  'win.menu.changeLanguage': 'Cambia lingua…',
  'win.menu.settings': 'Impostazioni…',
  'win.settings.title': 'Impostazioni',
  'win.sleep.title': 'Timer di spegnimento ({state})',
  'win.sleep.choose':
    'Scegli la durata del timer di spegnimento per "{room}":',
  'desk.window.controller': 'Controller Sonora {systems}',
  'win.about.title': 'Informazioni',
  'win.about.version': 'Versione:',
  'win.about.os': 'Sonos OS:',
  'win.about.license': 'Licenza:',
  'win.about.system': 'Sistema Sonos {gen}:',
  'win.about.serial': 'Numero di serie',
  'win.about.ip': 'Indirizzo IP',
  'win.about.associated': 'Prodotto associato:',
  'win.about.hardware': 'Versione hardware',
  'win.about.series': 'ID serie',
  'win.about.wm': 'WM',
  'win.shortcuts.intro':
    'Sonora supporta le seguenti scorciatoie da tastiera:',
  'win.shortcuts.function': 'Funzione',
  'win.shortcuts.shortcut': 'Scorciatoia',
  'win.shortcuts.toggleShuffle': 'Attiva/disattiva la riproduzione casuale',
  'win.shortcuts.toggleRepeat': 'Attiva/disattiva la ripetizione',
  'win.shortcuts.muteAll': 'Disattiva l’audio ovunque',
  'win.shortcuts.topMenu': 'Torna al menu Musica principale',
  'win.shortcuts.favorites': 'Vai ai preferiti',
  'win.shortcuts.toggleCrossfade':
    'Attiva/disattiva la dissolvenza incrociata',
  'win.shortcuts.scrollCurrent': 'Scorri al brano attuale nella coda',
  'win.shortcuts.closeWindow': 'Chiudi la finestra attiva',
  'win.shortcuts.browserNote':
    'Tre di queste differiscono dall’app Sonos: un browser tiene per sé '
    + 'Ctrl+T, Ctrl+L e Ctrl+W.',
  'win.shortcuts.jumpSearch': 'Vai al campo di ricerca',
  'win.shortcuts.playNext': 'Riproduci dopo il brano selezionato',
  'win.shortcuts.replaceQueue': 'Sostituisci la coda con la selezione',
  'win.shortcuts.playLater': 'Riproduci la selezione più tardi',
  'win.shortcuts.resizeQueue': 'Ridimensiona la coda',
  'win.shortcuts.prevTrack': 'Brano precedente',
  'win.shortcuts.nextTrack': 'Brano successivo',
  'win.shortcuts.showShortcuts':
    'Mostra l’elenco delle scorciatoie da tastiera',
  'win.settings.sonora': 'Sonora',
  'win.parental.title': 'Controllo parentale',
  'win.parental.enabled':
    'Il filtro dei contenuti espliciti è attivo. Fai clic sul pulsante qui '
    + 'sotto per consentire la riproduzione di contenuti espliciti sul tuo '
    + 'sistema Sonos.\n\nNon tutti i servizi supportano il filtro dei '
    + 'contenuti.',
  'win.parental.disabled':
    'Il filtro dei contenuti espliciti è disattivato. Fai clic sul pulsante '
    + 'qui sotto per impedire la riproduzione di contenuti espliciti sul tuo '
    + 'sistema Sonos.\n\nNon tutti i servizi supportano il filtro dei '
    + 'contenuti.',
  'win.parental.noServices':
    'Sul tuo sistema Sonos non ci sono servizi musicali che supportano il '
    + 'filtro dei contenuti.',
  'win.parental.unreadable':
    'Questo sistema non ha comunicato se il filtro dei contenuti espliciti '
    + 'è attivo.',
  'win.parental.turnOn': 'Attiva il filtro dei contenuti espliciti',
  'win.parental.turnOff': 'Disattiva il filtro dei contenuti espliciti',
  'win.parental.moreInfo': 'Altre informazioni',
  'win.settings.eq': 'Impostazioni EQ',
  'win.settings.library': 'Libreria musicale',
  'win.settings.services': 'Servizi',
  'win.settings.eqFor': 'Impostazioni EQ per',
  'win.settings.mobileNote':
    'Apri l’app Sonos su un dispositivo mobile per gestire il tuo sistema.',
  'win.settings.getApp': 'Scarica l’app mobile',
  'win.maximize': 'Ingrandisci',
  'win.restore': 'Ripristina',
  'desk.menu.minimize': 'Riduci a icona',
  'desk.menu.zoom': 'Zoom',
  'desk.menu.bringAllToFront': 'Porta tutto in primo piano',
  'desk.menu.shop': 'Acquista prodotti Sonos',
  'desk.menu.firewallHelp': 'Guida alla configurazione del firewall',
  'desk.menu.errorLog': 'Registro degli errori',
  'desk.menu.reset': 'Reimposta il controller',
  'desk.menu.forget': 'Dimentica il sistema Sonos attuale',
  'desk.window.title': 'Sonora',
  'desk.add.title': 'Aggiungi servizi musicali',
  'desk.add.button': 'Aggiungi…',
  'desk.add.intro':
    'Seleziona un servizio da aggiungere al tuo sistema Sonos.',
  'win.addService.title': 'Aggiungi un servizio',
  'win.addService.heading': 'Servizi disponibili',
  'win.addService.intro': 'Seleziona il servizio da aggiungere al tuo sistema Sonos.',
  'desk.add.auth.Anonymous': 'Nessun account necessario',
  'desk.add.appOnly': 'Solo app Sonos',
  'desk.add.another': 'Un altro account',
  'desk.add.unpairable':
    '{service} si può aggiungere solo con l’app Sonos ufficiale: il suo '
    + 'fornitore non fa accedere un controller non Sonos.',
  'desk.add.auth.DeviceLink': 'Accesso sul sito del fornitore',
  'desk.add.auth.AppLink': 'Accesso sul sito del fornitore, se offerto',
  'desk.add.needsApp':
    '{service} non consente l’accesso da Sonora; il suo fornitore accetta '
    + 'l’accesso solo tramite l’app Sonos ufficiale. Aggiungilo lì per usarlo '
    + 'nelle app Sonos. Ciò che ne hai salvato nei Preferiti Sonos o nelle '
    + 'playlist Sonos continua a suonare in Sonora.',
  'desk.add.instructions': 'Vai su {url}, accedi e inserisci questo codice:',
  'desk.add.instructionsNoCode':
    'Vai su {url} e accedi per autorizzare Sonos.',
  'desk.add.open': 'Apri nel browser',
  'desk.add.waiting': 'In attesa della conferma di {service}…',
  'desk.add.authorizeTitle': 'Aggiungi account {service}',
  'desk.add.authorizeBody': 'Accedi a {service} nel browser per consentire a Sonos di usare il tuo account.',
  'desk.add.authorize': 'Autorizza',
  'desk.add.doneSystem.multi':
    '{service} è stato aggiunto al tuo sistema {gen} ed è pronto sui tuoi '
    + 'dispositivi {gen}, in Sonora come nell’app Sonos ufficiale. Per usarlo '
    + 'anche sui dispositivi {other}, aggiungilo di nuovo dai {link}.',
  'desk.add.doneSystem.solo':
    '{service} è stato aggiunto al tuo sistema Sonos ed è pronto sui tuoi '
    + 'dispositivi, in Sonora come nell’app Sonos ufficiale.',
  'desk.add.doneAnon.multi':
    '{service} è ora disponibile in Sonora sui tuoi dispositivi {gen}. Non '
    + 'è stato possibile aggiungerlo al tuo sistema Sonos, quindi non '
    + 'comparirà nelle app Sonos. Per usarlo sui dispositivi {other} in '
    + 'Sonora, aggiungilo di nuovo dai {link}.',
  'desk.add.doneAnon.solo':
    '{service} è ora disponibile in Sonora sui tuoi dispositivi. Non è '
    + 'stato possibile aggiungerlo al tuo sistema Sonos, quindi non comparirà '
    + 'nelle app Sonos.',
  'desk.add.failed': 'Impossibile aggiungere {service}: {error}',
  // --- About dialog ------------------------------------------------------
  'about.title': 'Informazioni su Sonora',
  'about.menu': 'Informazioni su Sonora',
  'about.version': 'Versione {version}',
  'about.tagline': 'Un controller web self-hosted per tutti gli altoparlanti Sonos.',
  'about.pointLocal': 'Controllo prima di tutto locale',
  'about.pointThemes': 'Temi molto curati',
  'about.pointNetwork': 'Diagnostica di rete',
  'about.pointUpgrade': 'Consulente per l’aggiornamento hardware',
  'about.pointMore': 'E molto altro…',
  'about.license': 'Sonora è software libero, rilasciato con licenza {license}.',
  'about.github': 'Vedi su GitHub',
  'about.thirdParty': 'Licenze di terze parti',
  'about.support': 'Sostieni Sonora',
  'about.supportNote': 'Se Sonora ti è utile, valuta di sostenere il progetto.',
  'about.trademark': 'Sonora non è affiliato né approvato da Sonos.\nSonos è un marchio di Sonos, Inc.',
  'desk.showSystem': 'Mostra il sistema',
  'desk.services.tab': 'Servizi {system}',
  'desk.add.starting': 'Richiesta di un link di accesso a {service}…',
  'desk.add.linking': 'Collegamento a {service}…',
  // --- removing a music service (every theme) --------------------------------
  'services.remove': 'Rimuovi',
  'services.rename': 'Rinomina',
  'services.renameTitle': 'Rinomina l’account {service}',
  'services.renamed': 'Account {service} rinominato in {name}',
  'services.removeHint': 'Rimuovi il servizio evidenziato',
  'services.removeTitle': 'Rimuovere {service}?',
  'services.removeChoose': 'Da dove vuoi rimuovere {service}?',
  'services.removeSonora': 'Sonora',
  'services.removeSonoraSub': 'il suo accesso e la sua voce qui',
  'services.removeSonos': 'Sonos {gen}',
  'services.removeSonosSub': 'l’account sul tuo sistema Sonos',
  'services.confirmRemove': 'Rimuovi',
  'services.removing': 'Rimozione di {service}…',
  'services.removeFailed': 'Impossibile rimuovere {service}: {error}',
  'services.removeFromSonos': 'Rimuovi da Sonos',
  'services.removeSonosBody':
    'Rimuovere {service} dal tuo sistema Sonos? Sparirà da tutte le app '
    + 'Sonos, non solo da Sonora.',
  'services.removeSonoraBody': 'Rimuovere {service} da Sonora? Sonora dimentica il suo accesso.',
  'desk.add.doneSonora.multi':
    '{service} è ora collegato in Sonora.\nDovrai collegare {service} anche '
    + 'una seconda volta — direttamente in una delle app Sonos {gen} — perché '
    + 'Sonora possa controllare i tuoi dispositivi {gen}.\nPer usare {service} '
    + 'sui dispositivi {other} in Sonora, collegalo di nuovo dai {link}.',
  'services.relinkLinkText': 'servizi {other}',
  'services.caution.sonos': 'Collegato a Sonos {gen}, non ancora a Sonora',
  'services.needsSonora.title': 'Collegamento a Sonora necessario',
  'services.needsSonos.title': 'Collegamento a Sonos {gen} necessario',
  'services.caution.sonora': 'Collegato a Sonora, non ancora a Sonos {gen}',
  'services.sonoraOnly.body':
    '{service} è collegato in Sonora ma non al tuo sistema Sonos '
    + '{gen}.\nSonora può esplorarlo, ma i tuoi dispositivi {gen} non potranno '
    + 'riprodurlo finché non collegherai {service} da una delle app Sonos '
    + '{gen}.',
  'desk.add.doneSonora.solo':
    '{service} è ora collegato in Sonora.\nDovrai collegare {service} anche '
    + 'una seconda volta — direttamente in una delle app Sonos {gen} — perché '
    + 'Sonora possa controllare i tuoi dispositivi {gen}.',

  // --- Sonofuture ---

  // --- S2 Upgrade Info ---
  's2.title': 'Consulente per l’aggiornamento Sonos',
  's2.lede':
    'Scopri quale hardware servirebbe per passare completamente a S2 o S2.1 '
    + 'e quanto costerebbe all’incirca.',
  's2.con4':
    'L’app S1 è invariata da anni ed è stabile. L’app S2 è stata riscritta '
    + 'nel 2024 e quel rilascio è stato travagliato.',
  's2.colRoom': 'Stanza',
  's2.colProduct': 'Prodotto',
  's2.colReplacement': 'Equivalente S2',
  's2.colReplacementS21': 'Equivalente S2.1',
  's2.colPrice': 'Prezzo di listino USA',
  's2.ready': 'Sì',
  's2.notReady': 'No, solo S1',
  's2.unknown': 'Non noto',
  's2.replaceTitle': 'Quanto costerebbe avere S2 in ogni stanza',
  's2.replaceBlurb': 'Ogni dispositivo della casa e ciò che gli serve per arrivare a S2: un aggiornamento software, una sostituzione a prezzo di listino o niente.',
  's2.noReplacement': 'Niente da comprare',
  's2.noReplacementWhy':
    'uno speaker cablato porta la rete, e l’app ha sostituito il controller',
  's2.total': 'Totale per portare questo sistema a S2',
  's2.amazonDisclosure': 'In qualità di Affiliato Amazon io ricevo un guadagno dagli acquisti idonei.',
  's2.pricesNote': 'Prezzi di listino negli USA, verificati nel {quarter}° trimestre {year}. I prezzi possono cambiare: verifica prima di acquistare.',
  's2.timelineTitle': 'Tre generazioni di hardware',
  's2.era.s1': 'Solo S1',
  's2.era.s20': 'S2.0',
  's2.era.s21': 'S2.1',
  's2.eraSpan': 'dal {from} al {to}',
  's2.eraOpen': 'dal {from} a oggi',
  's2.eraBounds.s1':
    'Dallo ZonePlayer 100 (gennaio 2005) al Play:5 gen. 1 (novembre 2015). '
    + 'Nulla di quegli anni può eseguire S2.',
  's2.eraBounds.s20':
    'Dal Play:3 (luglio 2011) alla lampada da tavolo Symfonisk gen. 1 '
    + '(gennaio 2022). Esegue S2, escluso dalle nuove funzioni dal 2025.',
  's2.eraBounds.s21':
    'Dal Sonos One (ottobre 2017) in poi. Tutto ciò che Sonos vende oggi.',
  's2.mark.s2app': 'App S2, giugno 2020',
  's2.mark.freeze': 'S2.0 congelato, 2025',
  's2.linksIntro': 'Nelle parole di Sonos:',
  's2.linkS2Launch': 'La presentazione di S2, giugno 2020',
  's2.linkS21Launch': 'L’aggiornamento dei prodotti legacy del 2025',
  's2.allReady':
    'Ogni dispositivo S1 qui presente può eseguire S2. Questo sistema può '
    + 'passare senza comprare nulla.',
  's2.allS21':
    'Tutti i tuoi dispositivi sono sulla piattaforma Sonos S2.1. Non hai '
    + 'nulla da aggiornare. O sei arrivato da poco in Sonos o sei molto '
    + 'ricco. In ogni caso, complimenti!',

  // --- the network map ---
  'net.mapTitle': 'Tutti i dispositivi sulla rete',
  'net.mapBlurb': 'Una scheda per altoparlante. Ognuna dice se la connessione è in buono stato e perché, in base a quanto rapidamente e in modo affidabile risponde. Apri Dettagli per il resto.',
  'net.mapEmpty': 'Nessun dispositivo ha risposto.',
  'net.wired': 'Cablato',
  'net.onSonosnet': 'SonosNet',
  'net.onWifi': 'Wi-Fi',
  'net.channel': 'Canale {n}',
  'net.unreachable': 'Non ha risposto',
  'net.notMeasurable': 'Nessun vicino da misurare',
  'net.drop.title': 'Interruzioni della riproduzione',
  'net.drop.blurb': 'Le volte negli ultimi sette giorni in cui la musica in una stanza si è interrotta.',
  'net.drop.none': 'Nessuna interruzione negli ultimi sette giorni.',
  'net.drop.buffering': 'In pausa {seconds} s per il buffering',
  'net.drop.skipped': 'Ha saltato qualcosa che non poteva riprodurre',
  'net.drop.failed': 'Interrotto: impossibile riprodurre',
  'net.drop.more': 'E altre {count} precedenti.',
  'net.fix.no_answer': 'Controlla che sia acceso e ancora nella tua rete.',
  'net.fix.lost': 'Di solito copertura debole dove si trova o un canale affollato. Provalo più vicino al router.',
  'net.fix.slow': 'Spesso un segnale debole dal router. Avvicinare l\'altoparlante o il router di solito aiuta.',
  'net.fix.slow_often': 'Di solito altro traffico Wi-Fi o interferenze sul suo canale: microonde, baby monitor e reti dei vicini sono cause comuni.',
  'net.fix.uneven': 'Di solito altro traffico Wi-Fi o interferenze sul suo canale: microonde, baby monitor e reti dei vicini sono cause comuni.',
  'net.fix.stall': 'Una singola pausa lunga di solito è un picco di altro traffico Wi-Fi. Se si ripete in questa stanza, cerca interferenze nelle vicinanze.',
  'net.fix.dropping': 'Il suo collegamento Wi-Fi perde pacchetti. Le cause abituali sono un segnale debole o interferenze vicine.',
  'net.fix.extender': 'I ripetitori aggiungono ritardo. Collegalo al router principale se lo raggiunge.',
  'net.summary.clear': 'Niente da segnalare. Tutti gli altoparlanti rispondono subito.',
  'net.summary.issues': '{parts}. La scheda di ogni altoparlante qui sotto spiega perché.',
  'net.summary.and': ' e ',
  'net.probing': 'Verifica degli altoparlanti. Attendi...',
  'net.health.good': 'Buono',
  'net.health.watch': 'Da tenere d\'occhio',
  'net.health.problem': 'Problema',
  'net.health.unmeasured': 'Non misurato',
  'net.why.ok': 'Risponde in {median} ms',
  'net.why.no_answer': 'Nessuna risposta su {attempts} tentativi',
  'net.why.lost': 'Mancate {failed} risposte su {attempts}',
  'net.why.slow': 'Di solito risponde in {median} ms',
  'net.why.slow_often': '1 risposta su 20 supera i {p95} ms',
  'net.why.uneven': '1 risposta su 20 supera i {p95} ms',
  'net.why.stall': 'Una risposta ha richiesto {worst} ms',
  'net.why.dropping': 'Perde {rate} pacchetti al minuto',
  'net.why.extender': 'Connesso tramite un ripetitore Wi-Fi',
  'net.details': 'Dettagli',
  'net.replies': 'Risposte',
  'net.repliesLine': 'di solito {median} ms · 1 su 20 oltre {p95} ms · la più lenta {worst} ms · {failed} mancate su {attempts}',
  'net.dropped': 'Pacchetti persi',
  'net.perMinute': '{n} al minuto',
  'net.notReported': 'Non indicato',
  'net.hears': 'Sente altri altoparlanti Sonos',
  'net.hearsHint': 'Quanto forte questo altoparlante sente gli altri altoparlanti del suo sistema. Descrive dove si trova, non la sua connessione Wi-Fi: nessun altoparlante Sonos indica quanto bene sente il router.',
  'net.noiseLabel': 'Rumore radio',
  'net.count.problem.one': '{count} problema',
  'net.count.problem.other': '{count} problemi',
  'net.count.watch.one': '{count} da tenere d\'occhio',
  'net.count.watch.other': '{count} da tenere d\'occhio',
  'net.margin': 'margine di {n} dB',
  'net.alone': 'Nessun altoparlante nel raggio',
  's2.tier.s21': 'S2.1',
  's2.tier.s20': 'S2.0',
  's2.tier.unknown': 'Non noto',
  's2.s21Title': 'Quanto costerebbe avere S2.1 in ogni stanza',
  's2.s21Blurb': 'Ogni dispositivo della casa e ciò che gli serve per arrivare a S2.1. Un\'unità che non può usare S2 o che arriverebbe solo a S2.0 viene sostituita dal prodotto attuale che ne prende il posto. Il totale include quanto costerebbe passare a S2.',
  's2.colWhy': 'Motivo',
  's2.why.legacy': 'Non può eseguire S2',
  's2.why.lower': 'Solo S2.0',
  's2.why.upgradable': 'Aggiornabile',
  's2.why.runningS2': 'Con S2',
  's2.why.runningS21': 'Con S2.1',
  's2.totalS21': 'Totale per arrivare a S2.1 in ogni stanza',
  's2.s21AllReady':
    'Ogni stanza qui sarebbe già S2.1. Non c’è nulla da comprare.',
  's2.tierUnknownNote.one':
    'Un dispositivo non è stato collocato in una fascia: Sonos elenca solo '
    + 'alcune generazioni di quel prodotto, e lo speaker non dichiara quale '
    + 'sia.',
  's2.tierUnknownNote.other':
    '{count} dispositivi non sono stati collocati in una fascia: Sonos '
    + 'elenca solo alcune generazioni di quei prodotti, e gli speaker non '
    + 'dichiarano quali siano.',
  's2.choiceTitle': 'Cosa vuoi fare?',
  's2.choiceKeepBoth': 'Mantenere sistemi S1 e S2 separati',
  's2.choiceKeepBothNote':
    'Mantenere due sistemi Sonos distinti, S1 e S2, come adesso. (Alcuni '
    + 'dispositivi S1 possono essere aggiornati via software a S2.)',
  's2.choiceStayS1': 'Continua a usare il sistema S1',
  's2.choiceStayS1Note': 'Continua a usare il tuo sistema S1 come fai ora. Non serve fare nulla.',
  's2.choiceStayS2': 'Continua a usare il sistema S2',
  's2.choiceStayS2Note': 'Continua a usare il tuo sistema S2 come fai ora. Non serve fare nulla.',
  's2.choiceS2': 'Passare a S2',
  's2.choiceS2Note':
    'Aggiornare via software tutti gli speaker S1 idonei a S2 e acquistare '
    + 'nuovi dispositivi in sostituzione di quelli che non possono compiere '
    + 'il passo.',
  's2.choiceS21': 'Passare a S2.1',
  's2.choiceS21Note':
    'Acquistare nuovi dispositivi in sostituzione di tutti quelli Sonos non '
    + 'compatibili con S2.1. L’opzione senza badare a spese, a prova di '
    + 'futuro.',
  's2.choiceFree': 'Niente da comprare',
  's2.colBuy': 'Azione',
  's2.buyNow': 'Acquista',
  's2.updateNow': 'Aggiorna ora',
}
