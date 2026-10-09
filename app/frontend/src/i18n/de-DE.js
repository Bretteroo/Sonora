// German (de-DE). The keys mirror en-US.js, the reference catalog; a key
// missing here is looked for along this locale's fallback chain in locales.js,
// then in en-US.js.
//
// Placeholders are written {name} and substituted at render time. Counts that
// change the wording carry .one and .other keys (see en-US.js).

export default {

  // --- shared ------------------------------------------------------------
  'common.theme': 'Design',
  'common.language': 'Sprache',
  'common.back': 'Zurück',
  'common.cancel': 'Abbrechen',
  'common.save': 'Speichern',
  'common.submit': 'Senden',
  'common.apply': 'Übernehmen',
  'common.appearance': 'Erscheinungsbild',
  'common.appearanceLight': 'Hell',
  'common.appearanceDark': 'Dunkel',
  'common.appearanceSystem': 'System',
  'common.done': 'Fertig',
  'common.close': 'Schließen',
  'common.explicit': 'Explizit',
  'common.restricted': 'Eingeschränkt',
  'common.dismiss': 'Ausblenden',
  'common.settings': 'Einstellungen',
  'common.search': 'Suchen',
  'common.queue': 'Warteschlange',
  'common.play': 'Wiedergabe',
  'common.pause': 'Pause',
  'common.stop': 'Stopp',
  'common.next': 'Weiter',
  'common.previous': 'Zurück',
  'common.shuffle': 'Zufallswiedergabe',
  'common.repeat': 'Wiederholen',
  'common.mute': 'Stummschalten',
  'common.unmute': 'Stummschaltung aufheben',
  'common.viewAll': 'Alle anzeigen',
  'common.reconnecting': 'Verbindung wird wiederhergestellt',
  'desk.lc.noNetwork': 'Du musst mit einem kabelgebundenen oder drahtlosen Netzwerk verbunden sein, um Sonora zu verwenden. Überprüfe deine Netzwerkeinstellungen.',
  'desk.lc.noSonora': 'Diese Seite hat die Verbindung zu Sonora verloren. Sie verbindet sich von selbst wieder, sobald Sonora antwortet.',
  'local.room': 'Dieser Browser',
  'local.cannotGroup.title': 'Dieser Browser kann nicht gruppiert werden',
  'local.cannotGroup.detail':
    'Beim Gruppieren laufen die Lautsprecher über ihr eigenes Netzwerk auf '
    + 'einer gemeinsamen Uhr. Ein Browser hat daran keinen Anteil und spielt '
    + 'deshalb für sich allein.',
  'local.cannotPlay.title': 'Dieser Browser kann das nicht wiedergeben',
  'local.cannotPlay.needsSpeaker':
    'Nur ein Lautsprecher kann es abrufen: Ein Musikdienst übergibt seinen '
    + 'Stream an das System, und eine Musikbibliothek-Freigabe wird von den '
    + 'Playern eingebunden. Internetradio läuft hier.',
  'local.cannotPlay.unknown':
    'Sonora weiß nicht, wie diese Quelle in einem Browser abzuspielen ist. '
    + 'Internetradio läuft hier.',
  'local.cannotPlay.needsQueue':
    'Ein Album, eine Playlist oder eine Warteschlange ist eine Titelliste, '
    + 'und diese Liste gehört dem Lautsprecher, der sie abspielt. Wähle hier '
    + 'einen einzelnen Titel oder einen Sender.',
  'local.cannotPlay.needsLink':
    'Sonora durchsucht {service} über die Lautsprecher und hat keine eigene '
    + 'Anmeldung, um dort einen Stream anzufordern. Verknüpfe den Dienst mit '
    + 'Sonora, dann läuft er auch hier.',
  'local.cannotPlay.serviceRefused':
    '{service} erlaubt Sonora nicht, dies außerhalb des Sonos-Ökosystems zu '
    + 'streamen. Versuche, es direkt an einen Sonos-Player zu streamen.',
  'local.cannotPlay.protected':
    '{service} erlaubt Sonora nicht, dies außerhalb des Sonos-Ökosystems zu '
    + 'streamen. Versuche, es direkt an einen Sonos-Player zu streamen.',
  'local.cannotDo.title': 'Das kann nur ein Lautsprecher',
  'local.cannotDo.detail':
    'Dieser Browser ist ein Ausgang, kein Player: kein Equalizer, keine '
    + 'Statusleuchte, keine Warteschlange und kein Stereopaar. Lautstärke, '
    + 'Wiedergabe und Pause funktionieren.',
  'common.rooms.one': '{count} Raum',
  'common.rooms.other': '{count} Räume',
  'common.speakers.one': '{count} Lautsprecher',
  'common.speakers.other': '{count} Lautsprecher',
  'common.groups.one': '{count} Gruppe',
  'common.groups.other': '{count} Gruppen',
  'common.items.one': '{count} Element',
  'common.items.other': '{count} Elemente',
  'common.tracks.one': '{count} Titel',
  'common.tracks.other': '{count} Titel',
  'common.noResults': 'Keine Ergebnisse',
  'common.offline': 'offline',
  'common.system': '{generation}-System',

  // --- start-up and failure states ---------------------------------------
  'splash.loading.title': 'Lautsprecher werden gesucht',
  'splash.loading.detail':
    'Eine Suchanfrage wird gesendet, und der erste Lautsprecher, der '
    + 'antwortet, wird nach dem übrigen System gefragt.',
  'splash.empty.title': 'Keine Lautsprecher gefunden',
  'splash.empty.detail':
    'Die Suche läuft über Multicast: Der Rechner, auf dem dieser Controller '
    + 'läuft, muss im selben Netzwerk sein wie die Lautsprecher, nicht in '
    + 'einem Gastnetz oder einem anderen VLAN.',
  'splash.error.title': 'Controller nicht erreichbar',
  'splash.error.detail':
    'Das Backend hat nicht geantwortet. Prüfe, ob es läuft.',
  'splash.searchAgain': 'Erneut suchen',
  'splash.crash.title': 'Dieses Design funktioniert nicht mehr',
  'splash.crash.detail': 'Beim Darstellen ist etwas schiefgegangen. Laden Sie die Seite neu oder wählen Sie unten ein anderes Design.',
  'splash.reload': 'Neu laden',
  'rating.cannotUndo': '{service} bietet keine Möglichkeit, das rückgängig zu machen',
  'splash.connected': 'Mit dem Controller verbunden',
  'splash.notConnected': 'Nicht verbunden',

  // --- notices ------------------------------------------------------------
  'notice.conflict.title': 'Der Lautsprecher hat abgelehnt',
  'notice.skipLimit.title': 'Überspringlimit erreicht',
  'notice.skipLimit.body': 'Du hast das Überspringlimit für diesen Sender erreicht. Versuch es später noch einmal.',
  'notice.silent.title': 'Der Lautsprecher hat nicht geantwortet',
  'notice.silent.body':
    '{room} hat einen Moment lang nicht geantwortet. Meist meldet er sich '
    + 'von selbst zurück; versuche es in ein paar Sekunden noch einmal.',
  'notice.error.title': 'Etwas ist schiefgelaufen',
  'notice.network.title': 'Netzwerkfehler',

  // --- what a room is doing ----------------------------------------------
  'search.category.artists': 'Interpreten',
  'search.category.albums': 'Alben',
  'search.category.tracks': 'Titel',
  'search.category.playlists': 'Playlists',
  'search.category.stations': 'Sender',
  'search.category.genres': 'Genres',
  'search.category.podcasts': 'Podcasts & Sendungen',
  'search.category.shows': 'Podcasts & Sendungen',
  'search.category.audiobooks': 'Hörbücher',
  'search.category.people': 'Personen',
  'search.category.episodes': 'Folgen',
  'search.category.hosts': 'Moderatoren',
  'source.queue': 'Warteschlange',
  'source.grouped': 'Gruppiert',
  'source.line_in': 'Line-In',
  'source.radio': 'Radio',
  'source.service_stream': 'Radio',
  'source.service_radio': 'Radio',
  'source.service_hls': 'Radio',
  'source.service_track': 'Streamingdienst',
  'source.service_container': 'Streamingdienst',
  'source.library_track': 'Musikbibliothek',
  'source.http_stream': 'Netzwerk-Stream',
  'source.external_session': 'AirPlay oder Spotify Connect',
  'source.tv': 'TV',
  'source.playlist': 'Playlist',
  'source.idle': 'Inaktiv',
  'source.unknown': 'Unbekannte Quelle',

  // --- web theme ----------------------------------------------------------
  'common.noMusicSelected': 'Keine Musik ausgewählt',
  'common.queueIsEmpty': 'Die Warteschlange ist leer',
  'common.roomsGrouped': '{count} Räume gruppiert',
  'common.groupLabel': '{room} + {count}',
  'common.nothingQueued': 'Nichts in der Warteschlange',
  'common.setActive': '{room} aktivieren',
  'common.openQueue': 'Warteschlange öffnen',
  'common.seek': 'Im Titel navigieren',
  'common.live': 'Live',
  'common.tv': 'TV',
  'desk.browse.lineIn': 'Line-In',
  'desk.browse.noSelections': 'Keine Auswahl verfügbar.',
  'desk.browse.lineInNone':
    'Um Line-In zu nutzen, schließe ein Gerät an ein Sonos-Produkt mit '
    + 'Line-In an.',
  'common.kind.playlist': 'Playlist',
  'common.kind.album': 'Album',

  // grouping

  // queue

  // settings
  'net.connection': 'Verbindung',
  'net.live': 'live',
  'net.rescan': 'Netzwerk erneut durchsuchen',

  // a service's own page
  'services.needsAccount':
    '{service} zeigt ohne das Anmeldetoken deines Kontos nichts an. Dieses '
    + 'Token liegt bei den Lautsprechern und wird nie im Netzwerk '
    + 'preisgegeben, deshalb lässt sich der Katalog hier nicht durchsuchen. '
    + 'Was daraus in Sonos-Favoriten oder Sonos-Playlists gespeichert ist, '
    + 'läuft weiterhin.',

  // --- Sonos account, network check and TV audio, used across themes -------
  'account.title': 'Sonos-Konto',
  'account.blurb': 'Deine bereits eingerichteten Lautsprecher geben Sonora alles, was es für die alltägliche Steuerung deines Sonos-Systems braucht.',
  'account.optional': 'Die Anmeldung bei deinem Sonos-Konto ist optional. Sie zeigt die vollständige Liste der in deinem System eingerichteten Musikdienste mit ihren Logos, alle verfügbaren Sonos-Labs-Dienste und den Namen des TV-Eingangs, den eine Soundbar gerade wiedergibt.',
  'account.signIn': 'Anmelden',
  'account.signOut': 'Abmelden',
  'account.signingIn': 'Anmeldung läuft…',
  'account.email': 'E-Mail',
  'account.password': 'Passwort',
  'account.signedInAs': 'Angemeldet als: {email}',
  'account.notSignedIn': 'nicht angemeldet',
  'net.scanning': 'Netzwerk wird durchsucht…',
  'net.scanDone': '{rooms} in {systems} gefunden',
  'common.systems.one': '{count} System',
  'common.systems.other': '{count} Systeme',
  'source.noSignal': 'Kein Signal',
  'desk.now.tvInput': 'Eingang',
  'desk.now.tvFormat': 'Format',
  'tvFormat.0': 'Kein Eingang verbunden',
  'tvFormat.2': 'Stereo',
  'tvFormat.7': 'Dolby 2.0',
  'tvFormat.18': 'Dolby 5.1',
  'tvFormat.21': 'Kein Eingang',
  'tvFormat.22': 'Kein Ton',
  'tvFormat.59': 'Dolby Atmos (DD+)',
  'tvFormat.61': 'Dolby Atmos (TrueHD)',
  'tvFormat.63': 'Dolby Atmos (MAT 2.0)',
  'tvFormat.33554434': 'PCM 2.0',
  'tvFormat.33554454': 'PCM 2.0 ohne Ton',
  'tvFormat.33554488': 'Dolby 2.0',
  'tvFormat.33554490': 'Dolby Digital Plus 2.0',
  'tvFormat.33554492': 'Dolby TrueHD 2.0',
  'tvFormat.33554494': 'Dolby Mehrkanal-PCM 2.0',
  'tvFormat.84934658': 'Mehrkanal-PCM 5.1',
  'tvFormat.84934713': 'Dolby 5.1',
  'tvFormat.84934714': 'Dolby Digital Plus 5.1',
  'tvFormat.84934716': 'Dolby TrueHD 5.1',
  'tvFormat.84934718': 'Dolby Mehrkanal-PCM 5.1',
  'tvFormat.84934721': 'DTS 5.1',
  'tvFormat.118489090': 'Mehrkanal-PCM 7.1',
  'tvFormat.118489146': 'Dolby Digital Plus 7.1',
  'tvFormat.118489148': 'Dolby TrueHD 7.1',

  // --- Sonos macOS Desktop theme ------------------------------------------------
  'desk.menu.edit': 'Bearbeiten',
  'desk.menu.view': 'Ansicht',
  'desk.menu.manage': 'Verwalten',
  'desk.menu.help': 'Hilfe',
  'desk.menu.preferences': 'Einstellungen…',
  'desk.menu.checkUpdates': 'Nach Updates suchen…',
  'desk.menu.cut': 'Ausschneiden',
  'desk.menu.copy': 'Kopieren',
  'desk.menu.paste': 'Einfügen',
  'desk.menu.mainWindow': 'Sonos Controller',
  'desk.menu.miniController': 'Mini-Controller',
  'desk.menu.musicLibrarySettings': 'Einstellungen der Musikbibliothek…',
  'desk.menu.serviceSettings': 'Diensteinstellungen…',
  'desk.menu.addRadioStation': 'Radiosender hinzufügen…',
  'desk.radio.myShows': 'Meine Radiosendungen',
  'desk.radio.changeLocation': 'Ort ändern',
  'desk.radio.enterZip': 'Postleitzahl eingeben',
  'desk.radio.zipBody': 'Bitte gib deine Postleitzahl ein:',
  'desk.radio.pickCity': 'Stadt auswählen',
  'desk.radio.locationSet': 'Lokales Radio ist jetzt {city}.',
  'desk.radio.localRadio': 'Lokales Radio',
  'desk.radio.localRadioIn': 'Lokales Radio ({city})',
  'desk.radio.myStations': 'Meine Radiosender',
  'desk.radio.addNew': 'Neuen Radiosender hinzufügen',
  'desk.playlists.new': 'Neue Playlist',
  'desk.playlists.addTitle': 'Titel zur Playlist hinzufügen',
  'desk.playlists.removeSong': 'Titel entfernen',
  'desk.playlists.removedSong': '{title} wurde aus der Playlist entfernt.',
  'desk.playlists.added': '{title} wurde zu {playlist} hinzugefügt.',
  'desk.playlists.addedMany':
    '{count} Titel wurden zu {playlist} hinzugefügt.',
  'desk.playlists.nameTitle': 'Diese Playlist benennen',
  'desk.playlists.nameBody': 'Benenne diese Playlist:',
  'desk.playlists.rename': 'Playlist umbenennen',
  'desk.playlists.renameBody': 'Gib einen neuen Namen für diese Playlist ein:',
  'desk.playlists.delete': 'Playlist löschen',
  'desk.playlists.deleted': '„{title}“ wurde gelöscht.',
  'desk.queue.editedTitle': 'Die Warteschlange wurde bearbeitet',
  'desk.queue.editedBody': 'Diese Wiedergabe ersetzt die Warteschlange.',
  'desk.queue.playAnyway': 'Trotzdem abspielen',
  'desk.radio.title': 'Radiosender hinzufügen',
  'desk.radio.intro': 'Gib die Daten des neuen Radiosenders ein.',
  'desk.radio.where':
    'Der neue Sender wird unter TuneIn > Meine Radiosender abgelegt.',
  'desk.radio.url': 'Streaming-URL',
  'desk.radio.name': 'Sendername',
  'desk.radio.added': '„{title}“ wurde zu Meine Radiosender hinzugefügt.',
  'desk.radio.exists': '„{title}“ ist bereits in Meine Radiosender.',
  'desk.menu.updateLibrary': 'Musikbibliothek jetzt aktualisieren',
  'desk.menu.systemHelp': 'Hilfe zum Sonos-System',
  'desk.menu.supportSite': 'Website des technischen Supports',
  'desk.menu.submitDiagnostics': 'Diagnose senden',
  'desk.menu.about': 'Über mein Sonos-System',
  'desk.menu.disabledNote':
    'Ausgegraute Einträge gibt es nur in der Sonos-App.',
  'desk.transport.groupVolume': 'Gruppenlautstärke',
  'desk.transport.back30': '30 Sekunden zurück',
  'desk.transport.forward30': '30 Sekunden vor',
  'desk.transport.repeatOff': 'Wiederholen aus',
  'desk.transport.repeatOne': 'Titel wiederholen',
  'desk.transport.repeatAll': 'Alle wiederholen',
  'desk.transport.crossfade': 'Überblenden',
  'desk.rooms.title': 'Räume',
  'desk.rooms.system': 'System',
  'desk.rooms.pauseAll': 'Alle pausieren',
  'desk.rooms.pause': 'Pause',
  'desk.rooms.confirmPauseAll':
    'Möchtest du die Musik wirklich in allen Räumen pausieren?',
  'desk.rooms.playGroup': 'Gruppe abspielen',
  'desk.rooms.pauseGroup': 'Gruppe pausieren',
  'desk.rooms.stopGroup': 'Gruppe stoppen',
  'desk.rooms.offline': 'Offline',
  'desk.rooms.batteryLevel': '{level} %',
  'desk.rooms.battery': 'Akku {level} %',
  'desk.rooms.batteryCharging': 'Akku {level} %, wird geladen',
  'desk.now.title': 'Aktuelle Wiedergabe',
  'desk.now.next': 'Weiter',
  'desk.now.noMusic': '[Keine Musik ausgewählt]',
  'desk.now.episode': 'Folge',
  'desk.now.podcast': 'Podcast',
  'desk.now.releaseDate': 'Erscheinungsdatum',
  'desk.now.chapter': 'Kapitel',
  'desk.now.author': 'Autor',
  'desk.now.narrator': 'Sprecher',
  'desk.now.book': 'Buch',
  'desk.now.station': 'Sender',
  'desk.now.onNow': 'Jetzt auf Sendung',
  'desk.now.information': 'Informationen',
  'desk.now.zp.connecting': 'Verbinden...',
  'desk.now.zp.buffering': 'Wird gestartet...',
  'desk.now.zp.starting': 'Wird gestartet...',
  'desk.now.artist': 'Interpret',
  'desk.now.album': 'Album',
  'desk.now.song': 'Titel [{n}/{total}]',
  'desk.now.songLabel': 'Titel',
  'desk.now.infoOptions': 'Info & Optionen',
  'desk.now.thumbsUp': 'Gefällt mir',
  'desk.now.thumbsDown': 'Gefällt mir nicht',
  'desk.info.source': 'Quelle',
  'desk.info.room': 'Raum',
  'desk.info.duration': 'Dauer',
  'desk.info.station': 'Sender',
  'desk.info.addMyStations': 'Zu Meine Radiosender hinzufügen',
  'desk.info.removeMyStations': 'Aus Meine Radiosender entfernen',
  'desk.radio.removedMine': '{title} aus Meine Radiosender entfernt',
  'desk.info.addMyShows': 'Zu Meine Radiosendungen hinzufügen',
  'desk.radio.addedMine': '{title} wurde zu Meine Radiosender hinzugefügt',
  'desk.radio.addedShow': '{title} wurde zu Meine Radiosendungen hinzugefügt',
  'desk.radio.alreadyShow': '{title} ist bereits in Meine Radiosendungen',
  'desk.radio.alreadyMine': '{title} ist bereits in Meine Radiosender',
  'desk.info.startRadio': 'Radio starten',
  'desk.info.addToServicePlaylist': 'Titel zu {service}-Playlist hinzufügen',
  'desk.info.saveToMusic': 'In Meine Musik speichern',
  'desk.info.addSongFavorite': 'Titel zu Sonos-Favoriten hinzufügen',
  'desk.info.removeFavorite': 'Aus Sonos-Favoriten entfernen',
  'desk.info.removedFavorite':
    '{title} wurde aus den Sonos-Favoriten entfernt',
  'desk.info.albumInfo': 'Albuminfo',
  'desk.info.artistInfo': 'Interpreteninfo',
  'desk.info.podcastInfo': 'Podcast-Info',
  'desk.info.provider': 'Anbieter',
  'desk.info.addEpisodeFavorite': 'Folge zu Sonos-Favoriten hinzufügen',
  'desk.info.addEpisodePlaylist': 'Folge zu Sonos-Playlist hinzufügen',
  'desk.info.actionDone': 'Fertig.',
  'desk.info.actionFailed': 'Der Dienst hat die Anfrage abgelehnt.',
  'desk.info.viewAllSongs': 'Alle Titel des Albums anzeigen',
  'desk.info.addAlbumFavorite': 'Album zu Sonos-Favoriten hinzufügen',
  'desk.info.addBookFavorite': 'Buch zu Sonos-Favoriten hinzufügen',
  'desk.info.addAlbumPlaylist': 'Album zu Sonos-Playlist hinzufügen',
  'desk.info.addToSonosPlaylist': 'Titel zu Sonos-Playlist hinzufügen',
  'desk.info.addStationFavorite': 'Sender zu Sonos-Favoriten hinzufügen',
  'desk.info.addedFavorite':
    '„{title}“ wurde zu den Sonos-Favoriten hinzugefügt.',
  'desk.info.alreadyFavorite': '„{title}“ ist bereits in den Sonos-Favoriten.',
  'desk.queue.title': 'Warteschlange',
  'desk.queue.notInUse': '(Nicht in Gebrauch)',
  'desk.queue.collapse': 'Aktuelle Wiedergabe anzeigen',
  'desk.queue.expand': 'Warteschlange aufklappen',
  'desk.queue.songs.one': '{count} Titel',
  'desk.queue.songs.other': '{count} Titel',
  'desk.queue.empty': 'Die Warteschlange ist leer',
  'win.queue.empty': 'Die Warteschlange ist leer.',
  'win.queue.confirmTitle': 'Bestätigen',
  'win.queue.confirmClear': 'Möchtest du die Warteschlange wirklich leeren?',
  'win.queue.clearAction': 'Leeren',
  'desk.queue.clear': 'Warteschlange leeren',
  'desk.queue.save': 'Warteschlange speichern',
  'desk.queue.confirmClear': 'Warteschlange leeren',
  'desk.queue.playSong': 'Titel abspielen',
  'desk.queue.removeSong': 'Titel entfernen',
  'desk.queue.playEpisode': 'Folge abspielen',
  'desk.queue.removeEpisode': 'Folge entfernen',
  'desk.queue.playTrack': 'Titel {n} abspielen',
  'desk.browse.root': 'Musikquelle auswählen',
  'desk.browse.music': 'Musik',
  'desk.browse.favorites': 'Sonos-Favoriten',
  'desk.browse.updateNow': 'Jetzt aktualisieren',
  'desk.update.title': 'Update verfügbar',
  'desk.update.body': 'Für deine Sonos-Lautsprecher ist ein Update bereit: Version {version}. Während der Installation stoppt die Musik in jedem Raum; das kann einige Minuten dauern.',
  'desk.update.bodySystem': 'Für deine Sonos-{system}-Lautsprecher ist ein Update bereit: Version {version}. Während der Installation stoppt die Musik in jedem Raum; das kann einige Minuten dauern.',
  'desk.update.start': 'Aktualisieren',
  'desk.update.notNow': 'Nicht jetzt',
  'desk.update.started': 'Das Update hat begonnen. Jeder Raum startet neu, sobald er fertig ist.',
  'desk.browse.library': 'Musikbibliothek',
  'desk.browse.playlists': 'Sonos-Playlists',
  'desk.browse.radio': 'TuneIn',
  'desk.browse.addServices': 'Musikdienste hinzufügen',
  'desk.browse.addServicesFor': '{gen}-Musikdienste hinzufügen',
  'desk.browse.switchAccount': 'Konto wechseln',
  'desk.browse.sleepTimer': 'Einschlaf-Timer',
  'desk.browse.alarms': 'Wecker',
  'desk.browse.results': 'Ergebnisse: {query}',
  'desk.search.in': 'In {service} suchen',
  'desk.search.clear': 'Suche löschen',
  'desk.search.recent': 'Letzte Suchanfragen',
  'desk.search.clearRecent': 'Letzte Suchanfragen löschen',
  'desk.search.scope': 'Suchbereich wählen',
  'desk.browse.noResults':
    'Die Suche nach „{query}“ ergab keine Treffer. Versuche eine andere '
    + 'Kategorie oder einen neuen Suchbegriff.',
  'desk.browse.selectRoom': 'Wähle einen Raum, um Musik dafür zu durchsuchen.',
  'desk.browse.loading': 'Wird geladen…',
  'desk.browse.empty': 'Keine Auswahl verfügbar.',
  'desk.browse.unableToBrowse': 'Musik kann nicht durchsucht werden',
  'desk.browse.actions': 'Weitere Optionen',
  'desk.browse.select': 'Auswählen',
  'desk.browse.needsLink.body':
    '{service} ist mit deinem Sonos-{gen}-System verknüpft.\nWenn du '
    + '{service} durchsuchen und steuern möchtest, musst du den Dienst auch '
    + 'mit Sonora verknüpfen. Das ist eine eigene Anmeldung und lässt deine '
    + 'Sonos-App unberührt.',
  'desk.browse.needsLink.action': '{service} mit Sonora verknüpfen',
  'desk.actions.playNow': 'Jetzt abspielen',
  'desk.actions.playNext': 'Als Nächstes abspielen',
  'desk.actions.addToQueue': 'Ans Ende der Warteschlange',
  'desk.actions.addFavorite': 'Zu Sonos-Favoriten hinzufügen',
  'desk.actions.unselectAll': 'Auswahl aufheben',
  'desk.actions.replaceQueue': 'Warteschlange ersetzen',
  'desk.favorites.addToSonosPlaylist': 'Zu Sonos-Playlist hinzufügen',
  'desk.favorites.addToServicePlaylist': 'Zu {service}-Playlist hinzufügen',
  'desk.favorites.rename': 'Sonos-Favorit umbenennen',
  'desk.favorites.remove': 'Aus Sonos-Favoriten entfernen',
  'desk.favorites.renameBody':
    'Gib einen neuen Namen für diesen Sonos-Favoriten ein:',
  'desk.favorites.removed':
    '„{title}“ wurde aus den Sonos-Favoriten entfernt.',
  'common.ok': 'OK',
  'desk.grouping.title': 'Räume gruppieren',
  'desk.grouping.willPlay': 'Die ausgewählten Räume spielen:',
  'desk.grouping.select': 'Räume für Gruppierung auswählen:',
  'desk.grouping.partyMode': 'Alle auswählen – Partymodus',
  'desk.grouping.noMusic': '[keine Musik]',
  'desk.grouping.chooseMusic': 'Klicke auf Fertig, um Musik zu wählen',
  'desk.grouping.pickTitle': 'Musik wählen',
  'desk.grouping.pickHeading': 'Wähle die Musik für den ausgewählten Raum',
  'desk.grouping.unselectAll': 'Auswahl aufheben',
  'desk.grouping.noneTitle': 'Keine Räume ausgewählt',
  'desk.grouping.noneBody': 'Dadurch wird jegliche Musik gestoppt, die gerade läuft. Möchtest du fortfahren?',
  'desk.grouping.noneYes': 'Ja',
  'desk.prefs.title': 'Einstellungen',
  'desk.prefs.general': 'Allgemein',
  'desk.prefs.basic': 'Basis',
  'desk.prefs.themeShot': 'Eine Vorschau des Designs {theme}',
  'desk.prefs.themeNoShot': 'Keine Vorschau für dieses Design.',
  'desk.prefs.themeVersion': 'Version {version}',
  'desk.prefs.themeInstalled': 'installiert',
  'desk.prefs.manageThemes': 'Designs verwalten',
  'desk.prefs.themeUpload': 'Design installieren…',
  'desk.prefs.themeDelete': 'Design löschen',
  'desk.prefs.themeBuiltIn':
    'Designs, die mit Sonora geliefert werden, lassen sich nicht löschen.',
  'desk.room.nightSound': 'Nachtmodus',
  'desk.room.speech': 'Sprachverbesserung',
  'desk.room.sub': 'Sub',
  'desk.room.subLevel': 'Sub-Pegel',
  'desk.room.surround': 'Surround',
  'desk.room.surroundLevel': 'TV-Pegel',
  'desk.room.musicSurroundLevel': 'Musikpegel',
  'desk.room.audioDelay': 'Audioverzögerung (Lippensynchronität)',
  'desk.room.heightLevel': 'Höhenkanal-Pegel',
  'desk.room.lineInName': 'Name der Line-In-Quelle',
  'desk.room.lineInLevel': 'Pegel der Line-In-Quelle',
  'desk.room.autoplayRoom': 'Autoplay-Raum',
  'desk.room.autoplayOff': 'Aus',
  'desk.room.autoplayLinked': 'Gruppierte Räume einbeziehen',
  'desk.room.autoplayUseVolume': 'Autoplay-Lautstärke verwenden',
  'desk.room.autoplayVolume': 'Autoplay-Lautstärke',
  'desk.room.speechLevel': 'Stufe der Sprachverbesserung',
  'desk.room.levelLow': 'Niedrig',
  'desk.room.levelMedium': 'Mittel',
  'desk.room.levelHigh': 'Hoch',
  'desk.room.levelMax': 'Max.',
  'desk.room.tvAutoplay': 'TV-Autoplay',
  'desk.room.tvUngroup': 'Gruppierung bei Autoplay aufheben',
  'desk.room.irLight': 'IR-Signalleuchte',
  'desk.room.irRepeater': 'IR-Repeater',
  'desk.room.touchControls': 'Touch-Steuerung',
  'desk.room.trueplay': 'Trueplay',
  'desk.room.surroundDistanceLeft': 'Abstand linker Surround',
  'desk.room.surroundDistanceRight': 'Abstand rechter Surround',
  'desk.room.distanceFar': 'Mehr als 3 m',
  'desk.room.distanceMid': '0,6 bis 3 m',
  'desk.room.distanceNear': 'Weniger als 0,6 m',
  'desk.room.subPhase': 'Sub-Phase',
  'desk.room.stereoPair': 'Stereopaar',
  'desk.room.separate': 'Stereopaar trennen',
  'desk.room.separateBody':
    'Das Stereopaar „{room}“ wieder in zwei Räume trennen? Die Wiedergabe '
    + 'stoppt, während sich die Lautsprecher neu formieren.',
  'desk.room.pairWith': 'Rechten Lautsprecher wählen…',
  'desk.room.createPair': 'Stereopaar erstellen',
  'desk.room.pairBody':
    '„{left}“ zum linken und „{right}“ zum rechten Kanal eines Stereopaars '
    + 'machen? Das Paar behält den Namen „{left}“; die Wiedergabe stoppt, '
    + 'während sich die Lautsprecher neu formieren.',
  'desk.rooms.showMore': '{n} weitere anzeigen…',
  'desk.rooms.showLess': 'Weniger anzeigen…',
  'desk.rooms.allSystems': 'Alle',
  'desk.rooms.menu.play': '{name} abspielen',
  'desk.rooms.menu.pause': '{name} pausieren',
  'desk.rooms.menu.stop': '{name} stoppen',
  'desk.rooms.menu.mute': '{name} stummschalten',
  'desk.rooms.menu.unmute': 'Stummschaltung von {name} aufheben',
  'desk.rooms.menu.eq': '{name}-EQ…',
  'desk.rooms.menu.group': 'Gruppieren',
  'desk.prefs.musicLibrary': 'Einstellungen der Musikbibliothek',
  'desk.prefs.services': 'Diensteinstellungen',
  'desk.prefs.parental': 'Kindersicherung',
  'desk.prefs.dateTime': 'Datum- und Uhrzeiteinstellungen',
  // The Mac Preferences window (S1 57.x on Tahoe, 2026-09-15).
  'desk.prefs.eqSettings': 'EQ-Einstellungen',
  'desk.prefs.musicLibraryShort': 'Musikbibliothek',
  'desk.prefs.servicesShort': 'Dienste',
  'desk.prefs.dateTimeShort': 'Datum und Uhrzeit',
  'desk.prefs.sonora': 'Sonora',
  'desk.prefs.mobileNote':
    'Öffne die Sonos-App auf einem Mobilgerät, um dein System zu verwalten.',
  'desk.prefs.getMobileApp': 'Mobile App holen',
  'desk.prefs.eqFor': 'Musik-EQ-Einstellungen für',
  'desk.prefs.eqCaption': 'Stelle Höhen und Bässe nach deinem Geschmack ein.',
  'desk.prefs.roomFor': 'Raumeinstellungen für',
  'desk.prefs.noRooms': 'Es wurden keine Sonos-Räume gefunden.',
  'desk.prefs.folderCol': 'Ordner',
  'desk.prefs.pathCol': 'Pfad',
  'desk.prefs.serviceNameCol': 'Dienstname',
  'desk.prefs.nameCol': 'Name',
  'desk.prefs.loginCol': 'Kontoanmeldung',
  'desk.prefs.anonymous': '<Anonym>',
  'desk.prefs.changeName': 'Namen ändern',
  'desk.prefs.reauthorize': 'Account erneut autorisieren',
  'desk.prefs.visitLabs': 'Sonos Labs besuchen',
  'desk.menu.settings': 'Einstellungen…',
  // The Mac app's sheets and About window (2026-09-15).
  'desk.queue.confirmTitle': 'Bestätigen',
  'desk.queue.clearBody': 'Möchtest du die Warteschlange wirklich leeren?',
  'desk.queue.enterName': 'Gib einen neuen Playlist-Namen ein:',
  'desk.queue.orReplace':
    'Oder wähle eine vorhandene Sonos-Playlist zum Ersetzen:',
  'desk.sleep.setFor': 'Einschlaf-Timer für „{room}“ stellen:',
  'desk.about.sonosOs': 'Sonos OS',
  'desk.about.products': 'Produkte',
  'desk.about.systemLine': 'Sonos OS {gen}: {count} Produkte',
  'desk.about.serial': 'Seriennummer',
  'desk.about.hardware': 'Hardware-Version',
  'desk.about.series': 'Serien-ID',
  'desk.about.ip': 'IP-Adresse',
  'desk.about.wm': 'WM',
  'desk.about.copy': 'Kopieren',
  'desk.about.copied': 'Kopiert',
  'desk.alarms.note':
    'Wecker werden in der Sonos-App erstellt und bearbeitet; hier lassen '
    + 'sie sich ein- und ausschalten sowie löschen.',
  'desk.alarms.deleteBody': 'Den Wecker um {time} in {room} löschen?',
  'desk.alarms.deleteTitle': 'Wecker löschen',
  'desk.alarms.recurrence.WEEKENDS': 'Wochenenden',
  'desk.alarms.recurrence.WEEKDAYS': 'Wochentags',
  'desk.alarms.recurrence.DAILY': 'Täglich',
  'desk.alarms.recurrence.ONCE': 'Einmal',
  'desk.alarms.repeat': 'Wiederholen',
  'desk.alarms.room': 'Raum',
  'desk.alarms.time': 'Zeit',
  'desk.alarms.enabled': 'Ein',
  'desk.alarms.delete': 'Löschen',
  'desk.alarms.none': 'Keine Wecker auf diesem System.',
  'win.saveQueue.name': 'Gib einen neuen Playlist-Namen ein:',
  'win.saveQueue.replace':
    'Oder wähle eine vorhandene Sonos-Playlist zum Ersetzen:',
  'win.alarm.addTitle': 'Wecker hinzufügen',
  'win.alarm.editTitle': 'Wecker bearbeiten',
  'win.alarm.alarm': 'Wecker',
  'win.alarm.on': 'Ein',
  'win.alarm.off': 'Aus',
  'win.alarm.music': 'Musik',
  'win.alarm.select': 'Auswählen…',
  'win.alarm.schedule': 'Zeitplan',
  'win.alarm.onceOnly': 'Nur einmal',
  'win.alarm.volume': 'Lautstärke',
  'win.alarm.duration': 'Dauer',
  'win.alarm.noLimit': 'Kein Limit',
  'win.alarm.linked': 'Gruppierte Räume einbeziehen',
  'win.alarm.shuffle': 'Musik zufällig wiedergeben',
  'win.alarm.chime': 'Sonos-Klang',
  'win.alarm.browseTitle': 'Weckmusik durchsuchen',
  'win.alarm.alarmMusic': 'Weckmusik',
  'win.alarm.importedPlaylists': 'Importierte Playlists',
  'win.alarm.setMusic': 'Weckmusik festlegen',
  'win.alarm.day.1': 'Montag',
  'win.alarm.day.2': 'Dienstag',
  'win.alarm.day.3': 'Mittwoch',
  'win.alarm.day.4': 'Donnerstag',
  'win.alarm.day.5': 'Freitag',
  'win.alarm.day.6': 'Samstag',
  'win.alarm.day.0': 'Sonntag',
  'win.alarms.manage': 'Sonos-Wecker verwalten',
  'win.alarms.currentTime': 'Aktuelle Zeit: {time}',
  'desk.alarms.currentTime': 'Aktuelle Uhrzeit: {date} - {time} {zone}',
  'win.alarms.where': 'Wo',
  'win.alarms.when': 'Wann',
  'win.alarms.on': 'EIN',
  'win.alarms.add': 'Hinzufügen',
  'win.alarms.edit': 'Bearbeiten',
  'win.alarms.remove': 'Entfernen',
  'win.alarms.deleteConfirm': 'Möchtest du diesen Wecker wirklich löschen?',
  'win.alarms.help1': 'Hinzufügen',
  'win.alarms.help2': 'Entfernen',
  'desk.alarms.day.0': 'So',
  'desk.alarms.day.1': 'Mo',
  'desk.alarms.day.2': 'Di',
  'desk.alarms.day.3': 'Mi',
  'desk.alarms.day.4': 'Do',
  'desk.alarms.day.5': 'Fr',
  'desk.alarms.day.6': 'Sa',
  'desk.queue.saveHint': 'Playlist-Name',
  'desk.queue.saveBody':
    'Die Warteschlange wird als Sonos-Playlist gespeichert.',
  'desk.queue.saveTitle': 'Warteschlange speichern',
  'desk.queue.mixName': '{weekday}-Mix am {part}',
  'desk.queue.part.morning': 'Morgen',
  'desk.queue.part.afternoon': 'Nachmittag',
  'desk.queue.part.night': 'Abend',
  'desk.sleep.none': 'Kein Einschlaf-Timer gestellt.',
  'desk.sleep.elsewhere': 'Läuft auch anderswo',
  'desk.sleep.remaining': 'Einschlaf-Timer: noch {time}',
  'desk.sleep.minutes': '{count} Minuten',
  'desk.sleep.off': 'Aus',
  'desk.sleep.hours.one': '{count} Stunde',
  'desk.sleep.hours.other': '{count} Stunden',
  'services.needsSignIn':
    '{service} verlangt eine Anmeldung, bevor etwas angezeigt wird. '
    + 'Verknüpfe den Dienst mit Sonora, um ihn hier zu durchsuchen; was '
    + 'daraus in Sonos-Favoriten oder Sonos-Playlists gespeichert ist, läuft '
    + 'weiterhin.',
  'desk.library.folders': 'Ordner',
  'desk.library.advanced': 'Erweitert',
  'desk.library.mine': 'Meine Musikordner auf Sonos',
  'desk.library.none':
    'Diesem Sonos-System wurden noch keine Musikordner hinzugefügt.',
  'desk.library.addFolder': 'Hinzufügen…',
  'desk.library.add': 'Hinzufügen',
  'desk.library.remove': 'Entfernen',
  'desk.library.pathHint': '//nas/Musik',
  'desk.library.pathNote':
    'Sonora fügt Ordner über ihren Netzwerkpfad hinzu (zum Beispiel '
    + '//nas/Musik). Der Ordner muss in deinem Netzwerk bereits freigegeben '
    + 'sein. S1-Player können nur SMBv1-Freigaben nutzen; S2-Player sprechen '
    + 'auch SMBv2 und SMBv3.',
  'desk.shareWizard.windowTitle': 'Sonora-Einrichtung',
  'desk.shareWizard.whereTitle': 'Musikordner hinzufügen',
  'desk.shareWizard.wherePrompt': 'Wo ist die Musik, die du auf Sonos abspielen möchtest?',
  'desk.shareWizard.myMusic': 'Ordner „Musik“',
  'desk.shareWizard.otherFolder': 'Ein anderer Ordner oder ein Laufwerk an meinem Computer',
  'desk.shareWizard.network': 'Netzwerkgerät (z. B. NAS-Laufwerk)',
  'desk.shareWizard.serverNote': 'Sonora läuft auf einem Server, deshalb sind die Ordner auf diesem Computer außer Reichweite: Es kann einen im Netzwerk freigegebenen Ordner hinzufügen.',
  'desk.shareWizard.pathTitle': 'Musik aus deiner Netzwerkfreigabe hinzufügen',
  'desk.shareWizard.pathPrompt': 'Gib den Pfad zu deiner Netzwerkfreigabe ein:',
  'desk.shareWizard.loginTitle': 'Benutzername und Passwort',
  'desk.shareWizard.loginPrompt': 'Gib Benutzername und Passwort für das Netzlaufwerk mit deiner Musik ein. Lass beide leer, wenn die Freigabe keine verlangt.',
  'desk.shareWizard.fieldLabel': '{label}:',
  'desk.shareWizard.adding': 'Freigabeinformationen werden dem Sonos-System hinzugefügt.',
  'desk.shareWizard.done': '„{path}“ ist jetzt in deinem Sonos-System eingerichtet. Die Musik wird der Mediathek hinzugefügt.',
  'desk.shareWizard.failedTitle': 'Sonos konnte den Musikordner nicht hinzufügen',
  'desk.shareWizard.pathExamples': 'Beispiele:\n\\\\MyOtherComputer\\Shared\\Music\n\\\\MyNetworkedStorage\\Shared\\Music',
  'desk.library.username': 'Benutzername',
  'desk.library.password': 'Passwort',
  'desk.library.credHint':
    'Lass beide Felder nur leer, wenn die Freigabe Gäste zulässt. Viele '
    + 'Server tun das nicht mehr.',
  'desk.library.removeTitle': 'Musikordner entfernen',
  'desk.library.removeBody':
    '{folder} aus der Musikbibliothek deines Sonos-Systems entfernen? Die '
    + 'enthaltene Musik erscheint dann nicht mehr in Sonos.',
  'desk.library.indexTitle': 'Bibliotheks-Updates',
  'desk.library.schedule': 'Musikindex täglich aktualisieren um',
  'desk.library.updateNow': 'Musikindex jetzt aktualisieren',
  'desk.library.noFolders': 'Du hast deinem Sonos-System noch keine Musikordner hinzugefügt.',
  'desk.library.addHint': 'Um Musik zu Sonos hinzuzufügen, wähle {link} im Menü {menu}.',
  'desk.library.working':
    'Einstellungen deiner Musikbibliothek werden aktualisiert…',
  'desk.library.indexing': 'Musikbibliothek wird aktualisiert… Bitte warten.',
  'desk.library.indexError':
    'Sonos konnte die Aktualisierung des Musikindex nicht abschließen: '
    + '{error}',
  'desk.library.addPending':
    'Sonos fügt diesen Ordner noch hinzu. Er erscheint hier, sobald die '
    + 'Player ihn eingebunden haben.',
  'desk.library.adding': 'Musikordner wird hinzugefügt',
  'desk.library.addedIndexing':
    'Hinzugefügt. Sonos aktualisiert den Musikindex, was bei einem großen '
    + 'Ordner mehrere Minuten dauern kann.',
  'desk.library.addingPath':
    '{path} — die Player binden ihn gerade ein. Bei einem großen Ordner '
    + 'kann das mehrere Minuten dauern.',
  'desk.library.addFailed':
    'Sonos konnte den Musikordner {path} nicht hinzufügen.',
  'desk.library.addFailedWhy':
    'Prüfe, ob der Pfad zum Ordner und gegebenenfalls Benutzername und '
    + 'Passwort stimmen.',
  'desk.library.addReason': 'Grund: {reason}',
  'desk.library.compilations': 'Alben gruppieren nach',
  'desk.library.updateDaily': 'Inhalte täglich aktualisieren um:',
  'desk.library.showContributing':
    'Mitwirkende Interpreten in der Musikbibliothek anzeigen. Diese '
    + 'Einstellung gilt nur für diesen Controller.',
  'desk.library.sortFolders': 'Ordner sortieren nach',
  'desk.library.sort.songNumber': 'Titelnummer',
  'desk.library.sort.songName': 'Titelname',
  'desk.library.sort.fileName': 'Dateiname',
  'desk.library.artists': 'Interpreten',
  'desk.library.contributingArtists': 'Mitwirkende Interpreten',
  'desk.library.albums': 'Alben',
  'desk.library.composers': 'Komponisten',
  'desk.library.genres': 'Genres',
  'desk.library.songs': 'Titel',
  'desk.library.importedPlaylists': 'Importierte Playlists',
  'desk.library.foldersNode': 'Ordner',
  'desk.library.groupBy': 'Kompilationen gruppieren nach',
  'desk.library.group.ITUNES': 'iTunes®-Kompilationen',
  'desk.library.group.WMP': 'Album-Interpreten',
  'desk.library.group.NONE': 'Kompilationen nicht gruppieren',
  'desk.library.compilationsNote':
    'Eine Änderung der Kompilationsgruppierung aktualisiert den Musikindex.',
  'desk.time.timeZone': 'Zeitzone',
  'desk.time.autoDst': 'Automatisch auf Sommerzeit umstellen',
  'desk.time.internet': 'Datum und Uhrzeit aus dem Internet beziehen',
  'desk.time.date': 'Datum',
  'desk.time.time': 'Uhrzeit',
  'desk.time.dateFormat': 'Datumsformat',
  'desk.time.timeFormat': 'Zeitformat',
  'desk.time.fmt.MDY': 'Monat/Tag/Jahr',
  'desk.time.fmt.DMY': 'Tag/Monat/Jahr',
  'desk.time.fmt.YMD': 'Jahr/Monat/Tag',
  'desk.time.fmt.12H': '12 Stunden',
  'desk.time.fmt.24H': '24 Stunden',
  'desk.time.notSet': 'Nicht gesetzt',
  'desk.time.setNow': 'Stellen',
  'desk.time.loading': 'Zeiteinstellungen werden gelesen…',
  'desk.time.server': 'Zeitserver: {server}',
  'desk.parental.body':
    'Die Filterung expliziter Inhalte ist eine Einstellung deines '
    + 'Sonos-Systems, die alle steuernden Apps teilen. Sonora liest sie von '
    + 'deinen Lautsprechern und zeigt sie unten an.\nSie zu ändern erfordert '
    + 'eine Berechtigung, die Sonos nur den eigenen Apps erteilt: Die '
    + 'Lautsprecher nehmen den Schreibzugriff von jedem Controller an, aber '
    + 'nur mit einem Token, das für die Sonos-App ausgestellt wurde, und die '
    + 'einzige Berechtigung, die Sonos anderen Entwicklern anbietet, deckt '
    + 'allein die Wiedergabe ab. Die Sonos-App kann es; diese wartet auf '
    + 'Sonos.\nNicht alle Dienste unterstützen die Inhaltsfilterung.',
  'desk.parental.filter': 'Explizite Inhalte filtern',
  'desk.parental.filterFor': 'Explizite Inhalte auf {system} filtern',
  'desk.parental.on': 'Inhaltsfilter ein',
  'desk.parental.off': 'Inhaltsfilter aus',
  'desk.parental.unknown': 'Inhaltsfilter konnten nicht gelesen werden',
  'desk.parental.reading': 'Einstellung wird gelesen…',
  'desk.parental.turnOn': 'Filterung expliziter Inhalte einschalten',
  'desk.parental.moreInfo': 'Weitere Informationen',
  'desk.parental.unavailable':
    'Sonos erlaubt diese Änderung nur den eigenen Apps',
  'desk.prefs.roomSettings': 'Raumeinstellungen',
  'desk.prefs.settingsFor': 'Einstellungen für {room}',
  'desk.prefs.musicEq': 'Musik-EQ',
  'desk.prefs.device': 'Gerät',
  'desk.prefs.bass': 'Bässe',
  'desk.prefs.treble': 'Höhen',
  'desk.prefs.balance': 'Balance',
  'desk.prefs.left': 'L',
  'desk.prefs.right': 'R',
  'desk.prefs.loudness': 'Loudness',
  'desk.prefs.reset': 'Zurücksetzen',
  'desk.prefs.eqFixed':
    'Klangeinstellungen sind nicht verfügbar, solange der Line-Out-Pegel '
    + 'eines Sonos-Lautsprechers auf Fest steht.',
  'desk.prefs.roomName': 'Raumname',
  'desk.prefs.apply': 'Übernehmen',
  'desk.prefs.statusLight': 'Statusleuchte',
  'desk.prefs.on': 'Ein',
  'desk.prefs.off': 'Aus',
  'desk.prefs.servicesTitle': 'Meine Dienstkonten auf Sonos',
  'desk.prefs.servicesSignIn':
    'Es sind keine eingerichteten Dienste aufgeführt. Sonora liest sie '
    + 'direkt von den Lautsprechern, das heißt meist, dass keiner erreichbar '
    + 'war.',
  'desk.about.title': 'Über mein Sonos-System',
  'desk.about.body': 'Lautsprecher in diesem Netzwerk, nach System.',
  'desk.about.model': 'Modell',
  'desk.about.version': 'Version',
  'desk.about.address': 'Adresse',
  'desk.about.speakers': 'Lautsprecher',
  'desk.about.system': 'System',
  'desk.shortcuts.title': 'Tastenkürzel',
  'desk.shortcuts.playPause': 'Wiedergabe/Pause',
  'desk.shortcuts.volUp': 'Lautstärke erhöhen',
  'desk.shortcuts.volDown': 'Lautstärke verringern',
  'desk.shortcuts.mute':
    'Aktuellen Raum/Gruppe stummschalten oder Stummschaltung aufheben',
  'desk.shortcuts.nextZone': 'Nächste Raumgruppe auswählen',
  'desk.shortcuts.prevZone': 'Vorherige Raumgruppe auswählen',
  'notice.cannotPlay.title': 'Das ließ sich nicht abspielen',
  'notice.cannotPlay.detail': '{room} konnte {item} nicht abspielen. {reason}',
  'notice.cannotPlay.stream':
    '{room} konnte {item} nicht abspielen: von {host} kam nichts zurück. '
    + '{reason}',
  'notice.cannotPlay.format':
    'Der Lautsprecher unterstützt dieses Format nicht.',
  'notice.cannotPlay.connect': 'Der Lautsprecher konnte es nicht erreichen.',
  'notice.cannotPlay.refused': 'Der Dienst hat die Wiedergabe abgelehnt.',
  'notice.cannotPlay.missing': 'Es ist nicht mehr vorhanden.',
  'notice.cannotPlay.permission': 'Dieses Konto darf es nicht abspielen.',
  'notice.notPlaying.title': 'Es hat nichts begonnen',
  'notice.notPlaying.detail':
    '{room} hat die Wiedergabe angenommen und dann wieder gestoppt. Die '
    + 'aktuelle Quelle ließ sich nicht abspielen; wähle im Musikbereich etwas '
    + 'anderes.',
  'notice.notPlaying.stream':
    '{room} hat die Wiedergabe angenommen und dann wieder gestoppt. Die '
    + 'Quelle ist ein Stream von {host}, der offenbar offline ist.',
  'desk.menu.quit': 'Sonos beenden',
  'desk.menu.delete': 'Löschen',
  'desk.menu.selectAll': 'Alles auswählen',
  'desk.menu.fullScreen': 'Vollbild aktivieren',
  'desk.menu.updatePlaylists': 'iTunes-Playlists jetzt aktualisieren',
  'desk.menu.updateAlbumArt': 'Albumcover jetzt aktualisieren',
  'desk.menu.window': 'Fenster',
  'desk.menu.close': 'Schließen',
  'desk.menu.uninstall': 'Deinstallieren …',
  'desk.menu.services': 'Dienste',
  'desk.menu.hideSonos': 'Sonos ausblenden',
  'desk.menu.hideOthers': 'Andere ausblenden',
  'desk.menu.showAll': 'Alle einblenden',
  'desk.menu.autofill': 'Automatisch ausfüllen',
  'desk.menu.dictation': 'Diktat starten …',
  'desk.menu.emoji': 'Emoji & Symbole',
  'desk.menu.fill': 'Füllen',
  'desk.menu.center': 'Zentrieren',
  'desk.menu.moveResize': 'Bewegen & Größe ändern',
  'desk.menu.fullScreenTile': 'Kacheln im Vollbildmodus',
  'desk.menu.removeFromSet': 'Fenster aus Gruppe entfernen',
  'win.menu.file': 'Datei',
  'win.menu.exit': 'Beenden',
  'win.menu.showMini': 'Mini-Controller anzeigen',
  'win.shortcuts.toggleMini': 'Mini-Controller ein-/ausblenden',
  'win.setup.title': 'Sonora-Einrichtung',
  'win.setup.lib.pathTitle': 'Musik aus einer Netzwerkfreigabe hinzufügen',
  'win.setup.lib.pathText': 'Gib den Pfad zu deiner Netzwerkfreigabe ein:',
  'win.setup.lib.examples': 'Beispiele:',
  'win.setup.lib.browse': 'Durchsuchen',
  'win.setup.lib.credTitle': 'Benutzername und Passwort',
  'win.setup.lib.credText':
    'Gib gegebenenfalls Benutzername und Passwort für das Netzlaufwerk mit '
    + 'deiner Musik ein:',
  'win.setup.lib.username': 'Benutzername:',
  'win.setup.lib.password': 'Passwort:',
  'win.setup.lib.adding': 'Musikordner wird hinzugefügt',
  'win.setup.lib.doneTitle': 'Einrichtung der Musikbibliothek',
  'win.setup.lib.doneSetUp':
    '„{folder}“ ist jetzt auf deinem Sonos-System eingerichtet.',
  'win.setup.lib.doneAdding':
    'Deine Musik wird deinem Sonos-System hinzugefügt. Das kann mehrere '
    + 'Minuten dauern.',
  'win.setup.lib.doneNotice':
    'Künftig kannst du Musik über „Musikbibliothek verwalten“ in den '
    + 'Einstellungen hinzufügen.',
  'win.setup.lib.errorTitle': 'Fehler beim Hinzufügen der Musik',
  'win.setup.lib.errorMessage':
    'Sonos konnte den Musikordner nicht hinzufügen',
  'win.setup.lib.errorDetails':
    'Prüfe, ob der Pfad zum Ordner und gegebenenfalls Benutzername und '
    + 'Passwort stimmen.',
  'win.setup.lib.errorReason': 'Grund: {reason}',
  'win.services.addHint':
    'Klicke auf „Hinzufügen“, um deinem Sonos-System einen neuen Dienst '
    + 'hinzuzufügen.',
  'win.services.labsHint':
    'Klicke auf „Sonos Labs“, um kommende Dienste auf deinem Sonos-System '
    + 'auszuprobieren.',
  'win.services.serviceName': 'Dienstname',
  'win.services.name': 'Name',
  'win.services.login': 'Kontoanmeldung',
  'win.services.anonymous': '<Anonym>',
  'win.services.add': 'Hinzufügen',
  'win.services.signInWith': 'Mit {service} anmelden',
  'win.services.labs': 'Sonos Labs',
  'win.services.addTitle': 'Dienst hinzufügen',
  'win.services.labsTitle': 'Willkommen bei Sonos Labs',
  'win.services.labsPrompt':
    'Wähle den Sonos-Labs-Dienst, den du hinzufügen möchtest:',
  'win.services.labsSignedOut':
    'Melde dich bei deinem Sonos-Konto an, um Sonos-Labs-Dienste zu sehen.',
  'win.services.labsFailed':
    'Die Liste der Sonos-Labs-Dienste konnte nicht abgerufen werden: '
    + '{error}',
  'win.services.edit': 'Bearbeiten',
  'win.services.editTitle': 'Dienst bearbeiten',
  'win.services.editHeading': '{service}-Konto bearbeiten',
  'win.services.editPrompt': 'Bitte gib einen Kontonamen ein:',
  'win.services.editName': 'Name:',
  'win.services.replace': 'Ersetzen',
  'win.services.reauthorize': 'Neu autorisieren',
  'win.services.removeTitle': 'Konto entfernen',
  'win.services.removeBody':
    'Möchtest du dieses {service}-Konto wirklich von deinem Sonos-System '
    + 'entfernen?',
  'win.eq.tab': 'EQ',
  'win.eq.intro': 'Stelle Höhen und Bässe nach deinem Geschmack ein.',
  'win.errorLog.title': 'Sonora-Systemfehlerprotokoll',
  'desk.errorLog.empty': 'In den letzten sieben Tagen wurden keine Fehler aufgezeichnet.',
  'win.library.title': 'Meine Musikordner auf Sonos',
  'win.library.addHint':
    'Klicke auf „Hinzufügen“, um deinem Sonos-System einen neuen '
    + 'Musikordner hinzuzufügen.',
  'win.library.removeHint':
    'Klicke auf „Entfernen“, um den markierten Ordner zu entfernen.',
  'win.library.name': 'Name',
  'win.library.path': 'Pfad',
  // The Windows app's own two lines while the library updates.
  'win.library.indexing1': 'Musikbibliothek wird aktualisiert…',
  'win.library.indexing2': 'Bitte warten.',
  'win.mini.noMusic': '[keine Musik]',
  'win.mini.volume': 'Lautstärke',
  'win.mini.larger': 'Größer',
  'win.mini.smaller': 'Kleiner',
  'win.menu.checkUpdates': 'Nach Software-Updates suchen…',
  'win.menu.changeLanguage': 'Sprache ändern…',
  'win.menu.settings': 'Einstellungen…',
  'win.settings.title': 'Einstellungen',
  'win.sleep.title': 'Einschlaf-Timer ({state})',
  'win.sleep.choose': 'Wähle eine Dauer für den Einschlaf-Timer von „{room}“:',
  'desk.window.controller': 'Sonora-{systems}-Controller',
  'win.about.title': 'Über',
  'win.about.version': 'Version:',
  'win.about.os': 'Sonos OS:',
  'win.about.license': 'Lizenz:',
  'win.about.system': 'Sonos-{gen}-System:',
  'win.about.serial': 'Seriennummer',
  'win.about.ip': 'IP-Adresse',
  'win.about.associated': 'Zugehöriges Produkt:',
  'win.about.hardware': 'Hardware-Version',
  'win.about.series': 'Serien-ID',
  'win.about.wm': 'WM',
  'win.shortcuts.intro': 'Sonora unterstützt die folgenden Tastenkürzel:',
  'win.shortcuts.function': 'Funktion',
  'win.shortcuts.shortcut': 'Tastenkürzel',
  'win.shortcuts.toggleShuffle': 'Zufallswiedergabe umschalten',
  'win.shortcuts.toggleRepeat': 'Wiederholen umschalten',
  'win.shortcuts.muteAll': 'Alle stummschalten',
  'win.shortcuts.topMenu': 'Zurück zum obersten Musikmenü',
  'win.shortcuts.favorites': 'Zu den Favoriten',
  'win.shortcuts.toggleCrossfade': 'Überblenden umschalten',
  'win.shortcuts.scrollCurrent':
    'Zum aktuellen Titel in der Warteschlange scrollen',
  'win.shortcuts.closeWindow': 'Aktives Fenster schließen',
  'win.shortcuts.browserNote':
    'Drei davon weichen von der Sonos-App ab: Ein Browser behält Strg+T, '
    + 'Strg+L und Strg+W für sich.',
  'win.shortcuts.jumpSearch': 'Zum Suchfeld springen',
  'win.shortcuts.playNext': 'Ausgewählten Titel als Nächstes abspielen',
  'win.shortcuts.replaceQueue': 'Warteschlange durch Auswahl ersetzen',
  'win.shortcuts.playLater': 'Auswahl später abspielen',
  'win.shortcuts.resizeQueue': 'Warteschlange in der Größe ändern',
  'win.shortcuts.prevTrack': 'Vorheriger Titel',
  'win.shortcuts.nextTrack': 'Nächster Titel',
  'win.shortcuts.showShortcuts': 'Liste der Tastenkürzel anzeigen',
  'win.settings.sonora': 'Sonora',
  'win.parental.title': 'Kindersicherung',
  'win.parental.enabled':
    'Die Filterung expliziter Inhalte ist aktiviert. Klicke auf die '
    + 'Schaltfläche unten, um explizite Inhalte auf deinem Sonos-System '
    + 'zuzulassen.\n\nNicht alle Dienste unterstützen die Inhaltsfilterung.',
  'win.parental.disabled':
    'Die Filterung expliziter Inhalte ist deaktiviert. Klicke auf die '
    + 'Schaltfläche unten, um explizite Inhalte auf deinem Sonos-System zu '
    + 'unterbinden.\n\nNicht alle Dienste unterstützen die Inhaltsfilterung.',
  'win.parental.noServices':
    'Auf deinem Sonos-System gibt es keine Musikdienste, die '
    + 'Inhaltsfilterung unterstützen.',
  'win.parental.unreadable':
    'Dieses System hat nicht mitgeteilt, ob die Filterung expliziter '
    + 'Inhalte aktiv ist.',
  'win.parental.turnOn': 'Filterung expliziter Inhalte einschalten',
  'win.parental.turnOff': 'Filterung expliziter Inhalte ausschalten',
  'win.parental.moreInfo': 'Weitere Informationen',
  'win.settings.eq': 'EQ-Einstellungen',
  'win.settings.library': 'Musikbibliothek',
  'win.settings.services': 'Dienste',
  'win.settings.eqFor': 'EQ-Einstellungen für',
  'win.settings.mobileNote':
    'Öffne die Sonos-App auf einem Mobilgerät, um dein System zu verwalten.',
  'win.settings.getApp': 'Mobile App holen',
  'win.maximize': 'Maximieren',
  'win.restore': 'Wiederherstellen',
  'desk.menu.minimize': 'Minimieren',
  'desk.menu.zoom': 'Zoomen',
  'desk.menu.bringAllToFront': 'Alle nach vorne bringen',
  'desk.menu.shop': 'Sonos-Produkte kaufen',
  'desk.menu.firewallHelp': 'Hilfe zur Firewall-Konfiguration',
  'desk.menu.errorLog': 'Fehlerprotokoll',
  'desk.menu.reset': 'Controller zurücksetzen',
  'desk.menu.forget': 'Aktuelles Sonos-System vergessen',
  'desk.window.title': 'Sonora',
  'desk.add.title': 'Musikdienste hinzufügen',
  'desk.add.button': 'Hinzufügen…',
  'desk.add.intro':
    'Wähle einen Dienst, der zu deinem Sonos-System hinzugefügt werden '
    + 'soll.',
  'win.addService.title': 'Dienst hinzufügen',
  'win.addService.heading': 'Verfügbare Dienste',
  'win.addService.intro': 'Wählen Sie den Dienst, den Sie Ihrem Sonos-System hinzufügen möchten.',
  'desk.add.auth.Anonymous': 'Kein Konto nötig',
  'desk.add.appOnly': 'Nur Sonos-App',
  'desk.add.another': 'Ein weiteres Konto',
  'desk.add.unpairable':
    '{service} lässt sich nur mit der offiziellen Sonos-App hinzufügen: Der '
    + 'Anbieter meldet keinen Nicht-Sonos-Controller an.',
  'desk.add.auth.DeviceLink': 'Anmeldung auf der Website des Anbieters',
  'desk.add.auth.AppLink':
    'Anmeldung auf der Website des Anbieters, sofern angeboten',
  'desk.add.needsApp':
    '{service} erlaubt keine Anmeldung aus Sonora heraus; der Anbieter '
    + 'akzeptiert die Anmeldung nur über die offizielle Sonos-App. Füge den '
    + 'Dienst dort hinzu, um ihn in den Sonos-Apps zu nutzen. Was daraus in '
    + 'Sonos-Favoriten oder Sonos-Playlists gespeichert ist, läuft weiterhin '
    + 'in Sonora.',
  'desk.add.instructions':
    'Gehe zu {url}, melde dich an und gib diesen Code ein:',
  'desk.add.instructionsNoCode':
    'Gehe zu {url} und melde dich an, um Sonos zu autorisieren.',
  'desk.add.open': 'Im Browser öffnen',
  'desk.add.waiting': 'Warten auf die Bestätigung von {service}…',
  'desk.add.authorizeTitle': '{service}-Konto hinzufügen',
  'desk.add.authorizeBody': 'Melde dich im Browser bei {service} an, damit Sonos dein Konto nutzen kann.',
  'desk.add.authorize': 'Autorisieren',
  'desk.add.doneSystem.multi':
    '{service} wurde deinem {gen}-System hinzugefügt und steht auf deinen '
    + '{gen}-Geräten bereit, in Sonora wie in der offiziellen Sonos-App. Um '
    + 'ihn auch auf deinen {other}-Geräten zu nutzen, füge ihn erneut über '
    + 'die {link} hinzu.',
  'desk.add.doneSystem.solo':
    '{service} wurde deinem Sonos-System hinzugefügt und steht auf deinen '
    + 'Geräten bereit, in Sonora wie in der offiziellen Sonos-App.',
  'desk.add.doneAnon.multi':
    '{service} ist jetzt in Sonora auf deinen {gen}-Geräten verfügbar. Er '
    + 'konnte deinem Sonos-System nicht hinzugefügt werden und erscheint '
    + 'daher nicht in den Sonos-Apps. Um ihn auf deinen {other}-Geräten in '
    + 'Sonora zu nutzen, füge ihn erneut über die {link} hinzu.',
  'desk.add.doneAnon.solo':
    '{service} ist jetzt in Sonora auf deinen Geräten verfügbar. Er konnte '
    + 'deinem Sonos-System nicht hinzugefügt werden und erscheint daher nicht '
    + 'in den Sonos-Apps.',
  'desk.add.failed': '{service} konnte nicht hinzugefügt werden: {error}',
  // --- About dialog ------------------------------------------------------
  'about.title': 'Über Sonora',
  'about.menu': 'Über Sonora',
  'about.version': 'Version {version}',
  'about.tagline': 'Ein selbst gehosteter Web-Controller für alle Sonos-Lautsprecher.',
  'about.pointLocal': 'Lokale Steuerung zuerst',
  'about.pointThemes': 'Ausgefeilte Designs',
  'about.pointNetwork': 'Netzwerk-Fehlerbehebung',
  'about.pointUpgrade': 'Berater für Hardware-Upgrades',
  'about.pointMore': 'Und vieles mehr …',
  'about.license': 'Sonora ist freie Software, veröffentlicht unter der Lizenz {license}.',
  'about.github': 'Auf GitHub ansehen',
  'about.thirdParty': 'Lizenzen von Drittanbietern',
  'about.support': 'Sonora unterstützen',
  'about.supportNote': 'Wenn Sonora für dich nützlich ist, unterstütze das Projekt.',
  'about.trademark': 'Sonora steht in keiner Verbindung zu Sonos und wird nicht von Sonos unterstützt.\nSonos ist eine Marke von Sonos, Inc.',
  'desk.showSystem': 'System anzeigen',
  'desk.services.tab': '{system}-Dienste',
  'desk.add.starting': '{service} wird nach einem Anmeldelink gefragt…',
  'desk.add.linking': 'Verknüpfung mit {service}…',
  // --- removing a music service (every theme) --------------------------------
  'services.remove': 'Entfernen',
  'services.rename': 'Umbenennen',
  'services.renameTitle': '{service}-Konto umbenennen',
  'services.renamed': '{service}-Konto in {name} umbenannt',
  'services.removeHint': 'Den markierten Dienst entfernen',
  'services.removeTitle': '{service} entfernen?',
  'services.removeChoose': 'Wo möchtest du {service} entfernen?',
  'services.removeSonora': 'Sonora',
  'services.removeSonoraSub': 'seine Anmeldung und seinen Eintrag hier',
  'services.removeSonos': 'Sonos {gen}',
  'services.removeSonosSub': 'das Konto auf deinem Sonos-System',
  'services.confirmRemove': 'Entfernen',
  'services.removing': '{service} wird entfernt…',
  'services.removeFailed': '{service} konnte nicht entfernt werden: {error}',
  'services.removeFromSonos': 'Von Sonos entfernen',
  'services.removeSonosBody':
    '{service} von deinem Sonos-System entfernen? Der Dienst verschwindet '
    + 'aus allen Sonos-Apps, nicht nur aus Sonora.',
  'services.removeSonoraBody': '{service} aus Sonora entfernen? Sonora vergisst die Anmeldung.',
  'desk.add.doneSonora.multi':
    '{service} ist jetzt in Sonora verknüpft.\nDu musst {service} außerdem '
    + 'ein zweites Mal verknüpfen – direkt in einer der Sonos-{gen}-Apps –, '
    + 'damit Sonora deine {gen}-Geräte steuern kann.\nUm {service} auf deinen '
    + '{other}-Geräten in Sonora zu nutzen, verknüpfe ihn erneut über die '
    + '{link}.',
  'services.relinkLinkText': '{other}-Dienste',
  'services.caution.sonos': 'Mit Sonos {gen} verknüpft, noch nicht mit Sonora',
  'services.needsSonora.title': 'Sonora-Verknüpfung erforderlich',
  'services.needsSonos.title': 'Sonos-{gen}-Verknüpfung erforderlich',
  'services.caution.sonora':
    'Mit Sonora verknüpft, noch nicht mit Sonos {gen}',
  'services.sonoraOnly.body':
    '{service} ist in Sonora verknüpft, aber nicht mit deinem '
    + 'Sonos-{gen}-System.\nSonora kann den Dienst durchsuchen, deine '
    + '{gen}-Geräte können ihn aber erst abspielen, wenn du {service} in '
    + 'einer der Sonos-{gen}-Apps verknüpfst.',
  'desk.add.doneSonora.solo':
    '{service} ist jetzt in Sonora verknüpft.\nDu musst {service} außerdem '
    + 'ein zweites Mal verknüpfen – direkt in einer der Sonos-{gen}-Apps –, '
    + 'damit Sonora deine {gen}-Geräte steuern kann.',

  // --- Sonofuture ---

  // --- S2 Upgrade Info ---
  's2.title': 'Sonos-Upgrade-Berater',
  's2.lede':
    'Finde heraus, welche Hardware nötig wäre, um vollständig auf S2 oder '
    + 'S2.1 zu wechseln, und was das ungefähr kostet.',
  's2.con4':
    'Die S1-App ist seit Jahren unverändert und stabil. Die S2-App wurde '
    + '2024 neu geschrieben, und dieser Start war holprig.',
  's2.colRoom': 'Raum',
  's2.colProduct': 'Produkt',
  's2.colReplacement': 'S2-Entsprechung',
  's2.colReplacementS21': 'S2.1-Entsprechung',
  's2.colPrice': 'US-Listenpreis',
  's2.ready': 'Ja',
  's2.notReady': 'Nein, nur S1',
  's2.unknown': 'Unbekannt',
  's2.replaceTitle': 'Was S2 in jedem Raum kosten würde',
  's2.replaceBlurb': 'Jedes Gerät im Haushalt und was es für S2 braucht: ein Software-Update, einen Ersatz zum Listenpreis oder nichts.',
  's2.noReplacement': 'Nichts zu kaufen',
  's2.noReplacementWhy':
    'ein kabelgebundener Lautsprecher trägt das Netzwerk, und die App hat '
    + 'den Controller ersetzt',
  's2.total': 'Gesamtkosten, dieses System auf S2 zu bringen',
  's2.amazonDisclosure': 'Als Amazon-Partner verdiene ich an qualifizierten Verkäufen.',
  's2.pricesNote': 'US-Listenpreise, geprüft im {quarter}. Quartal {year}. Preise können sich ändern: Prüfe vor dem Kauf nach.',
  's2.timelineTitle': 'Drei Hardware-Generationen',
  's2.era.s1': 'Nur S1',
  's2.era.s20': 'S2.0',
  's2.era.s21': 'S2.1',
  's2.eraSpan': '{from} bis {to}',
  's2.eraOpen': '{from} bis heute',
  's2.eraBounds.s1':
    'ZonePlayer 100 (Januar 2005) bis Play:5 Gen. 1 (November 2015). Nichts '
    + 'aus diesen Jahren kann S2 ausführen.',
  's2.eraBounds.s20':
    'Play:3 (Juli 2011) bis Symfonisk Tischleuchte Gen. 1 (Januar 2022). '
    + 'Läuft mit S2, seit 2025 von neuen Funktionen ausgeschlossen.',
  's2.eraBounds.s21':
    'Sonos One (Oktober 2017) und später. Alles, was Sonos heute verkauft.',
  's2.mark.s2app': 'S2-App, Juni 2020',
  's2.mark.freeze': 'S2.0 eingefroren, 2025',
  's2.linksIntro': 'In den Worten von Sonos:',
  's2.linkS2Launch': 'S2 wird vorgestellt, Juni 2020',
  's2.linkS21Launch': 'Das Legacy-Produkt-Update 2025',
  's2.allReady':
    'Jedes S1-Gerät hier kann S2 ausführen. Dieses System kann wechseln, '
    + 'ohne dass du etwas kaufst.',
  's2.allS21':
    'Alle deine Geräte laufen auf der Sonos-S2.1-Plattform. Du musst nichts '
    + 'aktualisieren. Entweder bist du sehr neu bei Sonos oder sehr reich. So '
    + 'oder so: Glückwunsch!',

  // --- the network map ---
  'net.mapTitle': 'Alle Geräte im Netzwerk',
  'net.mapBlurb': 'Eine Karte pro Lautsprecher. Jede sagt, ob seine Verbindung in Ordnung ist und warum, danach, wie schnell und zuverlässig er antwortet. Den Rest finden Sie unter Details.',
  'net.mapEmpty': 'Kein Gerät hat geantwortet.',
  'net.wired': 'Kabelgebunden',
  'net.onSonosnet': 'SonosNet',
  'net.onWifi': 'WLAN',
  'net.channel': 'Kanal {n}',
  'net.unreachable': 'Hat nicht geantwortet',
  'net.notMeasurable': 'Keine Nachbarn zum Messen',
  'net.drop.title': 'Wiedergabeaussetzer',
  'net.drop.blurb': 'Wann in den letzten sieben Tagen die Musik in einem Raum aussetzte.',
  'net.drop.none': 'Keine Aussetzer in den letzten sieben Tagen.',
  'net.drop.buffering': '{seconds} s zum Puffern angehalten',
  'net.drop.skipped': 'Etwas übersprungen, das nicht abspielbar war',
  'net.drop.failed': 'Gestoppt: nicht abspielbar',
  'net.drop.more': 'Und {count} frühere.',
  'net.fix.no_answer': 'Prüfen Sie, ob er eingeschaltet und noch im Netzwerk ist.',
  'net.fix.lost': 'Meist schwache Abdeckung am Standort oder ein ausgelasteter Kanal. Versuchen Sie ihn näher am Router.',
  'net.fix.slow': 'Oft ein schwaches Signal vom Router. Lautsprecher oder Router näher zusammenzurücken hilft meistens.',
  'net.fix.slow_often': 'Meist anderer WLAN-Verkehr oder Störungen auf seinem Kanal: Mikrowellen, Babyfone und Netze der Nachbarn sind häufige Ursachen.',
  'net.fix.uneven': 'Meist anderer WLAN-Verkehr oder Störungen auf seinem Kanal: Mikrowellen, Babyfone und Netze der Nachbarn sind häufige Ursachen.',
  'net.fix.stall': 'Eine einzelne lange Pause ist meist ein Schub anderen WLAN-Verkehrs. Kommt es in diesem Raum öfter vor, suchen Sie nach Störquellen in der Nähe.',
  'net.fix.dropping': 'Seine eigene WLAN-Verbindung verliert Pakete. Ein schwaches Signal oder Störungen in der Nähe sind die üblichen Ursachen.',
  'net.fix.extender': 'Repeater verursachen Verzögerung. Verbinden Sie ihn mit dem Hauptrouter, wenn er ihn erreicht.',
  'net.summary.clear': 'Nichts Auffälliges. Alle Lautsprecher antworten prompt.',
  'net.summary.issues': '{parts}. Die Karte jedes Lautsprechers unten sagt, warum.',
  'net.summary.and': ' und ',
  'net.probing': 'Lautsprecher werden geprüft. Bitte warten...',
  'net.health.good': 'Gut',
  'net.health.watch': 'Im Auge behalten',
  'net.health.problem': 'Problem',
  'net.health.unmeasured': 'Nicht gemessen',
  'net.why.ok': 'Antwortet in {median} ms',
  'net.why.no_answer': 'Keine Antwort auf {attempts} Versuche',
  'net.why.lost': '{failed} von {attempts} Antworten fehlten',
  'net.why.slow': 'Antwortet meist in {median} ms',
  'net.why.slow_often': '1 von 20 Antworten dauert über {p95} ms',
  'net.why.uneven': '1 von 20 Antworten dauert über {p95} ms',
  'net.why.stall': 'Eine Antwort dauerte {worst} ms',
  'net.why.dropping': 'Verwirft {rate} Pakete pro Minute',
  'net.why.extender': 'Über einen WLAN-Repeater verbunden',
  'net.details': 'Details',
  'net.replies': 'Antworten',
  'net.repliesLine': 'meist {median} ms · 1 von 20 über {p95} ms · langsamste {worst} ms · {failed} von {attempts} fehlten',
  'net.dropped': 'Verworfene Pakete',
  'net.perMinute': '{n} pro Minute',
  'net.notReported': 'Nicht angegeben',
  'net.hears': 'Hört andere Sonos-Lautsprecher',
  'net.hearsHint': 'Wie laut dieser Lautsprecher die anderen Lautsprecher seines Systems hört. Das beschreibt seinen Standort, nicht seine WLAN-Verbindung: Kein Sonos-Lautsprecher meldet, wie gut er Ihren Router empfängt.',
  'net.noiseLabel': 'Funkrauschen',
  'net.count.problem.one': '{count} Problem',
  'net.count.problem.other': '{count} Probleme',
  'net.count.watch.one': '{count} im Auge behalten',
  'net.count.watch.other': '{count} im Auge behalten',
  'net.margin': '{n} dB Reserve',
  'net.alone': 'Kein Lautsprecher in Reichweite',
  'net.mesh.title': 'Mesh- oder verwaltetes Netzwerk?',
  'net.mesh.blurb': 'Mesh-WLAN-Systeme und verwaltete Access Points können {sometimes} verhindern, dass sich die Lautsprecher gegenseitig finden. Die Hersteller raten im Kern zu wenigen Regeln: Alle Lautsprecher auf dieselbe Weise verbinden, alle per WLAN oder alle per Kabel; verkabelte Lautsprecher an ein und dieselbe Router-Einheit oder denselben Switch anschließen; und Multicast-Verkehr von den Access Points weder umwandeln noch filtern lassen.',
  'net.mesh.sometimes': 'manchmal',
  'net.mesh.guidance': 'Anleitungen:',
  's2.tier.s21': 'S2.1',
  's2.tier.s20': 'S2.0',
  's2.tier.unknown': 'Unbekannt',
  's2.s21Title': 'Was S2.1 in jedem Raum kosten würde',
  's2.s21Blurb': 'Jedes Gerät im Haushalt und was es für S2.1 braucht. Ein Gerät, das S2 gar nicht ausführen kann oder nur S2.0 erreicht, wird durch das aktuelle Produkt ersetzt, das seinen Platz einnimmt. Die Summe enthält, was der Wechsel zu S2 überhaupt kosten würde.',
  's2.colWhy': 'Grund',
  's2.why.legacy': 'Kann S2 nicht ausführen',
  's2.why.lower': 'Nur S2.0',
  's2.why.upgradable': 'Aktualisierbar',
  's2.why.runningS2': 'Läuft mit S2',
  's2.why.runningS21': 'Läuft mit S2.1',
  's2.totalS21': 'Gesamtkosten für S2.1 in jedem Raum',
  's2.s21AllReady':
    'Jeder Raum hier wäre bereits S2.1. Es gibt nichts zu kaufen.',
  's2.tierUnknownNote.one':
    'Ein Gerät ließ sich keiner Stufe zuordnen: Sonos führt nur einige '
    + 'Generationen dieses Produkts, und der Lautsprecher meldet nicht, '
    + 'welche er ist.',
  's2.tierUnknownNote.other':
    '{count} Geräte ließen sich keiner Stufe zuordnen: Sonos führt nur '
    + 'einige Generationen dieser Produkte, und die Lautsprecher melden '
    + 'nicht, welche sie sind.',
  's2.choiceTitle': 'Was möchtest du tun?',
  's2.choiceKeepBoth': 'Getrennte S1- und S2-Systeme behalten',
  's2.choiceKeepBothNote':
    'Zwei getrennte Sonos-Systeme behalten: S1 und S2, so wie jetzt. '
    + '(Manche S1-Geräte lassen sich per Software auf S2 aktualisieren.)',
  's2.choiceStayS1': 'S1-System weiter nutzen',
  's2.choiceStayS1Note': 'Nutze dein S1-System weiter wie bisher. Es ist nichts zu tun.',
  's2.choiceStayS2': 'S2-System weiter nutzen',
  's2.choiceStayS2Note': 'Nutze dein S2-System weiter wie bisher. Es ist nichts zu tun.',
  's2.choiceS2': 'Auf S2 wechseln',
  's2.choiceS2Note':
    'Alle geeigneten S1-Lautsprecher per Software auf S2 aktualisieren und '
    + 'für die S1-Geräte, die den Sprung nicht schaffen, Ersatz kaufen.',
  's2.choiceS21': 'Auf S2.1 wechseln',
  's2.choiceS21Note':
    'Für alle vorhandenen Sonos-Geräte, die nicht S2.1-fähig sind, Ersatz '
    + 'kaufen. Die Variante ohne Rücksicht auf den Preis, zukunftssicher.',
  's2.choiceFree': 'Nichts zu kaufen',
  's2.colBuy': 'Aktion',
  's2.buyNow': 'Jetzt kaufen',
  's2.updateNow': 'Jetzt aktualisieren',
}
