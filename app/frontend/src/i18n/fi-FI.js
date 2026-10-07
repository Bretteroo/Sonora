// Finnish (fi-FI). The keys mirror en-US.js, the reference catalog; a key
// missing here is looked for along this locale's fallback chain in locales.js,
// then in en-US.js.
//
// Placeholders are written {name} and substituted at render time. Counts that
// change the wording carry .one and .other keys (see en-US.js).

export default {

  // --- shared ------------------------------------------------------------
  'common.theme': 'Teema',
  'common.language': 'Kieli',
  'common.back': 'Takaisin',
  'common.cancel': 'Peruuta',
  'common.save': 'Tallenna',
  'common.submit': 'Lähetä',
  'common.apply': 'Käytä',
  'common.appearance': 'Ulkoasu',
  'common.appearanceLight': 'Vaalea',
  'common.appearanceDark': 'Tumma',
  'common.appearanceSystem': 'Järjestelmä',
  'common.done': 'Valmis',
  'common.close': 'Sulje',
  'common.explicit': 'Sensuroimaton',
  'common.restricted': 'Rajoitettu',
  'common.dismiss': 'Ohita',
  'common.settings': 'Asetukset',
  'common.search': 'Haku',
  'common.queue': 'Jono',
  'common.play': 'Toista',
  'common.pause': 'Tauko',
  'common.stop': 'Pysäytä',
  'common.next': 'Seuraava',
  'common.previous': 'Edellinen',
  'common.shuffle': 'Satunnaistoisto',
  'common.repeat': 'Toisto',
  'common.mute': 'Mykistä',
  'common.unmute': 'Poista mykistys',
  'common.viewAll': 'Näytä kaikki',
  'common.reconnecting': 'yhdistetään uudelleen',
  'desk.lc.noNetwork':
    'Sonoran käyttö edellyttää yhteyttä langalliseen tai langattomaan '
    + 'verkkoon. Tarkista verkkoasetukset.',
  'desk.lc.noSonora':
    'Tämän sivun yhteys Sonoraan on katkennut. Yhteys palautuu itsestään '
    + 'heti, kun Sonora vastaa.',
  'local.room': 'Tämä selain',
  'local.cannotGroup.title': 'Tätä selainta ei voi ryhmittää',
  'local.cannotGroup.detail':
    'Ryhmässä kaiuttimet pitävät yhteisen kellon omassa verkossaan. Selain '
    + 'ei ole siinä mukana, joten se soittaa omillaan.',
  'local.cannotPlay.title': 'Tämä selain ei voi toistaa sitä',
  'local.cannotPlay.needsSpeaker':
    'Vain kaiutin voi hakea sen: musiikkipalvelu antaa virtansa '
    + 'kotitaloudelle, ja musiikkikirjaston jaon liittävät soittimet. '
    + 'Internet-radio soi täällä.',
  'local.cannotPlay.unknown':
    'Sonora ei osaa toistaa tätä lähdettä selaimessa. Internet-radio soi '
    + 'täällä.',
  'local.cannotPlay.needsQueue':
    'Albumi, toistoluettelo tai jono on kappaleluettelo, ja sitä säilyttää '
    + 'kaiutin, joka sen toistaa. Toista täällä yksittäinen kappale tai '
    + 'asema.',
  'local.cannotPlay.needsLink':
    'Sonora selaa palvelua {service} kaiuttimien kautta, eikä sillä ole '
    + 'omaa kirjautumista, jolla pyytää virtaa. Yhdistä palvelu Sonoraan, '
    + 'niin tämä soi täällä.',
  'local.cannotPlay.serviceRefused':
    'Palvelu {service} ei salli Sonoran toistaa tätä Sonos-ympäristön '
    + 'ulkopuolella. Kokeile toistaa se suoraan Sonos-soittimella.',
  'local.cannotPlay.protected':
    'Palvelu {service} ei salli Sonoran toistaa tätä Sonos-ympäristön '
    + 'ulkopuolella. Kokeile toistaa se suoraan Sonos-soittimella.',
  'local.cannotDo.title': 'Vain kaiutin voi tehdä sen',
  'local.cannotDo.detail':
    'Tämä selain on ulostulo eikä soitin: ei taajuuskorjainta, merkkivaloa, '
    + 'jonoa eikä stereoparia. Äänenvoimakkuus, toisto ja tauko toimivat.',
  'common.rooms.one': '{count} huone',
  'common.rooms.other': '{count} huonetta',
  'common.speakers.one': '{count} kaiutin',
  'common.speakers.other': '{count} kaiutinta',
  'common.groups.one': '{count} ryhmä',
  'common.groups.other': '{count} ryhmää',
  'common.items.one': '{count} kohde',
  'common.items.other': '{count} kohdetta',
  'common.tracks.one': '{count} kappale',
  'common.tracks.other': '{count} kappaletta',
  'common.noResults': 'Ei tuloksia',
  'common.offline': 'offline-tilassa',
  'common.system': '{generation}-järjestelmä',

  // --- start-up and failure states ---------------------------------------
  'splash.loading.title': 'Etsitään kaiuttimia',
  'splash.loading.detail':
    'Lähetetään hakupyyntö ja kysytään ensimmäiseltä vastaavalta '
    + 'kaiuttimelta muu järjestelmä.',
  'splash.empty.title': 'Kaiuttimia ei löytynyt',
  'splash.empty.detail':
    'Haku käyttää multicastia, joten tätä ohjainta ajavan koneen on oltava '
    + 'samassa verkossa kaiuttimien kanssa, ei vierasverkossa eikä eri '
    + 'VLANissa.',
  'splash.error.title': 'Ohjaimeen ei saada yhteyttä',
  'splash.error.detail':
    'Taustapalvelu ei vastannut. Tarkista, että se on käynnissä.',
  'splash.searchAgain': 'Etsi uudelleen',
  'splash.crash.title': 'Tämä teema lakkasi toimimasta',
  'splash.crash.detail': 'Sen piirtämisessä tapahtui virhe. Lataa sivu uudelleen tai valitse alta toinen ulkoasu.',
  'splash.reload': 'Lataa uudelleen',
  'rating.cannotUndo': '{service} ei tarjoa tapaa perua tätä',
  'splash.connected': 'Yhdistetty ohjaimeen',
  'splash.notConnected': 'Ei yhdistetty',

  // --- notices ------------------------------------------------------------
  'notice.conflict.title': 'Kaiutin kieltäytyi',
  'notice.skipLimit.title': 'Ohitusraja täynnä',
  'notice.skipLimit.body': 'Olet saavuttanut tämän aseman ohitusrajan. Yritä myöhemmin uudelleen.',
  'notice.silent.title': 'Kaiutin ei vastannut',
  'notice.silent.body':
    '{room} lakkasi hetkeksi vastaamasta. Yleensä se palaa itsestään; yritä '
    + 'uudelleen muutaman sekunnin kuluttua.',
  'notice.error.title': 'Jokin meni vikaan',
  'notice.network.title': 'Verkkovirhe',

  // --- what a room is doing ----------------------------------------------
  'search.category.artists': 'Artistit',
  'search.category.albums': 'Albumit',
  'search.category.tracks': 'Kappaleet',
  'search.category.playlists': 'Toistoluettelot',
  'search.category.stations': 'Asemat',
  'search.category.genres': 'Tyylilajit',
  'search.category.podcasts': 'Podcastit ja ohjelmat',
  'search.category.shows': 'Podcastit ja ohjelmat',
  'search.category.audiobooks': 'Äänikirjat',
  'search.category.people': 'Henkilöt',
  'search.category.episodes': 'Jaksot',
  'search.category.hosts': 'Juontajat',
  'source.queue': 'Jono',
  'source.grouped': 'Ryhmitetty',
  'source.line_in': 'Linjatulo',
  'source.radio': 'Radio',
  'source.service_stream': 'Radio',
  'source.service_radio': 'Radio',
  'source.service_hls': 'Radio',
  'source.service_track': 'Suoratoistopalvelu',
  'source.service_container': 'Suoratoistopalvelu',
  'source.library_track': 'Musiikkikirjasto',
  'source.http_stream': 'Verkkovirta',
  'source.external_session': 'AirPlay tai Spotify Connect',
  'source.tv': 'TV',
  'source.playlist': 'Toistoluettelo',
  'source.idle': 'Vapaa',
  'source.unknown': 'Tuntematon lähde',

  // --- web theme ----------------------------------------------------------
  'common.noMusicSelected': 'Musiikkia ei valittu',
  'common.queueIsEmpty': 'Jono on tyhjä',
  'common.roomsGrouped': '{count} huonetta ryhmitetty',
  'common.groupLabel': '{room} + {count}',
  'common.nothingQueued': 'Jonossa ei ole mitään',
  'common.setActive': 'Valitse aktiiviseksi: {room}',
  'common.openQueue': 'Avaa jono',
  'common.seek': 'Siirry',
  'common.live': 'Suora',
  'common.tv': 'TV',
  'desk.browse.lineIn': 'Linjatulo',
  'desk.browse.noSelections': 'Valintoja ei ole käytettävissä.',
  'desk.browse.lineInNone':
    'Jos haluat käyttää linjatuloa, liitä laite linjatulolla varustettuun '
    + 'Sonos-tuotteeseen.',
  'common.kind.playlist': 'Toistoluettelo',
  'common.kind.album': 'Albumi',

  // grouping

  // queue

  // settings
  'net.connection': 'Yhteys',
  'net.live': 'reaaliaikainen',
  'net.rescan': 'Etsi verkosta uudelleen',

  // a service's own page
  'services.needsAccount':
    '{service} ei näytä mitään ilman tilisi kirjautumistunnusta. Tunnusta '
    + 'säilyttävät kaiuttimet, eikä sitä koskaan paljasteta verkkoon, joten '
    + 'palvelun luetteloa ei voi selata täällä. Kaikki siitä '
    + 'Sonos-suosikkeihin tai Sonos-toistoluetteloihin tallennettu soi silti.',

  // --- Sonos account, network check and TV audio, used across themes -------
  'account.title': 'Sonos-tili',
  'account.blurb': 'Valmiiksi määritetyt kaiuttimesi antavat Sonoralle kaiken, mitä se tarvitsee Sonos-järjestelmäsi päivittäiseen ohjaamiseen.',
  'account.optional': 'Kirjautuminen Sonos-tiliin on valinnaista. Se näyttää järjestelmääsi määritettyjen musiikkipalvelujen koko luettelon logoineen, saatavilla olevat Sonos Labs -palvelut ja sen TV-tulon nimen, jota soundbar toistaa.',
  'account.signIn': 'Kirjaudu sisään',
  'account.signOut': 'Kirjaudu ulos',
  'account.signingIn': 'Kirjaudutaan…',
  'account.email': 'Sähköposti',
  'account.password': 'Salasana',
  'account.signedInAs': 'Kirjautuneena: {email}',
  'account.notSignedIn': 'ei kirjautuneena',
  'net.scanning': 'Etsitään verkosta…',
  'net.scanDone': 'Löydetty: {rooms}, {systems}',
  'common.systems.one': '{count} järjestelmä',
  'common.systems.other': '{count} järjestelmää',
  'source.noSignal': 'Ei signaalia',
  'desk.now.tvInput': 'Tulo',
  'desk.now.tvFormat': 'Muoto',
  'tvFormat.0': 'Tuloa ei ole kytketty',
  'tvFormat.2': 'Stereo',
  'tvFormat.7': 'Dolby 2.0',
  'tvFormat.18': 'Dolby 5.1',
  'tvFormat.21': 'Ei tuloa',
  'tvFormat.22': 'Ei ääntä',
  'tvFormat.59': 'Dolby Atmos (DD+)',
  'tvFormat.61': 'Dolby Atmos (TrueHD)',
  'tvFormat.63': 'Dolby Atmos (MAT 2.0)',
  'tvFormat.33554434': 'PCM 2.0',
  'tvFormat.33554454': 'PCM 2.0 ilman ääntä',
  'tvFormat.33554488': 'Dolby 2.0',
  'tvFormat.33554490': 'Dolby Digital Plus 2.0',
  'tvFormat.33554492': 'Dolby TrueHD 2.0',
  'tvFormat.33554494': 'Dolby Monikanavainen PCM 2.0',
  'tvFormat.84934658': 'Monikanavainen PCM 5.1',
  'tvFormat.84934713': 'Dolby 5.1',
  'tvFormat.84934714': 'Dolby Digital Plus 5.1',
  'tvFormat.84934716': 'Dolby TrueHD 5.1',
  'tvFormat.84934718': 'Dolby Monikanavainen PCM 5.1',
  'tvFormat.84934721': 'DTS 5.1',
  'tvFormat.118489090': 'Monikanavainen PCM 7.1',
  'tvFormat.118489146': 'Dolby Digital Plus 7.1',
  'tvFormat.118489148': 'Dolby TrueHD 7.1',

  // --- Sonos macOS Desktop theme ------------------------------------------------
  'desk.menu.edit': 'Muokkaa',
  'desk.menu.view': 'Näytä',
  'desk.menu.manage': 'Hallitse',
  'desk.menu.help': 'Ohje',
  'desk.menu.preferences': 'Asetukset…',
  'desk.menu.checkUpdates': 'Tarkista päivitykset…',
  'desk.menu.cut': 'Leikkaa',
  'desk.menu.copy': 'Kopioi',
  'desk.menu.paste': 'Liitä',
  'desk.menu.mainWindow': 'Sonos-ohjain',
  'desk.menu.miniController': 'Mini-ohjain',
  'desk.menu.musicLibrarySettings': 'Musiikkikirjaston asetukset…',
  'desk.menu.serviceSettings': 'Palveluasetukset…',
  'desk.menu.addRadioStation': 'Lisää radioasema…',
  'desk.radio.myShows': 'Omat radio-ohjelmat',
  'desk.radio.changeLocation': 'Vaihda sijaintia',
  'desk.radio.enterZip': 'Anna postinumero',
  'desk.radio.zipBody': 'Anna postinumerosi:',
  'desk.radio.pickCity': 'Valitse kaupunki',
  'desk.radio.locationSet': 'Paikallisradion sijainti on nyt {city}.',
  'desk.radio.localRadio': 'Paikallisradio',
  'desk.radio.localRadioIn': 'Paikallisradio ({city})',
  'desk.radio.myStations': 'Omat radioasemat',
  'desk.radio.addNew': 'Lisää uusi radioasema',
  'desk.playlists.new': 'Uusi toistoluettelo',
  'desk.playlists.addTitle': 'Lisää kappale toistoluetteloon',
  'desk.playlists.removeSong': 'Poista kappale',
  'desk.playlists.removedSong': 'Poistettiin toistoluettelosta: {title}.',
  'desk.playlists.added': 'Lisättiin {title} toistoluetteloon {playlist}.',
  'desk.playlists.addedMany':
    'Lisättiin {count} kappaletta toistoluetteloon {playlist}.',
  'desk.playlists.nameTitle': 'Nimeä tämä toistoluettelo',
  'desk.playlists.nameBody': 'Toistoluettelon nimi:',
  'desk.playlists.rename': 'Nimeä toistoluettelo uudelleen',
  'desk.playlists.renameBody': 'Anna tälle toistoluettelolle uusi nimi:',
  'desk.playlists.delete': 'Poista toistoluettelo',
  'desk.playlists.deleted': '”{title}” poistettiin.',
  'desk.queue.editedTitle': 'Jonoa on muokattu',
  'desk.queue.editedBody': 'Tämän toistaminen korvaa jonon.',
  'desk.queue.playAnyway': 'Toista silti',
  'desk.radio.title': 'Lisää radioasema',
  'desk.radio.intro': 'Anna uuden radioaseman tiedot.',
  'desk.radio.where':
    'Uusi radioasema lisätään kohtaan TuneIn > Omat radioasemat.',
  'desk.radio.url': 'Suoratoiston URL',
  'desk.radio.name': 'Aseman nimi',
  'desk.radio.added': '”{title}” lisättiin Omiin radioasemiin.',
  'desk.radio.exists': '”{title}” on jo Omissa radioasemissa.',
  'desk.menu.updateLibrary': 'Päivitä musiikkikirjasto nyt',
  'desk.menu.systemHelp': 'Sonos-järjestelmän ohje',
  'desk.menu.supportSite': 'Teknisen tuen verkkosivusto',
  'desk.menu.submitDiagnostics': 'Lähetä diagnostiikkatiedot',
  'desk.menu.about': 'Tietoja Sonos-järjestelmästäni',
  'desk.menu.disabledNote':
    'Harmaana näkyvät kohdat ovat käytettävissä vain Sonos-sovelluksessa.',
  'desk.transport.groupVolume': 'Ryhmän äänenvoimakkuus',
  'desk.transport.back30': '30 sekuntia taaksepäin',
  'desk.transport.forward30': '30 sekuntia eteenpäin',
  'desk.transport.repeatOff': 'Uudelleentoisto ei käytössä',
  'desk.transport.repeatOne': 'Toista kappale uudelleen',
  'desk.transport.repeatAll': 'Toista kaikki uudelleen',
  'desk.transport.crossfade': 'Ristihäivytys',
  'desk.rooms.title': 'Huoneet',
  'desk.rooms.system': 'Järjestelmä',
  'desk.rooms.pauseAll': 'Keskeytä kaikki',
  'desk.rooms.pause': 'Tauko',
  'desk.rooms.confirmPauseAll':
    'Haluatko varmasti keskeyttää musiikin kaikissa huoneissa?',
  'desk.rooms.playGroup': 'Toista ryhmä',
  'desk.rooms.pauseGroup': 'Keskeytä ryhmä',
  'desk.rooms.stopGroup': 'Pysäytä ryhmä',
  'desk.rooms.offline': 'Ei yhteyttä',
  'desk.rooms.batteryLevel': '{level} %',
  'desk.rooms.battery': 'Akku {level} %',
  'desk.rooms.batteryCharging': 'Akku {level} %, latautuu',
  'desk.now.title': 'Nyt soi',
  'desk.now.next': 'Seuraavaksi',
  'desk.now.noMusic': '[Musiikkia ei ole valittu]',
  'desk.now.episode': 'Jakso',
  'desk.now.podcast': 'Podcast',
  'desk.now.releaseDate': 'Julkaisupäivä',
  'desk.now.chapter': 'Luku',
  'desk.now.author': 'Kirjailija',
  'desk.now.narrator': 'Lukija',
  'desk.now.book': 'Kirja',
  'desk.now.station': 'Asema',
  'desk.now.onNow': 'Nyt lähetyksessä',
  'desk.now.information': 'Tiedot',
  'desk.now.zp.connecting': 'Yhdistetään...',
  'desk.now.zp.buffering': 'Käynnistetään...',
  'desk.now.zp.starting': 'Käynnistetään...',
  'desk.now.artist': 'Artisti',
  'desk.now.album': 'Albumi',
  'desk.now.song': 'Kappale [{n}/{total}]',
  'desk.now.songLabel': 'Kappale',
  'desk.now.infoOptions': 'Tiedot ja asetukset',
  'desk.now.thumbsUp': 'Peukku ylös',
  'desk.now.thumbsDown': 'Peukku alas',
  'desk.info.source': 'Lähde',
  'desk.info.room': 'Huone',
  'desk.info.duration': 'Kesto',
  'desk.info.station': 'Asema',
  'desk.info.addMyStations': 'Lisää Omiin radioasemiin',
  'desk.info.removeMyStations': 'Poista Omista radioasemista',
  'desk.radio.removedMine': 'Poistettiin Omista radioasemista: {title}',
  'desk.info.addMyShows': 'Lisää Omiin radio-ohjelmiin',
  'desk.radio.addedMine': 'Lisättiin Omiin radioasemiin: {title}',
  'desk.radio.addedShow': 'Lisättiin Omiin radio-ohjelmiin: {title}',
  'desk.radio.alreadyShow': '{title} on jo Omissa radio-ohjelmissa',
  'desk.radio.alreadyMine': '{title} on jo Omissa radioasemissa',
  'desk.info.startRadio': 'Aloita radio',
  'desk.info.addToServicePlaylist': 'Lisää kappale {service}-toistoluetteloon',
  'desk.info.saveToMusic': 'Tallenna musiikkiisi',
  'desk.info.addSongFavorite': 'Lisää kappale Sonos-suosikkeihin',
  'desk.info.removeFavorite': 'Poista Sonos-suosikeista',
  'desk.info.removedFavorite': 'Poistettiin Sonos-suosikeista: {title}',
  'desk.info.albumInfo': 'Albumin tiedot',
  'desk.info.artistInfo': 'Artistin tiedot',
  'desk.info.podcastInfo': 'Podcastin tiedot',
  'desk.info.provider': 'Tarjoaja',
  'desk.info.addEpisodeFavorite': 'Lisää jakso Sonos-suosikkeihin',
  'desk.info.addEpisodePlaylist': 'Lisää jakso Sonos-toistoluetteloon',
  'desk.info.actionDone': 'Valmis.',
  'desk.info.actionFailed': 'Palvelu hylkäsi pyynnön.',
  'desk.info.viewAllSongs': 'Näytä albumin kaikki kappaleet',
  'desk.info.addAlbumFavorite': 'Lisää albumi Sonos-suosikkeihin',
  'desk.info.addBookFavorite': 'Lisää kirja Sonos-suosikkeihin',
  'desk.info.addAlbumPlaylist': 'Lisää albumi Sonos-toistoluetteloon',
  'desk.info.addToSonosPlaylist': 'Lisää kappale Sonos-toistoluetteloon',
  'desk.info.addStationFavorite': 'Lisää asema Sonos-suosikkeihin',
  'desk.info.addedFavorite': '”{title}” lisättiin Sonos-suosikkeihin.',
  'desk.info.alreadyFavorite': '”{title}” on jo Sonos-suosikeissa.',
  'desk.queue.title': 'Jono',
  'desk.queue.notInUse': '(Ei käytössä)',
  'desk.queue.collapse': 'Näytä Nyt toistetaan',
  'desk.queue.expand': 'Laajenna jono',
  'desk.queue.songs.one': '{count} kappale',
  'desk.queue.songs.other': '{count} kappaletta',
  'desk.queue.empty': 'Jono on tyhjä',
  'win.queue.empty': 'Jono on tyhjä.',
  'win.queue.confirmTitle': 'Vahvista',
  'win.queue.confirmClear': 'Haluatko varmasti tyhjentää jonon?',
  'win.queue.clearAction': 'Tyhjennä',
  'desk.queue.clear': 'Tyhjennä jono',
  'desk.queue.save': 'Tallenna jono',
  'desk.queue.confirmClear': 'Tyhjennä jono',
  'desk.queue.playSong': 'Toista kappale',
  'desk.queue.removeSong': 'Poista kappale',
  'desk.queue.playEpisode': 'Toista jakso',
  'desk.queue.removeEpisode': 'Poista jakso',
  'desk.queue.playTrack': 'Toista kappale {n}',
  'desk.browse.root': 'Valitse musiikkilähde',
  'desk.browse.music': 'Musiikki',
  'desk.browse.favorites': 'Sonos-suosikit',
  'desk.browse.updateNow': 'Päivitä nyt',
  'desk.update.title': 'Päivitys saatavilla',
  'desk.update.body':
    'Sonos-kaiuttimille on valmiina päivitys: versio {version}. Musiikki '
    + 'pysähtyy jokaisessa huoneessa asennuksen ajaksi, ja se voi kestää '
    + 'useita minuutteja.',
  'desk.update.start': 'Päivitä',
  'desk.update.notNow': 'Ei nyt',
  'desk.update.started':
    'Päivitys on alkanut. Jokainen huone käynnistyy uudelleen, kun se on '
    + 'valmis.',
  'desk.browse.library': 'Musiikkikirjasto',
  'desk.browse.playlists': 'Sonos-toistoluettelot',
  'desk.browse.radio': 'TuneIn',
  'desk.browse.addServices': 'Lisää musiikkipalveluita',
  'desk.browse.addServicesFor': 'Lisää {gen}-musiikkipalveluita',
  'desk.browse.switchAccount': 'Vaihda tiliä',
  'desk.browse.sleepTimer': 'Uniajastin',
  'desk.browse.alarms': 'Hälytykset',
  'desk.browse.results': 'Tulokset: {query}',
  'desk.search.in': 'Etsi: {service}',
  'desk.search.clear': 'Tyhjennä haku',
  'desk.search.recent': 'Viimeisimmät haut',
  'desk.search.clearRecent': 'Tyhjennä viimeisimmät haut',
  'desk.search.scope': 'Valitse, mitä etsitään',
  'desk.browse.noResults':
    'Haku ei antanut tuloksia kohteelle ’{query}’. Käytä eri luokkaa tai '
    + 'uutta hakutermiä.',
  'desk.browse.selectRoom': 'Valitse huone, jolle selataan musiikkia.',
  'desk.browse.loading': 'Ladataan…',
  'desk.browse.empty': 'Valintoja ei ole käytettävissä.',
  'desk.browse.unableToBrowse': 'Musiikkia ei voi selata',
  'desk.browse.actions': 'Lisää valintoja',
  'desk.browse.select': 'Valitse',
  'desk.browse.needsLink.body':
    '{service} on yhdistetty Sonos {gen} -järjestelmääsi.\nJos haluat selata '
    + 'ja ohjata palvelua {service}, se on yhdistettävä myös Sonoraan. Tämä '
    + 'on erillinen kirjautuminen, eikä se muuta Sonos-sovellustasi.',
  'desk.browse.needsLink.action': 'Yhdistä {service} Sonoraan',
  'desk.actions.playNow': 'Toista nyt',
  'desk.actions.playNext': 'Toista seuraavaksi',
  'desk.actions.addToQueue': 'Lisää jonon loppuun',
  'desk.actions.addFavorite': 'Lisää Sonos-suosikkeihin',
  'desk.actions.unselectAll': 'Poista kaikki valinnat',
  'desk.actions.replaceQueue': 'Korvaa jono',
  'desk.favorites.addToSonosPlaylist': 'Lisää Sonos-toistoluetteloon',
  'desk.favorites.addToServicePlaylist': 'Lisää {service}-toistoluetteloon',
  'desk.favorites.rename': 'Nimeä Sonos-suosikki uudelleen',
  'desk.favorites.remove': 'Poista Sonos-suosikeista',
  'desk.favorites.renameBody': 'Anna tälle Sonos-suosikille uusi nimi:',
  'desk.favorites.removed': '”{title}” poistettiin Sonos-suosikeista.',
  'common.ok': 'OK',
  'desk.grouping.title': 'Ryhmitä huoneet',
  'desk.grouping.willPlay': 'Valitut huoneet toistavat:',
  'desk.grouping.select': 'Valitse ryhmitettävät huoneet:',
  'desk.grouping.partyMode': 'Valitse kaikki - juhlatila',
  'desk.grouping.noMusic': '[ei musiikkia]',
  'desk.grouping.chooseMusic': 'Valitse musiikki napsauttamalla Valmis',
  'desk.grouping.pickTitle': 'Valitse musiikki',
  'desk.grouping.pickHeading':
    'Valitse musiikki, jota toistetaan valitussa huoneessa',
  'desk.grouping.unselectAll': 'Poista kaikki valinnat',
  'desk.grouping.noneTitle': 'Huoneita ei ole valittu',
  'desk.grouping.noneBody': 'Tämä pysäyttää soivan musiikin. Haluatko jatkaa?',
  'desk.grouping.noneYes': 'Kyllä',
  'desk.prefs.title': 'Asetukset',
  'desk.prefs.general': 'Yleiset',
  'desk.prefs.basic': 'Perusasetukset',
  'desk.prefs.themeShot': 'Esikatselu teemasta {theme}',
  'desk.prefs.themeNoShot': 'Tälle teemalle ei ole esikatselua.',
  'desk.prefs.themeVersion': 'versio {version}',
  'desk.prefs.themeInstalled': 'asennettu',
  'desk.prefs.manageThemes': 'Hallitse teemoja',
  'desk.prefs.themeUpload': 'Asenna teema…',
  'desk.prefs.themeDelete': 'Poista teema',
  'desk.prefs.themeBuiltIn': 'Sonoran mukana tulevia teemoja ei voi poistaa.',
  'desk.room.nightSound': 'Yöääni',
  'desk.room.speech': 'Puheen korostus',
  'desk.room.sub': 'Subwoofer',
  'desk.room.subLevel': 'Subwooferin taso',
  'desk.room.surround': 'Surround',
  'desk.room.surroundLevel': 'TV:n taso',
  'desk.room.musicSurroundLevel': 'Musiikin taso',
  'desk.room.audioDelay': 'Äänen viive (huulisynkronointi)',
  'desk.room.heightLevel': 'Korkeustaso',
  'desk.room.lineInName': 'Linjatulolähteen nimi',
  'desk.room.lineInLevel': 'Linjatulolähteen taso',
  'desk.room.autoplayRoom': 'Automaattisen toiston huone',
  'desk.room.autoplayOff': 'Pois',
  'desk.room.autoplayLinked': 'Sisällytä ryhmähuoneet',
  'desk.room.autoplayUseVolume':
    'Käytä automaattisen toiston äänenvoimakkuutta',
  'desk.room.autoplayVolume': 'Automaattisen toiston äänenvoimakkuus',
  'desk.room.stereoPair': 'Stereopari',
  'desk.room.separate': 'Erota stereopari',
  'desk.room.separateBody':
    'Erotetaanko stereopari ”{room}” takaisin kahdeksi huoneeksi? Toisto '
    + 'pysähtyy, kun kaiuttimet muodostavat itsensä uudelleen.',
  'desk.room.pairWith': 'Valitse oikea kaiutin…',
  'desk.room.createPair': 'Luo stereopari',
  'desk.room.pairBody':
    'Tehdäänkö kaiuttimesta ”{left}” vasen kanava ja kaiuttimesta ”{right}” '
    + 'oikea kanava samaan stereopariin? Pari säilyttää nimen ”{left}”; '
    + 'toisto pysähtyy, kun kaiuttimet muodostavat itsensä uudelleen.',
  'desk.rooms.showMore': 'Näytä {n} lisää…',
  'desk.rooms.showLess': 'Näytä vähemmän…',
  'desk.rooms.allSystems': 'Kaikki',
  'desk.rooms.menu.play': 'Toista {name}',
  'desk.rooms.menu.pause': 'Tauota {name}',
  'desk.rooms.menu.stop': 'Pysäytä {name}',
  'desk.rooms.menu.mute': 'Mykistä {name}',
  'desk.rooms.menu.unmute': 'Poista kohteen {name} mykistys',
  'desk.rooms.menu.eq': '{name} EQ…',
  'desk.rooms.menu.group': 'Ryhmitä',
  'desk.prefs.musicLibrary': 'Musiikkikirjaston asetukset',
  'desk.prefs.services': 'Palveluasetukset',
  'desk.prefs.parental': 'Lapsilukko',
  'desk.prefs.dateTime': 'Päivämäärä- ja aika-asetukset',
  // The Mac Preferences window (S1 57.x on Tahoe, 2026-09-15).
  'desk.prefs.eqSettings': 'EQ-asetukset',
  'desk.prefs.musicLibraryShort': 'Musiikkikirjasto',
  'desk.prefs.servicesShort': 'Palvelut',
  'desk.prefs.dateTimeShort': 'Päivämäärä ja aika',
  'desk.prefs.sonora': 'Sonora',
  'desk.prefs.mobileNote':
    'Hallitse järjestelmääsi avaamalla Sonos-sovellus mobiililaitteessa.',
  'desk.prefs.getMobileApp': 'Hanki mobiilisovellus',
  'desk.prefs.eqFor': 'Musiikin EQ-asetukset kohteelle',
  'desk.prefs.eqCaption': 'Säädä diskantti ja basso makusi mukaan.',
  'desk.prefs.roomFor': 'Huoneasetukset kohteelle',
  'desk.prefs.noRooms': 'Sonos-huoneita ei löytynyt.',
  'desk.prefs.folderCol': 'Kansio',
  'desk.prefs.pathCol': 'Polku',
  'desk.prefs.serviceNameCol': 'Palvelun nimi',
  'desk.prefs.nameCol': 'Nimi',
  'desk.prefs.loginCol': 'Tilin käyttäjätunnus',
  'desk.prefs.anonymous': '<Nimetön>',
  'desk.prefs.changeName': 'Muuta nimeä',
  'desk.prefs.reauthorize': 'Valtuuta tili uudelleen',
  'desk.prefs.visitLabs': 'Käy Sonos Labsissa',
  'desk.menu.settings': 'Asetukset…',
  // The Mac app's sheets and About window (2026-09-15).
  'desk.queue.confirmTitle': 'Vahvista',
  'desk.queue.clearBody': 'Haluatko varmasti tyhjentää jonon?',
  'desk.queue.enterName': 'Anna uuden soittolistan nimi:',
  'desk.queue.orReplace': 'Tai valitse korvattava Sonos-soittolista:',
  'desk.sleep.setFor': 'Aseta uniajastin huoneelle ”{room}”:',
  'desk.about.sonosOs': 'Sonos OS',
  'desk.about.products': 'Tuotteet',
  'desk.about.systemLine': 'Sonos OS {gen}: tuotteita {count}',
  'desk.about.serial': 'Sarjanumero',
  'desk.about.hardware': 'Laitteistoversio',
  'desk.about.series': 'Sarjatunnus',
  'desk.about.ip': 'IP-osoite',
  'desk.about.wm': 'WM',
  'desk.about.copy': 'Kopioi',
  'desk.about.copied': 'Kopioitu',
  'desk.alarms.note':
    'Hälytykset luodaan ja niitä muokataan Sonos-sovelluksessa; täällä ne '
    + 'voi kytkeä päälle tai pois ja poistaa.',
  'desk.alarms.deleteBody': 'Poistetaanko hälytys {time} huoneesta {room}?',
  'desk.alarms.deleteTitle': 'Poista hälytys',
  'desk.alarms.recurrence.WEEKENDS': 'Viikonloppuisin',
  'desk.alarms.recurrence.WEEKDAYS': 'Arkipäivisin',
  'desk.alarms.recurrence.DAILY': 'Joka päivä',
  'desk.alarms.recurrence.ONCE': 'Kerran',
  'desk.alarms.repeat': 'Toisto',
  'desk.alarms.room': 'Huone',
  'desk.alarms.time': 'Aika',
  'desk.alarms.enabled': 'Päällä',
  'desk.alarms.delete': 'Poista',
  'desk.alarms.none': 'Tässä järjestelmässä ei ole hälytyksiä.',
  'win.saveQueue.name': 'Anna uuden soittolistan nimi:',
  'win.saveQueue.replace': 'Tai valitse korvattava Sonos-soittolista:',
  'win.alarm.addTitle': 'Lisää hälytys',
  'win.alarm.editTitle': 'Muokkaa hälytystä',
  'win.alarm.alarm': 'Hälytys',
  'win.alarm.on': 'Päällä',
  'win.alarm.off': 'Pois',
  'win.alarm.music': 'Musiikki',
  'win.alarm.select': 'Valitse…',
  'win.alarm.schedule': 'Aikataulu',
  'win.alarm.onceOnly': 'Vain kerran',
  'win.alarm.volume': 'Äänenvoimakkuus',
  'win.alarm.duration': 'Kesto',
  'win.alarm.noLimit': 'Ei rajoitusta',
  'win.alarm.linked': 'Sisällytä ryhmitetyt huoneet',
  'win.alarm.shuffle': 'Toista satunnaisessa järjestyksessä',
  'win.alarm.chime': 'Sonos-merkkiääni',
  'win.alarm.browseTitle': 'Valitse hälytysmusiikki selaamalla',
  'win.alarm.alarmMusic': 'Hälytysmusiikki',
  'win.alarm.importedPlaylists': 'Tuodut toistoluettelot',
  'win.alarm.setMusic': 'Aseta hälytysmusiikki',
  'win.alarm.day.1': 'maanantai',
  'win.alarm.day.2': 'tiistai',
  'win.alarm.day.3': 'keskiviikko',
  'win.alarm.day.4': 'torstai',
  'win.alarm.day.5': 'perjantai',
  'win.alarm.day.6': 'lauantai',
  'win.alarm.day.0': 'sunnuntai',
  'win.alarms.manage': 'Hallitse Sonos-hälytyksiä',
  'win.alarms.currentTime': 'Nykyinen aika: {time}',
  'desk.alarms.currentTime': 'Nykyinen aika: {date} - {time} {zone}',
  'win.alarms.where': 'Missä',
  'win.alarms.when': 'Milloin',
  'win.alarms.on': 'PÄÄLLÄ',
  'win.alarms.add': 'Lisää',
  'win.alarms.edit': 'Muokkaa',
  'win.alarms.remove': 'Poista',
  'win.alarms.deleteConfirm': 'Haluatko varmasti poistaa tämän hälytyksen?',
  'win.alarms.help1': 'Lisää uusi hälytys napsauttamalla Lisää.',
  'win.alarms.help2': 'Poista valittu hälytys napsauttamalla Poista.',
  'desk.alarms.day.0': 'Su',
  'desk.alarms.day.1': 'Ma',
  'desk.alarms.day.2': 'Ti',
  'desk.alarms.day.3': 'Ke',
  'desk.alarms.day.4': 'To',
  'desk.alarms.day.5': 'Pe',
  'desk.alarms.day.6': 'La',
  'desk.queue.saveHint': 'Toistoluettelon nimi',
  'desk.queue.saveBody': 'Jono tallennetaan Sonos-soittolistaksi.',
  'desk.queue.saveTitle': 'Tallenna jono',
  'desk.queue.mixName': '{part}miksaus, {weekday}',
  'desk.queue.part.morning': 'Aamu',
  'desk.queue.part.afternoon': 'Iltapäivä',
  'desk.queue.part.night': 'Ilta',
  'desk.sleep.none': 'Uniajastinta ei ole asetettu.',
  'desk.sleep.elsewhere': 'Käynnissä myös muualla',
  'desk.sleep.remaining': 'Uniajastin: {time} jäljellä',
  'desk.sleep.minutes': '{count} minuuttia',
  'desk.sleep.off': 'Pois',
  'desk.sleep.hours.one': '{count} tunti',
  'desk.sleep.hours.other': '{count} tuntia',
  'services.needsSignIn':
    '{service} vaatii kirjautumisen, ennen kuin se näyttää mitään. Yhdistä '
    + 'se Sonoraan, niin voit selata sitä täällä. Kaikki siitä '
    + 'Sonos-suosikkeihin tai Sonos-toistoluetteloihin tallennettu soi silti.',
  'desk.library.folders': 'Kansiot',
  'desk.library.advanced': 'Lisäasetukset',
  'desk.library.mine': 'Omat musiikkikansioni Sonosissa',
  'desk.library.none':
    'Tähän Sonos-järjestelmään ei ole lisätty musiikkikansioita.',
  'desk.library.addFolder': 'Lisää…',
  'desk.library.add': 'Lisää',
  'desk.library.remove': 'Poista',
  'desk.library.pathHint': '//nas/Music',
  'desk.library.pathNote':
    'Sonora lisää kansiot niiden verkkopolun perusteella (esimerkiksi '
    + '//nas/Music). Kansion on oltava jo jaettu verkossasi. S1-soittimet '
    + 'voivat käyttää vain SMBv1-jakoja; S2-soittimet osaavat myös SMBv2:n ja '
    + 'SMBv3:n.',
  'desk.shareWizard.windowTitle': 'Sonoran käyttöönotto',
  'desk.shareWizard.whereTitle': 'Lisää musiikkikansio',
  'desk.shareWizard.wherePrompt': 'Missä on musiikki, jota haluat toistaa Sonosilla?',
  'desk.shareWizard.myMusic': 'Musiikki-kansio',
  'desk.shareWizard.otherFolder': 'Toinen kansio tai tietokoneeseeni liitetty asema',
  'desk.shareWizard.network': 'Verkkolaite (esim. NAS-asema)',
  'desk.shareWizard.serverNote': 'Sonora toimii palvelimella, joten tämän tietokoneen kansiot ovat sen ulottumattomissa: se voi lisätä verkossa jaetun kansion.',
  'desk.shareWizard.pathTitle': 'Lisää musiikkia verkkojaosta',
  'desk.shareWizard.pathPrompt': 'Kirjoita verkkojaon polku:',
  'desk.shareWizard.loginTitle': 'Käyttäjätunnus ja salasana',
  'desk.shareWizard.loginPrompt': 'Anna musiikkisi sisältävän verkkoaseman käyttäjätunnus ja salasana. Jätä molemmat tyhjiksi, jos jako ei kysy niitä.',
  'desk.shareWizard.fieldLabel': '{label}:',
  'desk.shareWizard.adding': 'Lisätään jaon tiedot Sonos-järjestelmään.',
  'desk.shareWizard.done': '”{path}” on nyt otettu käyttöön Sonos-järjestelmässäsi. Sen musiikkia lisätään kirjastoon.',
  'desk.shareWizard.failedTitle': 'Sonos ei voinut lisätä musiikkikansiota',
  'desk.shareWizard.pathExamples': 'Esimerkkejä:\n\\\\MyOtherComputer\\Shared\\Music\n\\\\MyNetworkedStorage\\Shared\\Music',
  'desk.library.username': 'Käyttäjänimi',
  'desk.library.password': 'Salasana',
  'desk.library.credHint':
    'Jätä molemmat tyhjiksi vain, jos jako sallii vieraat. Monet palvelimet '
    + 'eivät enää salli.',
  'desk.library.removeTitle': 'Poista musiikkikansio',
  'desk.library.removeBody':
    'Poistetaanko {folder} Sonos-järjestelmäsi musiikkikirjastosta? Sen '
    + 'musiikki ei enää näy Sonosissa.',
  'desk.library.indexTitle': 'Kirjaston päivitykset',
  'desk.library.schedule': 'Päivitä musiikkihakemisto joka päivä klo',
  'desk.library.updateNow': 'Päivitä musiikkihakemisto nyt',
  'desk.library.noFolders': 'Et ole vielä lisännyt Sonos-järjestelmääsi yhtään musiikkikansiota.',
  'desk.library.addHint': 'Lisää musiikkia Sonosiin valitsemalla {menu}-valikosta {link}.',
  'desk.library.working': 'Päivitetään musiikkikirjaston asetuksia…',
  'desk.library.indexing': 'Päivitetään musiikkikirjastoa… Odota.',
  'desk.library.indexError':
    'Sonos ei voinut viimeistellä musiikkihakemiston päivitystä: {error}',
  'desk.library.addPending':
    'Sonos lisää kansiota vielä. Se näkyy täällä, kun soittimet ovat '
    + 'liittäneet sen.',
  'desk.library.adding': 'Lisätään musiikkikansiota',
  'desk.library.addedIndexing':
    'Lisätty. Sonos päivittää musiikkihakemistoa, mikä voi kestää suurella '
    + 'kansiolla useita minuutteja.',
  'desk.library.addingPath':
    '{path}: soittimet liittävät sitä. Tämä voi kestää suurella kansiolla '
    + 'useita minuutteja.',
  'desk.library.addFailed':
    'Sonos ei pystynyt lisäämään musiikkikansiota {path}.',
  'desk.library.addFailedWhy':
    'Tarkista, että kansion polku sekä tarvittaessa käyttäjänimi ja '
    + 'salasana ovat oikein.',
  'desk.library.addReason': 'Syy: {reason}',
  'desk.library.compilations': 'Ryhmitä albumit käyttäen',
  'desk.library.updateDaily': 'Päivitä sisältö joka päivä klo:',
  'desk.library.showContributing':
    'Näytä avustavat artistit musiikkikirjastossa. Tämä asetus vaikuttaa '
    + 'vain tähän ohjaimeen.',
  'desk.library.sortFolders': 'Lajittele kansiot',
  'desk.library.sort.songNumber': 'Kappaleen numero',
  'desk.library.sort.songName': 'Kappaleen nimi',
  'desk.library.sort.fileName': 'Tiedostonimi',
  'desk.library.artists': 'Artistit',
  'desk.library.contributingArtists': 'Avustavat artistit',
  'desk.library.albums': 'Albumit',
  'desk.library.composers': 'Säveltäjät',
  'desk.library.genres': 'Tyylilajit',
  'desk.library.songs': 'Kappaleet',
  'desk.library.importedPlaylists': 'Tuodut toistoluettelot',
  'desk.library.foldersNode': 'Kansiot',
  'desk.library.groupBy': 'Ryhmitä kokoelmat käyttäen',
  'desk.library.group.ITUNES': 'iTunes®-kokoelmat',
  'desk.library.group.WMP': 'Albumin artistit',
  'desk.library.group.NONE': 'Älä ryhmitä kokoelmia',
  'desk.library.compilationsNote':
    'Kokoelmien ryhmittelytavan muuttaminen päivittää musiikkihakemiston.',
  'desk.time.timeZone': 'Aikavyöhyke',
  'desk.time.autoDst': 'Siirry kesäaikaan automaattisesti',
  'desk.time.internet': 'Aseta päivämäärä ja aika internetistä',
  'desk.time.date': 'Päivämäärä',
  'desk.time.time': 'Aika',
  'desk.time.dateFormat': 'Päivämäärän muoto',
  'desk.time.timeFormat': 'Ajan muoto',
  'desk.time.fmt.MDY': 'Kuukausi/päivä/vuosi',
  'desk.time.fmt.DMY': 'Päivä/kuukausi/vuosi',
  'desk.time.fmt.YMD': 'Vuosi/kuukausi/päivä',
  'desk.time.fmt.12H': '12 tuntia',
  'desk.time.fmt.24H': '24 tuntia',
  'desk.time.notSet': 'Ei asetettu',
  'desk.time.setNow': 'Aseta',
  'desk.time.loading': 'Luetaan aika-asetuksia…',
  'desk.time.server': 'Aikapalvelin: {server}',
  'desk.parental.body':
    'Sensuroimattoman sisällön suodatus on Sonos-järjestelmäsi oma asetus, '
    + 'ja se on yhteinen kaikille sitä ohjaaville sovelluksille. Sonora lukee '
    + 'sen kaiuttimista ja näyttää sen alla.\nSen muuttaminen vaatii '
    + 'tunnistetiedon, jonka Sonos myöntää vain omille sovelluksilleen: '
    + 'kaiuttimet ottavat muutoksen vastaan miltä tahansa ohjaimelta, mutta '
    + 'vain Sonos-sovellukselle luodulla tunnuksella, ja ainoa lupa, jonka '
    + 'Sonos tarjoaa muille kehittäjille, kattaa pelkän toiston. '
    + 'Sonos-sovellus pystyy siihen; tämä sovellus odottaa Sonosin '
    + 'vastausta.\nKaikki palvelut eivät tue sisällön suodatusta.',
  'desk.parental.filter': 'Suodata sensuroimaton sisältö',
  'desk.parental.filterFor': 'Suodata sensuroimaton sisältö: {system}',
  'desk.parental.on': 'Sisältösuodattimet päällä',
  'desk.parental.off': 'Sisältösuodattimet pois',
  'desk.parental.unknown': 'Sisältösuodattimia ei voitu lukea',
  'desk.parental.reading': 'Luetaan asetusta…',
  'desk.parental.turnOn': 'Ota sopimattoman sisällön suodatus käyttöön',
  'desk.parental.moreInfo': 'Lisätietoja',
  'desk.parental.unavailable':
    'Sonos sallii tämän muuttamisen vain omissa sovelluksissaan',
  'desk.prefs.roomSettings': 'Huoneasetukset',
  'desk.prefs.settingsFor': 'Asetukset kohteelle {room}',
  'desk.prefs.musicEq': 'Musiikin taajuuskorjain',
  'desk.prefs.device': 'Laite',
  'desk.prefs.bass': 'Basso',
  'desk.prefs.treble': 'Diskantti',
  'desk.prefs.balance': 'Tasapaino',
  'desk.prefs.left': 'V',
  'desk.prefs.right': 'O',
  'desk.prefs.loudness': 'Loudness',
  'desk.prefs.reset': 'Palauta',
  'desk.prefs.eqFixed':
    'Taajuuskorjaimen asetukset eivät ole käytettävissä, kun '
    + 'Sonos-kaiuttimen linjalähdön taso on Kiinteä.',
  'desk.prefs.roomName': 'Huoneen nimi',
  'desk.prefs.apply': 'Käytä',
  'desk.prefs.statusLight': 'Merkkivalo',
  'desk.prefs.on': 'Päällä',
  'desk.prefs.off': 'Pois',
  'desk.prefs.servicesTitle': 'Palvelutilini Sonosissa',
  'desk.prefs.servicesSignIn':
    'Määritettyjä palveluita ei näy. Sonora lukee ne suoraan kaiuttimista, '
    + 'joten yleensä tämä tarkoittaa, ettei mihinkään saatu yhteyttä.',
  'desk.about.title': 'Tietoja Sonos-järjestelmästäni',
  'desk.about.body': 'Tämän verkon kaiuttimet järjestelmittäin.',
  'desk.about.model': 'Malli',
  'desk.about.version': 'Versio',
  'desk.about.address': 'Osoite',
  'desk.about.speakers': 'Kaiuttimet',
  'desk.about.system': 'Järjestelmä',
  'desk.shortcuts.title': 'Pikanäppäimet',
  'desk.shortcuts.playPause': 'Toista/tauko',
  'desk.shortcuts.volUp': 'Lisää äänenvoimakkuutta',
  'desk.shortcuts.volDown': 'Vähennä äänenvoimakkuutta',
  'desk.shortcuts.mute': 'Mykistä nykyinen huone/ryhmä tai poista mykistys',
  'desk.shortcuts.nextZone': 'Valitse seuraava huoneryhmä',
  'desk.shortcuts.prevZone': 'Valitse edellinen huoneryhmä',
  'notice.cannotPlay.title': 'Toisto ei onnistunut',
  'notice.cannotPlay.detail':
    '{room} ei voinut toistaa kohdetta {item}. {reason}',
  'notice.cannotPlay.stream':
    '{room} ei voinut toistaa kohdetta {item}: palvelimelta {host} ei '
    + 'tullut mitään. {reason}',
  'notice.cannotPlay.format': 'Kaiutin ei tue tätä muotoa.',
  'notice.cannotPlay.connect': 'Kaiutin ei saanut siihen yhteyttä.',
  'notice.cannotPlay.refused': 'Palvelu kieltäytyi toistamasta sitä.',
  'notice.cannotPlay.missing': 'Sitä ei ole enää olemassa.',
  'notice.cannotPlay.permission': 'Tällä tilillä ei ole lupaa toistaa sitä.',
  'notice.notPlaying.title': 'Mitään ei alkanut soida',
  'notice.notPlaying.detail':
    '{room} hyväksyi toistokomennon mutta pysähtyi taas. Sen nykyistä '
    + 'lähdettä ei voitu toistaa; valitse jotain muuta musiikkiruudusta.',
  'notice.notPlaying.stream':
    '{room} hyväksyi toistokomennon mutta pysähtyi taas. Sen lähde on virta '
    + 'palvelimelta {host}, joka näyttää olevan offline-tilassa.',
  'desk.menu.quit': 'Lopeta Sonos',
  'desk.menu.delete': 'Poista',
  'desk.menu.selectAll': 'Valitse kaikki',
  'desk.menu.fullScreen': 'Siirry koko näyttöön',
  'desk.menu.updatePlaylists': 'Päivitä iTunes-soittolistat nyt',
  'desk.menu.updateAlbumArt': 'Päivitä albumikuvat nyt',
  'desk.menu.window': 'Ikkuna',
  'desk.menu.close': 'Sulje',
  'desk.menu.uninstall': 'Poista asennus…',
  'desk.menu.services': 'Palvelut',
  'desk.menu.hideSonos': 'Kätke Sonos',
  'desk.menu.hideOthers': 'Kätke muut',
  'desk.menu.showAll': 'Näytä kaikki',
  'desk.menu.autofill': 'Automaattitäyttö',
  'desk.menu.dictation': 'Aloita sanelu…',
  'desk.menu.emoji': 'Emojit ja symbolit',
  'desk.menu.fill': 'Täytä',
  'desk.menu.center': 'Keskitä',
  'desk.menu.moveResize': 'Siirrä ja muuta kokoa',
  'desk.menu.fullScreenTile': 'Koko näytön ruutu',
  'desk.menu.removeFromSet': 'Poista ikkuna joukosta',
  'win.menu.file': 'Tiedosto',
  'win.menu.exit': 'Lopeta',
  'win.menu.showMini': 'Näytä mini-ohjain',
  'win.shortcuts.toggleMini': 'Mini-ohjain päälle/pois',
  'win.setup.title': 'Sonoran asennus',
  'win.setup.lib.pathTitle': 'Lisää musiikkia verkkojaosta',
  'win.setup.lib.pathText': 'Kirjoita verkkojaon polku:',
  'win.setup.lib.examples': 'Esimerkit:',
  'win.setup.lib.browse': 'Selaa',
  'win.setup.lib.credTitle': 'Käyttäjätunnus ja salasana',
  'win.setup.lib.credText':
    'Anna musiikkia sisältävän verkkoaseman käyttäjänimi ja salasana, jos '
    + 'niitä on:',
  'win.setup.lib.username': 'Käyttäjätunnus:',
  'win.setup.lib.password': 'Salasana:',
  'win.setup.lib.adding': 'Lisätään musiikkikansiota',
  'win.setup.lib.doneTitle': 'Musiikkikirjaston määritys',
  'win.setup.lib.doneSetUp':
    '”{folder}” on nyt asennettu Sonos-järjestelmääsi.',
  'win.setup.lib.doneAdding':
    'Musiikkiasi lisätään nyt Sonos-järjestelmääsi. Tämä voi kestää useita '
    + 'minuutteja.',
  'win.setup.lib.doneNotice':
    'Voit lisätä musiikkia Sonosiin myöhemmin kohdasta ”Hallitse '
    + 'musiikkikirjastoa” asetuksissa.',
  'win.setup.lib.errorTitle': 'Virhe musiikkia lisättäessä',
  'win.setup.lib.errorMessage': 'Sonos ei pystynyt lisäämään musiikkikansiota',
  'win.setup.lib.errorDetails':
    'Tarkista, että kansion polku sekä tarvittaessa käyttäjänimi ja '
    + 'salasana ovat oikein.',
  'win.setup.lib.errorReason': 'Syy: {reason}',
  'win.services.addHint':
    'Lisää uusi palvelu Sonos-järjestelmääsi napsauttamalla ’Lisää’.',
  'win.services.labsHint':
    'Kokeile Sonos-järjestelmääsi tulevia palveluita napsauttamalla ’Sonos '
    + 'Labs’.',
  'win.services.serviceName': 'Palvelun nimi',
  'win.services.name': 'Nimi',
  'win.services.login': 'Tilin käyttäjätunnus',
  'win.services.anonymous': '<Nimetön>',
  'win.services.add': 'Lisää',
  'win.services.signInWith': 'Kirjaudu: {service}',
  'win.services.labs': 'Sonos Labs',
  'win.services.addTitle': 'Lisää palvelu',
  'win.services.labsTitle': 'Tervetuloa Sonos Labsiin',
  'win.services.labsPrompt':
    'Valitse Sonos Labs -palvelu, jonka haluat lisätä:',
  'win.services.labsSignedOut':
    'Kirjaudu Sonos-tilillesi nähdäksesi Sonos Labs -palvelut.',
  'win.services.labsFailed':
    'Sonos Labs -palveluiden luetteloa ei voitu hakea: {error}',
  'win.services.edit': 'Muokkaa',
  'win.services.editTitle': 'Muokkaa palvelua',
  'win.services.editHeading': 'Muokkaa {service}-tiliä',
  'win.services.editPrompt': 'Anna tilin nimi:',
  'win.services.editName': 'Nimi:',
  'win.services.replace': 'Korvaa',
  'win.services.reauthorize': 'Valtuuta uudelleen',
  'win.services.removeTitle': 'Poista tili',
  'win.services.removeBody':
    'Haluatko varmasti poistaa tämän {service}-tilin '
    + 'Sonos-järjestelmästäsi?',
  'win.eq.tab': 'EQ',
  'win.eq.intro': 'Säädä diskantti ja basso makusi mukaan.',
  'win.errorLog.title': 'Sonora-järjestelmän virheloki',
  'desk.errorLog.empty': 'Virheitä ei ole kirjattu viimeisten seitsemän päivän aikana.',
  'win.library.title': 'Omat musiikkikansiot Sonos-järjestelmässä',
  'win.library.addHint':
    'Lisää uusi musiikkikansio Sonos-järjestelmääsi napsauttamalla ’Lisää’.',
  'win.library.removeHint':
    'Poista korostettu kansio napsauttamalla ’Poista’.',
  'win.library.name': 'Nimi',
  'win.library.path': 'Polku',
  // The Windows app's own two lines while the library updates.
  'win.library.indexing1': 'Päivitetään musiikkikirjastoa…',
  'win.library.indexing2': 'Odota.',
  'win.mini.noMusic': '[ei musiikkia]',
  'win.mini.volume': 'Äänenvoimakkuus',
  'win.mini.larger': 'Suurempi',
  'win.mini.smaller': 'Pienempi',
  'win.menu.checkUpdates': 'Tarkista ohjelmistopäivitykset…',
  'win.menu.changeLanguage': 'Vaihda kieltä…',
  'win.menu.settings': 'Asetukset…',
  'win.settings.title': 'Asetukset',
  'win.sleep.title': 'Uniajastin ({state})',
  'win.sleep.choose': 'Valitse uniajastimen kesto huoneelle "{room}":',
  'desk.window.controller': 'Sonora {systems} -ohjain',
  'win.about.title': 'Tietoja',
  'win.about.version': 'Versio:',
  'win.about.os': 'Sonos OS:',
  'win.about.license': 'Lisenssi:',
  'win.about.system': 'Sonos {gen} -järjestelmä:',
  'win.about.serial': 'Sarjanumero',
  'win.about.ip': 'IP-osoite',
  'win.about.associated': 'Liitetty tuote:',
  'win.about.hardware': 'Laitteistoversio',
  'win.about.series': 'Sarjatunnus',
  'win.about.wm': 'WM',
  'win.shortcuts.intro': 'Sonora tukee seuraavia näppäimistön pikavalintoja:',
  'win.shortcuts.function': 'Toiminto',
  'win.shortcuts.shortcut': 'Pikanäppäin',
  'win.shortcuts.toggleShuffle': 'Satunnaistoisto päälle/pois',
  'win.shortcuts.toggleRepeat': 'Uudelleentoisto päälle/pois',
  'win.shortcuts.muteAll': 'Mykistä kaikki',
  'win.shortcuts.topMenu': 'Palaa musiikkivalikon ylätasolle',
  'win.shortcuts.favorites': 'Siirry suosikkeihin',
  'win.shortcuts.toggleCrossfade': 'Ristihäivytys päälle/pois',
  'win.shortcuts.scrollCurrent': 'Vieritä jonossa nykyiseen kappaleeseen',
  'win.shortcuts.closeWindow': 'Sulje aktiivinen ikkuna',
  'win.shortcuts.browserNote':
    'Kolme näistä poikkeaa Sonos-sovelluksesta: selain varaa itselleen '
    + 'Ctrl+T:n, Ctrl+L:n ja Ctrl+W:n.',
  'win.shortcuts.jumpSearch': 'Siirry hakukenttään',
  'win.shortcuts.playNext': 'Toista valittu kappale seuraavaksi',
  'win.shortcuts.replaceQueue': 'Korvaa jono valinnalla',
  'win.shortcuts.playLater': 'Toista valinta myöhemmin',
  'win.shortcuts.resizeQueue': 'Muuta jonon kokoa',
  'win.shortcuts.prevTrack': 'Edellinen kappale',
  'win.shortcuts.nextTrack': 'Seuraava kappale',
  'win.shortcuts.showShortcuts': 'Näytä pikavalintaluettelo',
  'win.settings.sonora': 'Sonora',
  'win.parental.title': 'Lapsilukko',
  'win.parental.enabled':
    'Sopimattoman sisällön suodatus on käytössä. Napsauta alla olevaa '
    + 'painiketta, jos haluat sallia sopimattoman sisällön toiston '
    + 'Sonos-järjestelmässäsi.\n\nKaikki palvelut eivät tue sisällön '
    + 'suodatusta.',
  'win.parental.disabled':
    'Sopimattoman sisällön suodatus ei ole käytössä. Napsauta alla olevaa '
    + 'painiketta, jos haluat estää sopimattoman sisällön toiston '
    + 'Sonos-järjestelmässäsi.\n\nKaikki palvelut eivät tue sisällön '
    + 'suodatusta.',
  'win.parental.noServices':
    'Sonos-järjestelmässäsi ei ole musiikkipalveluita, jotka tukevat '
    + 'sisällön suodatusta.',
  'win.parental.unreadable':
    'Järjestelmä ei kertonut, onko sensuroimattoman sisällön suodatus '
    + 'päällä.',
  'win.parental.turnOn': 'Ota sopimattoman sisällön suodatus käyttöön',
  'win.parental.turnOff': 'Poista sopimattoman sisällön suodatus käytöstä',
  'win.parental.moreInfo': 'Lisätietoja',
  'win.settings.eq': 'EQ-asetukset',
  'win.settings.library': 'Musiikkikirjasto',
  'win.settings.services': 'Palvelut',
  'win.settings.eqFor': 'EQ-asetukset kohteelle',
  'win.settings.mobileNote':
    'Hallitse järjestelmääsi avaamalla Sonos-sovellus mobiililaitteessa.',
  'win.settings.getApp': 'Hanki mobiilisovellus',
  'win.maximize': 'Suurenna',
  'win.restore': 'Palauta',
  'desk.menu.minimize': 'Pienennä',
  'desk.menu.zoom': 'Zoomaa',
  'desk.menu.bringAllToFront': 'Tuo kaikki eteen',
  'desk.menu.shop': 'Osta Sonos-tuotteita',
  'desk.menu.firewallHelp': 'Palomuurin määritysohje',
  'desk.menu.errorLog': 'Virheloki',
  'desk.menu.reset': 'Nollaa ohjain',
  'desk.menu.forget': 'Unohda nykyinen Sonos-järjestelmä',
  'desk.window.title': 'Sonora',
  'desk.add.title': 'Lisää musiikkipalveluita',
  'desk.add.button': 'Lisää…',
  'desk.add.intro': 'Valitse palvelu, jonka lisäät Sonos-järjestelmääsi.',
  'win.addService.title': 'Lisää palvelu',
  'win.addService.heading': 'Käytettävissä olevat palvelut',
  'win.addService.intro': 'Valitse palvelu, jonka haluat lisätä Sonos-järjestelmääsi.',
  'desk.add.auth.Anonymous': 'Tiliä ei tarvita',
  'desk.add.appOnly': 'Vain Sonos-sovellus',
  'desk.add.another': 'Toinen tili',
  'desk.add.unpairable':
    '{service} voidaan lisätä vain virallisella Sonos-sovelluksella: '
    + 'palveluntarjoaja ei kirjaa sisään muuta kuin Sonosin ohjainta.',
  'desk.add.auth.DeviceLink': 'Kirjaudu palveluntarjoajan sivustolla',
  'desk.add.auth.AppLink':
    'Kirjaudu palveluntarjoajan sivustolla, jos mahdollista',
  'desk.add.needsApp':
    '{service} ei salli kirjautumista Sonorasta; palveluntarjoaja hyväksyy '
    + 'kirjautumisen vain virallisen Sonos-sovelluksen kautta. Lisää palvelu '
    + 'siellä käyttääksesi sitä Sonos-sovelluksissa. Kaikki siitä '
    + 'Sonos-suosikkeihin tai Sonos-toistoluetteloihin tallennettu soi silti '
    + 'Sonorassa.',
  'desk.add.instructions':
    'Mene osoitteeseen {url}, kirjaudu sisään ja anna tämä koodi:',
  'desk.add.instructionsNoCode':
    'Mene osoitteeseen {url} ja kirjaudu sisään valtuuttaaksesi Sonosin.',
  'desk.add.open': 'Avaa selaimessa',
  'desk.add.waiting': 'Odotetaan vahvistusta: {service}…',
  'desk.add.authorizeTitle': 'Lisää {service}-tili',
  'desk.add.authorizeBody': 'Kirjaudu {service}-palveluun selaimessa, niin Sonos voi käyttää tiliäsi.',
  'desk.add.authorize': 'Valtuuta',
  'desk.add.doneSystem.multi':
    '{service} on lisätty {gen}-järjestelmääsi ja on valmiina '
    + '{gen}-laitteillasi, Sonorassa ja virallisessa Sonos-sovelluksessa. Jos '
    + 'haluat käyttää sitä myös {other}-laitteillasi, lisää se uudelleen '
    + 'kohdasta {link}.',
  'desk.add.doneSystem.solo':
    '{service} on lisätty Sonos-järjestelmääsi ja on valmiina laitteillasi, '
    + 'Sonorassa ja virallisessa Sonos-sovelluksessa.',
  'desk.add.doneAnon.multi':
    '{service} on nyt käytettävissä Sonorassa {gen}-laitteillasi. Sitä ei '
    + 'voitu lisätä Sonos-järjestelmääsi, joten se ei näy '
    + 'Sonos-sovelluksissa. Jos haluat käyttää sitä Sonorassa '
    + '{other}-laitteillasi, lisää se uudelleen kohdasta {link}.',
  'desk.add.doneAnon.solo':
    '{service} on nyt käytettävissä Sonorassa laitteillasi. Sitä ei voitu '
    + 'lisätä Sonos-järjestelmääsi, joten se ei näy Sonos-sovelluksissa.',
  'desk.add.failed': 'Palvelun {service} lisääminen epäonnistui: {error}',
  // --- About dialog ------------------------------------------------------
  'about.title': 'Tietoja Sonorasta',
  'about.menu': 'Tietoja Sonorasta',
  'about.version': 'Versio {version}',
  'about.tagline': 'Itse ylläpidettävä verkko-ohjain kaikille Sonos-kaiuttimille.',
  'about.pointLocal': 'Ohjaus ensisijaisesti paikallisesti',
  'about.pointThemes': 'Viimeistellyt teemat',
  'about.pointNetwork': 'Verkon vianmääritys',
  'about.pointUpgrade': 'Laitepäivitysneuvoja',
  'about.pointMore': 'Ja paljon muuta…',
  'about.license': 'Sonora on vapaa ohjelmisto, julkaistu {license}-lisenssillä.',
  'about.github': 'Näytä GitHubissa',
  'about.thirdParty': 'Kolmansien osapuolten lisenssit',
  'about.support': 'Tue Sonoraa',
  'about.supportNote': 'Jos Sonora on sinulle hyödyllinen, harkitse projektin tukemista.',
  'about.trademark': 'Sonora ei ole Sonosin kanssa sidoksissa eikä Sonosin hyväksymä.\nSonos on Sonos, Inc:n tavaramerkki.',
  'desk.showSystem': 'Näytä järjestelmä',
  'desk.services.tab': '{system}-palvelut',
  'desk.add.starting': 'Pyydetään kirjautumislinkkiä: {service}…',
  'desk.add.linking': 'Yhdistetään: {service}…',
  // --- removing a music service (every theme) --------------------------------
  'services.remove': 'Poista',
  'services.rename': 'Nimeä uudelleen',
  'services.renameTitle': 'Nimeä {service}-tili uudelleen',
  'services.renamed': '{service}-tilin uusi nimi on {name}',
  'services.removeHint': 'Poista valittu palvelu',
  'services.removeTitle': 'Poistetaanko {service}?',
  'services.removeChoose': 'Mistä haluat poistaa palvelun {service}?',
  'services.removeSonora': 'Sonora',
  'services.removeSonoraSub': 'sen kirjautuminen ja luettelo täällä',
  'services.removeSonos': 'Sonos {gen}',
  'services.removeSonosSub': 'tili Sonos-järjestelmässäsi',
  'services.confirmRemove': 'Poista',
  'services.removing': 'Poistetaan: {service}…',
  'services.removeFailed':
    'Palvelun {service} poistaminen epäonnistui: {error}',
  'services.removeFromSonos': 'Poista Sonosista',
  'services.removeSonosBody':
    'Poistetaanko {service} Sonos-järjestelmästäsi? Se poistetaan kaikista '
    + 'Sonos-sovelluksista, ei vain Sonorasta.',
  'services.removeSonoraBody': 'Poistetaanko {service} Sonorasta? Sonora unohtaa sen kirjautumisen.',
  'desk.add.doneSonora.multi':
    '{service} on nyt yhdistetty Sonoraan.\nSinun on myös yhdistettävä '
    + '{service} toisen kerran, suoraan jossakin Sonosin {gen}-sovelluksista, '
    + 'jotta Sonora voi ohjata {gen}-laitteitasi.\nJos haluat käyttää palvelua '
    + '{service} Sonorassa {other}-laitteillasi, yhdistä se uudelleen '
    + 'kohdasta {link}.',
  'services.relinkLinkText': '{other}-palvelut',
  'services.caution.sonos':
    'Yhdistetty Sonos {gen} -järjestelmään, ei vielä Sonoraan',
  'services.needsSonora.title': 'Yhdistäminen Sonoraan vaaditaan',
  'services.needsSonos.title':
    'Yhdistäminen Sonos {gen} -järjestelmään vaaditaan',
  'services.caution.sonora':
    'Yhdistetty Sonoraan, ei vielä Sonos {gen} -järjestelmään',
  'services.sonoraOnly.body':
    '{service} on yhdistetty Sonoraan mutta ei Sonos {gen} '
    + '-järjestelmääsi.\nSonora voi selata sitä, mutta {gen}-laitteesi eivät '
    + 'voi toistaa sitä, ennen kuin yhdistät palvelun {service} jossakin '
    + 'Sonosin {gen}-sovelluksista.',
  'desk.add.doneSonora.solo':
    '{service} on nyt yhdistetty Sonoraan.\nSinun on myös yhdistettävä '
    + '{service} toisen kerran, suoraan jossakin Sonosin {gen}-sovelluksista, '
    + 'jotta Sonora voi ohjata {gen}-laitteitasi.',

  // --- Sonofuture ---

  // --- S2 Upgrade Info ---
  's2.title': 'Sonos-päivitysneuvoja',
  's2.lede':
    'Selvitä, mitä laitteita tarvitsisit siirtyäksesi kokonaan S2:een tai '
    + 'S2.1:een, ja mitä se suunnilleen maksaisi.',
  's2.con4':
    'S1-sovellus on pysynyt muuttumattomana vuosia ja on vakaa. S2-sovellus '
    + 'kirjoitettiin uudelleen vuonna 2024, ja se julkaisu oli ongelmallinen.',
  's2.colRoom': 'Huone',
  's2.colProduct': 'Tuote',
  's2.colReplacement': 'S2-vastine',
  's2.colReplacementS21': 'S2.1-vastine',
  's2.colPrice': 'Hinta (US)',
  's2.ready': 'Kyllä',
  's2.notReady': 'Ei, vain S1',
  's2.unknown': 'Ei tiedossa',
  's2.replaceTitle': 'Mitä S2 joka huoneessa maksaisi',
  's2.replaceBlurb': 'Jokainen talouden laite ja mitä se tarvitsee päästäkseen S2:een: ohjelmistopäivityksen, korvaavan laitteen listahintaan tai ei mitään.',
  's2.noReplacement': 'Ei ostettavaa',
  's2.noReplacementWhy':
    'langallinen kaiutin hoitaa verkon, ja sovellus korvasi ohjaimen',
  's2.total': 'Yhteensä tämän järjestelmän siirtoon S2:een',
  's2.amazonDisclosure': 'Amazon-kumppanina ansaitsen kelpoisista ostoksista.',
  's2.pricesNote': 'Yhdysvaltain listahinnat, tarkistettu vuoden {year} {quarter}. neljänneksellä. Hinnat voivat muuttua, joten tarkista ennen ostoa.',
  's2.timelineTitle': 'Kolme laitesukupolvea',
  's2.era.s1': 'Vain S1',
  's2.era.s20': 'S2.0',
  's2.era.s21': 'S2.1',
  's2.eraSpan': '{from}–{to}',
  's2.eraOpen': '{from} alkaen',
  's2.eraBounds.s1':
    'ZonePlayer 100:sta (tammikuu 2005) Play:5:n 1. sukupolveen (marraskuu '
    + '2015). Mikään näiden vuosien laite ei voi käyttää S2:ta.',
  's2.eraBounds.s20':
    'Play:3:sta (heinäkuu 2011) Symfonisk-pöytävalaisimen 1. sukupolveen '
    + '(tammikuu 2022). Käyttää S2:ta, mutta jäi uusien ominaisuuksien '
    + 'ulkopuolelle vuonna 2025.',
  's2.eraBounds.s21':
    'Sonos Onesta (lokakuu 2017) eteenpäin. Kaikki, mitä Sonos myy nykyään.',
  's2.mark.s2app': 'S2-sovellus, kesäkuu 2020',
  's2.mark.freeze': 'S2.0 jäädytetty, 2025',
  's2.linksIntro': 'Sonosin omin sanoin:',
  's2.linkS2Launch': 'S2:n esittely, kesäkuu 2020',
  's2.linkS21Launch': 'Vuoden 2025 päivitys vanhoille tuotteille',
  's2.allReady':
    'Jokainen tämän järjestelmän S1-laite voi käyttää S2:ta. Järjestelmä '
    + 'voi siirtyä ostamatta mitään.',
  's2.allS21':
    'Kaikki laitteesi ovat Sonos S2.1 -alustalla. Päivitettävää ei ole. '
    + 'Olet joko hyvin uusi Sonos-käyttäjä tai hyvin rikas. Kummin vain, '
    + 'onnittelut!',

  // --- the network map ---
  'net.mapTitle': 'Verkon kaikki laitteet',
  'net.mapBlurb': 'Yksi kortti kaiutinta kohden. Jokainen kertoo, onko yhteys kunnossa ja miksi, sen mukaan, kuinka nopeasti ja luotettavasti kaiutin vastaa. Loput löytyvät Tiedoista.',
  'net.mapEmpty': 'Mikään laite ei vastannut.',
  'net.wired': 'Langallinen',
  'net.onSonosnet': 'SonosNet',
  'net.onWifi': 'Wi-Fi',
  'net.channel': 'Kanava {n}',
  'net.unreachable': 'Ei vastannut',
  'net.notMeasurable': 'Ei naapureita mitattavaksi',
  'net.drop.title': 'Toistokatkokset',
  'net.drop.blurb': 'Kerrat viimeisen seitsemän päivän aikana, kun huoneen musiikki katkesi.',
  'net.drop.none': 'Ei katkoksia viimeisen seitsemän päivän aikana.',
  'net.drop.buffering': 'Pysähtyi {seconds} s puskuroimaan',
  'net.drop.skipped': 'Ohitti jotain, mitä ei voinut toistaa',
  'net.drop.failed': 'Pysähtyi: toisto ei onnistunut',
  'net.drop.more': 'Ja {count} aiempaa.',
  'net.fix.no_answer': 'Tarkista, että se on päällä ja yhä verkossasi.',
  'net.fix.lost': 'Yleensä heikko kuuluvuus sen kohdalla tai ruuhkainen kanava. Kokeile sitä lähempänä reititintä.',
  'net.fix.slow': 'Usein heikko signaali reitittimeltä. Kaiuttimen tai reitittimen siirtäminen lähemmäs yleensä auttaa.',
  'net.fix.slow_often': 'Yleensä muu Wi-Fi-liikenne tai häiriöt sen kanavalla: mikroaaltouunit, itkuhälyttimet ja naapureiden verkot ovat tavallisia syitä.',
  'net.fix.uneven': 'Yleensä muu Wi-Fi-liikenne tai häiriöt sen kanavalla: mikroaaltouunit, itkuhälyttimet ja naapureiden verkot ovat tavallisia syitä.',
  'net.fix.stall': 'Yksittäinen pitkä tauko on yleensä muun Wi-Fi-liikenteen purske. Jos se toistuu tässä huoneessa, etsi häiriölähteitä läheltä.',
  'net.fix.dropping': 'Sen oma Wi-Fi-yhteys menettää paketteja. Tavallisia syitä ovat heikko signaali tai lähellä olevat häiriöt.',
  'net.fix.extender': 'Toistimet lisäävät viivettä. Yhdistä se pääreitittimeen, jos se yltää siihen.',
  'net.summary.clear': 'Ei huomautettavaa. Kaikki kaiuttimet vastaavat nopeasti.',
  'net.summary.issues': '{parts}. Kunkin kaiuttimen kortti alla kertoo miksi.',
  'net.summary.and': ' ja ',
  'net.probing': 'Tutkitaan kaiuttimia. Odota...',
  'net.health.good': 'Hyvä',
  'net.health.watch': 'Kannattaa seurata',
  'net.health.problem': 'Ongelma',
  'net.health.unmeasured': 'Ei mitattu',
  'net.why.ok': 'Vastaa {median} ms:ssa',
  'net.why.no_answer': 'Ei vastausta yhteenkään {attempts} yrityksestä',
  'net.why.lost': '{failed}/{attempts} vastausta puuttui',
  'net.why.slow': 'Vastaa yleensä {median} ms:ssa',
  'net.why.slow_often': '1 vastaus 20:stä kestää yli {p95} ms',
  'net.why.uneven': '1 vastaus 20:stä kestää yli {p95} ms',
  'net.why.stall': 'Yksi vastaus kesti {worst} ms',
  'net.why.dropping': 'Pudottaa {rate} pakettia minuutissa',
  'net.why.extender': 'Yhdistetty Wi-Fi-toistimen kautta',
  'net.details': 'Tiedot',
  'net.replies': 'Vastaukset',
  'net.repliesLine': 'yleensä {median} ms · 1/20 yli {p95} ms · hitain {worst} ms · {failed}/{attempts} puuttui',
  'net.dropped': 'Pudotetut paketit',
  'net.perMinute': '{n} minuutissa',
  'net.notReported': 'Ei ilmoitettu',
  'net.hears': 'Kuulee muut Sonos-kaiuttimet',
  'net.hearsHint': 'Kuinka voimakkaasti tämä kaiutin kuulee järjestelmänsä muut kaiuttimet. Se kertoo kaiuttimen sijainnista, ei sen Wi-Fi-yhteydestä: mikään Sonos-kaiutin ei ilmoita, kuinka hyvin se kuulee reitittimesi.',
  'net.noiseLabel': 'Radiokohina',
  'net.count.problem.one': '{count} ongelma',
  'net.count.problem.other': '{count} ongelmaa',
  'net.count.watch.one': '{count} seurattava',
  'net.count.watch.other': '{count} seurattavaa',
  'net.margin': '{n} dB:n marginaali',
  'net.alone': 'Ei kaiutinta kantaman sisällä',
  's2.tier.s21': 'S2.1',
  's2.tier.s20': 'S2.0',
  's2.tier.unknown': 'Ei tiedossa',
  's2.s21Title': 'Mitä S2.1 joka huoneessa maksaisi',
  's2.s21Blurb': 'Jokainen talouden laite ja mitä se tarvitsee päästäkseen S2.1:een. Laite, joka ei toimi S2:ssa lainkaan tai pääsisi vain S2.0:aan, korvataan nykyisellä tuotteella, joka tulee sen tilalle. Summaan sisältyy se, mitä S2:een siirtyminen ylipäätään maksaisi.',
  's2.colWhy': 'Syy',
  's2.why.legacy': 'Ei voi käyttää S2:ta',
  's2.why.lower': 'Vain S2.0',
  's2.why.upgradable': 'Päivitettävissä',
  's2.why.runningS2': 'Käyttää S2:ta',
  's2.why.runningS21': 'Käyttää S2.1:tä',
  's2.totalS21': 'Yhteensä S2.1:een joka huoneessa',
  's2.s21AllReady': 'Jokainen huone olisi jo S2.1. Ostettavaa ei ole.',
  's2.tierUnknownNote.one':
    'Yhtä laitetta ei voitu sijoittaa tasolle: Sonos luettelee vain osan '
    + 'tuotteen sukupolvista, eikä kaiutin kerro, mikä se on.',
  's2.tierUnknownNote.other':
    '{count} laitetta ei voitu sijoittaa tasolle: Sonos luettelee vain osan '
    + 'näiden tuotteiden sukupolvista, eivätkä kaiuttimet kerro, mitä ne '
    + 'ovat.',
  's2.choiceTitle': 'Mitä haluat tehdä?',
  's2.choiceKeepBoth': 'Pidä erilliset S1- ja S2-järjestelmät',
  's2.choiceKeepBothNote':
    'Pidä kaksi erillistä Sonos-järjestelmää, S1 ja S2, kuten nyt. (Osa '
    + 'S1-laitteista voi olla päivitettävissä ohjelmistolla S2:een.)',
  's2.choiceStayS1': 'Jatka S1-järjestelmän käyttöä',
  's2.choiceStayS1Note': 'Käytä S1-järjestelmääsi edelleen kuten nyt. Mitään ei tarvitse tehdä.',
  's2.choiceStayS2': 'Jatka S2-järjestelmän käyttöä',
  's2.choiceStayS2Note': 'Käytä S2-järjestelmääsi edelleen kuten nyt. Mitään ei tarvitse tehdä.',
  's2.choiceS2': 'Päivitä S2:een',
  's2.choiceS2Note':
    'Päivitä ohjelmistolla kaikki kelvolliset S1-kaiuttimet S2:een ja osta '
    + 'uudet korvaavat laitteet niille S1-laitteille, jotka eivät voi '
    + 'siirtyä.',
  's2.choiceS21': 'Päivitä S2.1:een',
  's2.choiceS21Note':
    'Osta uudet korvaavat laitteet kaikille nykyisille Sonos-laitteille, '
    + 'jotka eivät tue S2.1:tä. Vaihtoehto, jossa raha ei ratkaise ja '
    + 'tulevaisuus on turvattu.',
  's2.choiceFree': 'Ei ostettavaa',
  's2.colBuy': 'Toiminto',
  's2.buyNow': 'Osta nyt',
  's2.updateNow': 'Päivitä nyt',
}
