// Polish (pl-PL). The keys mirror en-US.js, the reference catalog; a key
// missing here is looked for along this locale's fallback chain in locales.js,
// then in en-US.js.
//
// Placeholders are written {name} and substituted at render time. Counts that
// change the wording carry .one and .other keys (see en-US.js).

export default {

  // --- shared ------------------------------------------------------------
  'common.theme': 'Motyw',
  'common.language': 'Język',
  'common.back': 'Wstecz',
  'common.cancel': 'Anuluj',
  'common.save': 'Zapisz',
  'common.submit': 'Wyślij',
  'common.apply': 'Zastosuj',
  'common.appearance': 'Wygląd',
  'common.appearanceLight': 'Jasny',
  'common.appearanceDark': 'Ciemny',
  'common.appearanceSystem': 'Systemowy',
  'common.done': 'Gotowe',
  'common.close': 'Zamknij',
  'common.explicit': 'Dla dorosłych',
  'common.restricted': 'Ograniczone',
  'common.dismiss': 'Odrzuć',
  'common.settings': 'Ustawienia',
  'common.search': 'Szukaj',
  'common.queue': 'Kolejka',
  'common.play': 'Odtwórz',
  'common.pause': 'Pauza',
  'common.stop': 'Zatrzymaj',
  'common.next': 'Następny',
  'common.previous': 'Poprzedni',
  'common.shuffle': 'Losowo',
  'common.repeat': 'Powtarzanie',
  'common.mute': 'Wycisz',
  'common.unmute': 'Wyłącz wyciszenie',
  'common.viewAll': 'Pokaż wszystkie',
  'common.reconnecting': 'ponowne łączenie',
  'desk.lc.noNetwork':
    'Aby korzystać z aplikacji Sonora, musisz być połączony z siecią '
    + 'przewodową lub bezprzewodową. Sprawdź ustawienia sieci.',
  'desk.lc.noSonora':
    'Ta strona utraciła połączenie z aplikacją Sonora. Połączy się ponownie '
    + 'sama, gdy tylko Sonora odpowie.',
  'local.room': 'Ta przeglądarka',
  'local.cannotGroup.title': 'Tej przeglądarki nie można zgrupować',
  'local.cannotGroup.detail':
    'Grupowanie utrzymuje wspólny zegar głośników w ich własnej sieci. '
    + 'Przeglądarka w tym nie uczestniczy, więc odtwarza samodzielnie.',
  'local.cannotPlay.title': 'Ta przeglądarka nie może tego odtworzyć',
  'local.cannotPlay.needsSpeaker':
    'Pobrać to może tylko głośnik: serwis muzyczny przekazuje swój strumień '
    + 'systemowi, a udostępniony folder biblioteki muzycznej montują '
    + 'odtwarzacze. Radio internetowe można odtwarzać tutaj.',
  'local.cannotPlay.unknown':
    'Sonora nie wie, jak odtworzyć to źródło w przeglądarce. Radio '
    + 'internetowe można odtwarzać tutaj.',
  'local.cannotPlay.needsQueue':
    'Album, playlista czy kolejka to lista utworów, a tę listę przechowuje '
    + 'głośnik, który ją odtwarza. Tutaj odtwórz pojedynczy utwór lub stację.',
  'local.cannotPlay.needsLink':
    'Sonora przegląda serwis {service} za pośrednictwem głośników i nie ma '
    + 'własnego logowania, aby poprosić go o strumień. Połącz serwis z '
    + 'aplikacją Sonora, a będzie można go tu odtworzyć.',
  'local.cannotPlay.serviceRefused':
    'Serwis {service} nie pozwala aplikacji Sonora przesyłać tego '
    + 'strumieniowo poza ekosystem Sonos. Spróbuj odtworzyć to bezpośrednio '
    + 'na odtwarzaczu Sonos.',
  'local.cannotPlay.protected':
    'Serwis {service} nie pozwala aplikacji Sonora przesyłać tego '
    + 'strumieniowo poza ekosystem Sonos. Spróbuj odtworzyć to bezpośrednio '
    + 'na odtwarzaczu Sonos.',
  'local.cannotDo.title': 'To potrafi tylko głośnik',
  'local.cannotDo.detail':
    'Ta przeglądarka jest wyjściem, a nie odtwarzaczem: nie ma korektora, '
    + 'diody stanu, kolejki ani pary stereo. Działają głośność, odtwarzanie i '
    + 'wstrzymywanie.',
  'common.rooms.one': '{count} pomieszczenie',
  'common.rooms.other': '{count} pomieszczeń',
  'common.speakers.one': '{count} głośnik',
  'common.speakers.other': '{count} głośników',
  'common.groups.one': '{count} grupa',
  'common.groups.other': '{count} grupy',
  'common.items.one': '{count} element',
  'common.items.other': '{count} elementów',
  'common.tracks.one': '{count} utwór',
  'common.tracks.other': '{count} utworów',
  'common.noResults': 'Brak wyników',
  'common.offline': 'offline',
  'common.system': 'System {generation}',

  // --- start-up and failure states ---------------------------------------
  'splash.loading.title': 'Wyszukiwanie głośników',
  'splash.loading.detail':
    'Wysyłanie zapytania wykrywania i pobieranie reszty systemu od '
    + 'głośnika, który odpowie jako pierwszy.',
  'splash.empty.title': 'Nie znaleziono głośników',
  'splash.empty.detail':
    'Wykrywanie korzysta z multicastu, więc komputer, na którym działa ta '
    + 'aplikacja sterująca, musi być w tej samej sieci co głośniki, a nie w '
    + 'sieci dla gości ani w innej sieci VLAN.',
  'splash.error.title': 'Brak połączenia z aplikacją sterującą',
  'splash.error.detail':
    'Serwer nie odpowiedział. Sprawdź, czy jest uruchomiony.',
  'splash.searchAgain': 'Szukaj ponownie',
  'splash.crash.title': 'Ten motyw przestał działać',
  'splash.crash.detail': 'Podczas jego wyświetlania coś poszło nie tak. Załaduj stronę ponownie lub wybierz poniżej inny wygląd.',
  'splash.reload': 'Załaduj ponownie',
  'rating.cannotUndo': '{service} nie pozwala tego cofnąć',
  'splash.connected': 'Połączono z aplikacją sterującą',
  'splash.notConnected': 'Nie połączono',

  // --- notices ------------------------------------------------------------
  'notice.conflict.title': 'Głośnik odrzucił polecenie',
  'notice.skipLimit.title': 'Osiągnięto limit pominięć',
  'notice.skipLimit.body': 'Osiągnięto limit pominięć dla tej stacji. Spróbuj ponownie później.',
  'notice.silent.title': 'Głośnik nie odpowiedział',
  'notice.silent.body':
    'Pomieszczenie {room} na chwilę przestało odpowiadać. Zwykle wraca '
    + 'samo; spróbuj ponownie za kilka sekund.',
  'notice.error.title': 'Coś poszło nie tak',
  'notice.network.title': 'Błąd sieci',

  // --- what a room is doing ----------------------------------------------
  'search.category.artists': 'Wykonawcy',
  'search.category.albums': 'Albumy',
  'search.category.tracks': 'Utwory',
  'search.category.playlists': 'Playlisty',
  'search.category.stations': 'Stacje',
  'search.category.genres': 'Gatunki',
  'search.category.podcasts': 'Podcasty i audycje',
  'search.category.shows': 'Podcasty i audycje',
  'search.category.audiobooks': 'Audiobooki',
  'search.category.people': 'Osoby',
  'search.category.episodes': 'Odcinki',
  'search.category.hosts': 'Prowadzący',
  'source.queue': 'Kolejka',
  'source.grouped': 'Zgrupowane',
  'source.line_in': 'Wejście liniowe',
  'source.radio': 'Radio',
  'source.service_stream': 'Radio',
  'source.service_radio': 'Radio',
  'source.service_hls': 'Radio',
  'source.service_track': 'Serwis strumieniowy',
  'source.service_container': 'Serwis strumieniowy',
  'source.library_track': 'Biblioteka muzyczna',
  'source.http_stream': 'Strumień sieciowy',
  'source.external_session': 'AirPlay lub Spotify Connect',
  'source.tv': 'TV',
  'source.playlist': 'Playlista',
  'source.idle': 'Bezczynny',
  'source.unknown': 'Nieznane źródło',

  // --- web theme ----------------------------------------------------------
  'common.noMusicSelected': 'Nie wybrano muzyki',
  'common.queueIsEmpty': 'Kolejka jest pusta',
  'common.roomsGrouped': 'Zgrupowane pomieszczenia: {count}',
  'common.groupLabel': '{room} + {count}',
  'common.nothingQueued': 'Kolejka jest pusta',
  'common.setActive': 'Ustaw jako aktywne: {room}',
  'common.openQueue': 'Otwórz kolejkę',
  'common.seek': 'Przewiń',
  'common.live': 'Na żywo',
  'common.tv': 'TV',
  'desk.browse.lineIn': 'Wejście liniowe',
  'desk.browse.noSelections': 'Brak dostępnych pozycji.',
  'desk.browse.lineInNone':
    'Aby korzystać z wejścia liniowego, podłącz urządzenie do produktu '
    + 'Sonos z wejściem liniowym.',
  'common.kind.playlist': 'Playlista',
  'common.kind.album': 'Album',

  // grouping

  // queue

  // settings
  'net.connection': 'Połączenie',
  'net.live': 'na żywo',
  'net.rescan': 'Przeskanuj sieć',

  // a service's own page
  'services.needsAccount':
    'Serwis {service} nic nie wyświetli bez tokenu logowania Twojego konta. '
    + 'Ten token przechowują głośniki i nigdy nie udostępniają go w sieci, '
    + 'więc katalogu nie można tu przeglądać; wszystko, co z niego zapisano w '
    + 'Ulubionych Sonos lub Playlistach Sonos, nadal się odtwarza.',

  // --- Sonos account, network check and TV audio, used across themes -------
  'account.title': 'Konto Sonos',
  'account.blurb': 'Już skonfigurowane głośniki dają Sonorze wszystko, czego potrzebuje do codziennego sterowania systemem Sonos.',
  'account.optional': 'Logowanie do konta Sonos jest opcjonalne. Pokazuje pełną listę serwisów muzycznych skonfigurowanych w systemie wraz z ich logo, dostępne usługi Sonos Labs oraz nazwę wejścia TV odtwarzanego przez soundbar.',
  'account.signIn': 'Zaloguj się',
  'account.signOut': 'Wyloguj się',
  'account.signingIn': 'Logowanie…',
  'account.email': 'E-mail',
  'account.password': 'Hasło',
  'account.signedInAs': 'Zalogowano jako: {email}',
  'account.notSignedIn': 'nie zalogowano',
  'net.scanning': 'Skanowanie sieci…',
  'net.scanDone': 'Znaleziono: {rooms}, {systems}',
  'common.systems.one': '{count} system',
  'common.systems.other': '{count} systemy',
  'source.noSignal': 'Brak sygnału',
  'desk.now.tvInput': 'Wejście',
  'desk.now.tvFormat': 'Format',
  'tvFormat.0': 'Brak podłączonego wejścia',
  'tvFormat.2': 'Stereo',
  'tvFormat.7': 'Dolby 2.0',
  'tvFormat.18': 'Dolby 5.1',
  'tvFormat.21': 'Brak wejścia',
  'tvFormat.22': 'Brak dźwięku',
  'tvFormat.59': 'Dolby Atmos (DD+)',
  'tvFormat.61': 'Dolby Atmos (TrueHD)',
  'tvFormat.63': 'Dolby Atmos (MAT 2.0)',
  'tvFormat.33554434': 'PCM 2.0',
  'tvFormat.33554454': 'PCM 2.0 bez dźwięku',
  'tvFormat.33554488': 'Dolby 2.0',
  'tvFormat.33554490': 'Dolby Digital Plus 2.0',
  'tvFormat.33554492': 'Dolby TrueHD 2.0',
  'tvFormat.33554494': 'Dolby Wielokanałowy PCM 2.0',
  'tvFormat.84934658': 'Wielokanałowy PCM 5.1',
  'tvFormat.84934713': 'Dolby 5.1',
  'tvFormat.84934714': 'Dolby Digital Plus 5.1',
  'tvFormat.84934716': 'Dolby TrueHD 5.1',
  'tvFormat.84934718': 'Dolby Wielokanałowy PCM 5.1',
  'tvFormat.84934721': 'DTS 5.1',
  'tvFormat.118489090': 'Wielokanałowy PCM 7.1',
  'tvFormat.118489146': 'Dolby Digital Plus 7.1',
  'tvFormat.118489148': 'Dolby TrueHD 7.1',

  // --- Sonos macOS Desktop theme ------------------------------------------------
  'desk.menu.edit': 'Edycja',
  'desk.menu.view': 'Widok',
  'desk.menu.manage': 'Zarządzaj',
  'desk.menu.help': 'Pomoc',
  'desk.menu.preferences': 'Preferencje…',
  'desk.menu.checkUpdates': 'Sprawdź aktualizacje…',
  'desk.menu.cut': 'Wytnij',
  'desk.menu.copy': 'Kopiuj',
  'desk.menu.paste': 'Wklej',
  'desk.menu.mainWindow': 'Kontroler Sonos',
  'desk.menu.miniController': 'Minikontroler',
  'desk.menu.musicLibrarySettings': 'Ustawienia biblioteki muzycznej…',
  'desk.menu.serviceSettings': 'Ustawienia usług…',
  'desk.menu.addRadioStation': 'Dodaj stację radiową…',
  'desk.radio.myShows': 'Moje audycje radiowe',
  'desk.radio.changeLocation': 'Zmień lokalizację',
  'desk.radio.enterZip': 'Wpisz kod pocztowy',
  'desk.radio.zipBody': 'Wpisz swój kod pocztowy:',
  'desk.radio.pickCity': 'Wybierz miasto',
  'desk.radio.locationSet': 'Lokalne radio: {city}.',
  'desk.radio.localRadio': 'Radio lokalne',
  'desk.radio.localRadioIn': 'Radio lokalne ({city})',
  'desk.radio.myStations': 'Moje stacje radiowe',
  'desk.radio.addNew': 'Dodaj nową stację radiową',
  'desk.playlists.new': 'Nowa playlista',
  'desk.playlists.addTitle': 'Dodaj utwór do playlisty',
  'desk.playlists.removeSong': 'Usuń utwór',
  'desk.playlists.removedSong': 'Usunięto z playlisty: {title}.',
  'desk.playlists.added': 'Dodano {title} do playlisty {playlist}.',
  'desk.playlists.addedMany':
    'Dodano utwory do playlisty {playlist}: {count}.',
  'desk.playlists.nameTitle': 'Nazwij tę playlistę',
  'desk.playlists.nameBody': 'Nazwa playlisty:',
  'desk.playlists.rename': 'Zmień nazwę playlisty',
  'desk.playlists.renameBody': 'Wpisz nową nazwę tej playlisty:',
  'desk.playlists.delete': 'Usuń playlistę',
  'desk.playlists.deleted': 'Usunięto „{title}”.',
  'desk.queue.editedTitle': 'Kolejka została zmieniona',
  'desk.queue.editedBody': 'Odtworzenie tego zastąpi kolejkę.',
  'desk.queue.playAnyway': 'Odtwórz mimo to',
  'desk.radio.title': 'Dodaj stację radiową',
  'desk.radio.intro': 'Wpisz dane nowej stacji radiowej.',
  'desk.radio.where':
    'Nowa stacja radiowa zostanie dodana do TuneIn > Moje stacje radiowe.',
  'desk.radio.url': 'Adres URL strumienia',
  'desk.radio.name': 'Nazwa stacji',
  'desk.radio.added': 'Dodano „{title}” do Moich stacji radiowych.',
  'desk.radio.exists': '„{title}” jest już w Moich stacjach radiowych.',
  'desk.menu.updateLibrary': 'Aktualizuj bibliotekę muzyczną teraz',
  'desk.menu.systemHelp': 'Pomoc systemu Sonos',
  'desk.menu.supportSite': 'Witryna pomocy technicznej',
  'desk.menu.submitDiagnostics': 'Wyślij dane diagnostyczne',
  'desk.menu.about': 'Informacje o moim systemie Sonos',
  'desk.menu.disabledNote':
    'Wyszarzone pozycje są dostępne tylko w aplikacji Sonos.',
  'desk.transport.groupVolume': 'Głośność grupy',
  'desk.transport.back30': '30 sekund wstecz',
  'desk.transport.forward30': '30 sekund do przodu',
  'desk.transport.repeatOff': 'Powtarzanie wyłączone',
  'desk.transport.repeatOne': 'Powtarzaj utwór',
  'desk.transport.repeatAll': 'Powtarzaj wszystko',
  'desk.transport.crossfade': 'Płynne przejście',
  'desk.rooms.title': 'Pomieszczenia',
  'desk.rooms.system': 'System',
  'desk.rooms.pauseAll': 'Wstrzymaj wszystko',
  'desk.rooms.pause': 'Pauza',
  'desk.rooms.confirmPauseAll':
    'Czy na pewno chcesz wstrzymać muzykę we wszystkich pomieszczeniach?',
  'desk.rooms.playGroup': 'Odtwórz grupę',
  'desk.rooms.pauseGroup': 'Wstrzymaj grupę',
  'desk.rooms.stopGroup': 'Zatrzymaj grupę',
  'desk.rooms.offline': 'Offline',
  'desk.rooms.batteryLevel': '{level}%',
  'desk.rooms.battery': 'Bateria {level}%',
  'desk.rooms.batteryCharging': 'Bateria {level}%, ładowanie',
  'desk.now.title': 'Teraz odtwarzane',
  'desk.now.next': 'Następny',
  'desk.now.noMusic': '[Nie wybrano muzyki]',
  'desk.now.episode': 'Odcinek',
  'desk.now.podcast': 'Podcast',
  'desk.now.releaseDate': 'Data wydania',
  'desk.now.chapter': 'Rozdział',
  'desk.now.author': 'Autor',
  'desk.now.narrator': 'Lektor',
  'desk.now.book': 'Książka',
  'desk.now.station': 'Stacja',
  'desk.now.onNow': 'Teraz na antenie',
  'desk.now.information': 'Informacje',
  'desk.now.zp.connecting': 'Łączenie...',
  'desk.now.zp.buffering': 'Uruchamianie...',
  'desk.now.zp.starting': 'Uruchamianie...',
  'desk.now.artist': 'Wykonawca',
  'desk.now.album': 'Album',
  'desk.now.song': 'Utwór [{n}/{total}]',
  'desk.now.songLabel': 'Utwór',
  'desk.now.infoOptions': 'Informacje i opcje',
  'desk.now.thumbsUp': 'Kciuk w górę',
  'desk.now.thumbsDown': 'Kciuk w dół',
  'desk.info.source': 'Źródło',
  'desk.info.room': 'Pomieszczenie',
  'desk.info.duration': 'Czas trwania',
  'desk.info.station': 'Stacja',
  'desk.info.addMyStations': 'Dodaj do Moich stacji radiowych',
  'desk.info.removeMyStations': 'Usuń z Moich stacji radiowych',
  'desk.radio.removedMine': 'Usunięto z Moich stacji radiowych: {title}',
  'desk.info.addMyShows': 'Dodaj do Moich audycji radiowych',
  'desk.radio.addedMine': 'Dodano do Moich stacji radiowych: {title}',
  'desk.radio.addedShow': 'Dodano do Moich audycji radiowych: {title}',
  'desk.radio.alreadyShow': '{title} jest już w Moich audycjach radiowych',
  'desk.radio.alreadyMine': '{title} jest już w Moich stacjach radiowych',
  'desk.info.startRadio': 'Uruchom radio',
  'desk.info.addToServicePlaylist':
    'Dodaj utwór do playlisty w serwisie {service}',
  'desk.info.saveToMusic': 'Zapisz w Twojej muzyce',
  'desk.info.addSongFavorite': 'Dodaj utwór do Ulubionych Sonos',
  'desk.info.removeFavorite': 'Usuń z Ulubionych Sonos',
  'desk.info.removedFavorite': 'Usunięto z Ulubionych Sonos: {title}',
  'desk.info.albumInfo': 'Informacje o albumie',
  'desk.info.artistInfo': 'Informacje o wykonawcy',
  'desk.info.podcastInfo': 'Informacje o podcaście',
  'desk.info.provider': 'Dostawca',
  'desk.info.addEpisodeFavorite': 'Dodaj odcinek do Ulubionych Sonos',
  'desk.info.addEpisodePlaylist': 'Dodaj odcinek do playlisty Sonos',
  'desk.info.actionDone': 'Gotowe.',
  'desk.info.actionFailed': 'Serwis odrzucił żądanie.',
  'desk.info.viewAllSongs': 'Pokaż wszystkie utwory z albumu',
  'desk.info.addAlbumFavorite': 'Dodaj album do Ulubionych Sonos',
  'desk.info.addBookFavorite': 'Dodaj książkę do Ulubionych Sonos',
  'desk.info.addAlbumPlaylist': 'Dodaj album do playlisty Sonos',
  'desk.info.addToSonosPlaylist': 'Dodaj utwór do playlisty Sonos',
  'desk.info.addStationFavorite': 'Dodaj stację do Ulubionych Sonos',
  'desk.info.addedFavorite': 'Dodano „{title}” do Ulubionych Sonos.',
  'desk.info.alreadyFavorite': '„{title}” jest już w Ulubionych Sonos.',
  'desk.queue.title': 'Kolejka',
  'desk.queue.notInUse': '(Nieużywana)',
  'desk.queue.collapse': 'Pokaż Teraz odtwarzane',
  'desk.queue.expand': 'Rozwiń kolejkę',
  'desk.queue.songs.one': '{count} utwór',
  'desk.queue.songs.other': '{count} utworów',
  'desk.queue.empty': 'Kolejka jest pusta',
  'win.queue.empty': 'Kolejka jest pusta.',
  'win.queue.confirmTitle': 'Potwierdź',
  'win.queue.confirmClear': 'Czy na pewno chcesz wyczyścić kolejkę?',
  'win.queue.clearAction': 'Wyczyść',
  'desk.queue.clear': 'Wyczyść kolejkę',
  'desk.queue.save': 'Zapisz kolejkę',
  'desk.queue.confirmClear': 'Wyczyść kolejkę',
  'desk.queue.playSong': 'Odtwórz utwór',
  'desk.queue.removeSong': 'Usuń utwór',
  'desk.queue.playEpisode': 'Odtwórz odcinek',
  'desk.queue.removeEpisode': 'Usuń odcinek',
  'desk.queue.playTrack': 'Odtwórz utwór {n}',
  'desk.browse.root': 'Wybierz źródło muzyki',
  'desk.browse.music': 'Muzyka',
  'desk.browse.favorites': 'Ulubione Sonos',
  'desk.browse.updateNow': 'Aktualizuj teraz',
  'desk.update.title': 'Dostępna aktualizacja',
  'desk.update.body':
    'Dla głośników Sonos jest gotowa aktualizacja: wersja {version}. '
    + 'Podczas instalacji muzyka w każdym pomieszczeniu zostanie zatrzymana; '
    + 'może to potrwać kilka minut.',
  'desk.update.bodySystem':
    'Dla głośników Sonos {system} jest gotowa aktualizacja: wersja {version}. '
    + 'Podczas instalacji muzyka w każdym pomieszczeniu zostanie zatrzymana; '
    + 'może to potrwać kilka minut.',
  'desk.update.start': 'Aktualizuj',
  'desk.update.notNow': 'Nie teraz',
  'desk.update.started':
    'Aktualizacja się rozpoczęła. Każde pomieszczenie uruchomi się ponownie '
    + 'po jej zakończeniu.',
  'desk.browse.library': 'Biblioteka muzyczna',
  'desk.browse.playlists': 'Playlisty Sonos',
  'desk.browse.radio': 'TuneIn',
  'desk.browse.addServices': 'Dodaj serwisy muzyczne',
  'desk.browse.addServicesFor': 'Dodaj serwisy muzyczne {gen}',
  'desk.browse.switchAccount': 'Przełącz konto',
  'desk.browse.sleepTimer': 'Wyłącznik czasowy',
  'desk.browse.alarms': 'Alarmy',
  'desk.browse.results': 'Wyniki: {query}',
  'desk.search.in': 'Szukaj: {service}',
  'desk.search.clear': 'Wyczyść wyszukiwanie',
  'desk.search.recent': 'Ostatnie wyszukiwania',
  'desk.search.clearRecent': 'Wyczyść ostatnie wyszukiwania',
  'desk.search.scope': 'Wybierz zakres wyszukiwania',
  'desk.browse.noResults':
    'Nie znaleziono wyników wyszukiwania dla „{query}”. Spróbuj wyszukać w '
    + 'innej kategorii lub wpisz inne wyszukiwane hasło.',
  'desk.browse.selectRoom':
    'Wybierz pomieszczenie, aby przeglądać dla niego muzykę.',
  'desk.browse.loading': 'Wczytywanie…',
  'desk.browse.empty': 'Brak dostępnych pozycji.',
  'desk.browse.unableToBrowse': 'Nie można przeglądać muzyki',
  'desk.browse.actions': 'Więcej opcji',
  'desk.browse.select': 'Wybierz',
  'desk.browse.needsLink.body':
    'Serwis {service} jest połączony z Twoim systemem Sonos {gen}.\nJeśli '
    + 'chcesz przeglądać serwis {service} i nim sterować, musisz połączyć go '
    + 'również z aplikacją Sonora. To osobne logowanie, które nie zmienia '
    + 'niczego w aplikacji Sonos.',
  'desk.browse.needsLink.action': 'Połącz serwis {service} z aplikacją Sonora',
  'desk.actions.playNow': 'Odtwórz teraz',
  'desk.actions.playNext': 'Odtwórz jako następne',
  'desk.actions.addToQueue': 'Dodaj na koniec kolejki',
  'desk.actions.addFavorite': 'Dodaj do Ulubionych Sonos',
  'desk.actions.unselectAll': 'Odznacz wszystko',
  'desk.actions.replaceQueue': 'Zastąp kolejkę',
  'desk.favorites.addToSonosPlaylist': 'Dodaj do playlisty Sonos',
  'desk.favorites.addToServicePlaylist':
    'Dodaj do playlisty w serwisie {service}',
  'desk.favorites.rename': 'Zmień nazwę ulubionego Sonos',
  'desk.favorites.remove': 'Usuń z Ulubionych Sonos',
  'desk.favorites.renameBody': 'Wpisz nową nazwę tego ulubionego Sonos:',
  'desk.favorites.removed': 'Usunięto „{title}” z Ulubionych Sonos.',
  'common.ok': 'OK',
  'desk.grouping.title': 'Grupuj pomieszczenia',
  'desk.grouping.willPlay': 'Wybrane pomieszczenia będą odtwarzać:',
  'desk.grouping.select': 'Wybierz pomieszczenia do zgrupowania:',
  'desk.grouping.partyMode': 'Zaznacz wszystko - tryb imprezy',
  'desk.grouping.noMusic': '[brak muzyki]',
  'desk.grouping.chooseMusic': 'Kliknij Gotowe, aby wybrać muzykę',
  'desk.grouping.pickTitle': 'Wybierz muzykę',
  'desk.grouping.pickHeading':
    'Wybierz muzykę do odtwarzania w wybranym pomieszczeniu',
  'desk.grouping.unselectAll': 'Odznacz wszystko',
  'desk.grouping.noneTitle': 'Nie wybrano pomieszczeń',
  'desk.grouping.noneBody':
    'Spowoduje to zatrzymanie odtwarzanej muzyki. Czy chcesz kontynuować?',
  'desk.grouping.noneYes': 'Tak',
  'desk.prefs.title': 'Preferencje',
  'desk.prefs.general': 'Ogólne',
  'desk.prefs.basic': 'Podstawowe',
  'desk.prefs.themeShot': 'Podgląd motywu {theme}',
  'desk.prefs.themeNoShot': 'Brak podglądu dla tego motywu.',
  'desk.prefs.themeVersion': 'wersja {version}',
  'desk.prefs.themeInstalled': 'zainstalowany',
  'desk.prefs.manageThemes': 'Zarządzaj motywami',
  'desk.prefs.themeUpload': 'Zainstaluj motyw…',
  'desk.prefs.themeDelete': 'Usuń motyw',
  'desk.prefs.themeBuiltIn':
    'Motywów dostarczanych z aplikacją Sonora nie można usunąć.',
  'desk.room.nightSound': 'Dźwięk nocny',
  'desk.room.speech': 'Wyrazistość mowy',
  'desk.room.sub': 'Sub',
  'desk.room.subLevel': 'Poziom subwoofera',
  'desk.room.surround': 'Dźwięk przestrzenny',
  'desk.room.surroundLevel': 'Poziom TV',
  'desk.room.musicSurroundLevel': 'Poziom muzyki',
  'desk.room.audioDelay': 'Opóźnienie dźwięku (synchronizacja z obrazem)',
  'desk.room.heightLevel': 'Poziom wysokości',
  'desk.room.lineInName': 'Nazwa źródła wejścia liniowego',
  'desk.room.lineInLevel': 'Poziom źródła wejścia liniowego',
  'desk.room.autoplayRoom': 'Pomieszczenie autoodtwarzania',
  'desk.room.autoplayOff': 'Wył.',
  'desk.room.autoplayLinked': 'Uwzględnij pokoje zgrupowane',
  'desk.room.autoplayUseVolume': 'Użyj głośności autoodtwarzania',
  'desk.room.autoplayVolume': 'Głośność autoodtwarzania',
  'desk.room.stereoPair': 'Para stereo',
  'desk.room.separate': 'Rozdziel parę stereo',
  'desk.room.separateBody':
    'Rozdzielić parę stereo „{room}” z powrotem na dwa pomieszczenia? '
    + 'Odtwarzanie zostanie zatrzymane na czas ponownej konfiguracji '
    + 'głośników.',
  'desk.room.pairWith': 'Wybierz prawy głośnik…',
  'desk.room.createPair': 'Utwórz parę stereo',
  'desk.room.pairBody':
    'Ustawić „{left}” jako lewy kanał, a „{right}” jako prawy kanał jednej '
    + 'pary stereo? Para zachowa nazwę „{left}”; odtwarzanie zostanie '
    + 'zatrzymane na czas ponownej konfiguracji głośników.',
  'desk.rooms.showMore': 'Pokaż {n} więcej…',
  'desk.rooms.showLess': 'Pokaż mniej…',
  'desk.rooms.allSystems': 'Wszystkie',
  'desk.rooms.menu.play': 'Odtwórz {name}',
  'desk.rooms.menu.pause': 'Wstrzymaj {name}',
  'desk.rooms.menu.stop': 'Zatrzymaj {name}',
  'desk.rooms.menu.mute': 'Wycisz {name}',
  'desk.rooms.menu.unmute': 'Wyłącz wyciszenie {name}',
  'desk.rooms.menu.eq': 'Korektor {name}…',
  'desk.rooms.menu.group': 'Grupuj',
  'desk.prefs.musicLibrary': 'Ustawienia biblioteki muzycznej',
  'desk.prefs.services': 'Ustawienia usług',
  'desk.prefs.parental': 'Kontrola rodzicielska',
  'desk.prefs.dateTime': 'Ustawienia daty i godziny',
  // The Mac Preferences window (S1 57.x on Tahoe, 2026-09-15).
  'desk.prefs.eqSettings': 'Ustawienia korektora',
  'desk.prefs.musicLibraryShort': 'Biblioteka muzyczna',
  'desk.prefs.servicesShort': 'Usługi',
  'desk.prefs.dateTimeShort': 'Data i godzina',
  'desk.prefs.sonora': 'Sonora',
  'desk.prefs.mobileNote':
    'Otwórz aplikację Sonos na urządzeniu mobilnym, aby zarządzać systemem.',
  'desk.prefs.getMobileApp': 'Pobierz aplikację mobilną',
  'desk.prefs.eqFor': 'Ustawienia korektora muzyki dla',
  'desk.prefs.eqCaption': 'Dostosuj tony wysokie i bas do swoich upodobań.',
  'desk.prefs.roomFor': 'Ustawienia pomieszczenia dla',
  'desk.prefs.noRooms': 'Nie znaleziono pomieszczeń Sonos.',
  'desk.prefs.folderCol': 'Folder',
  'desk.prefs.pathCol': 'Ścieżka',
  'desk.prefs.serviceNameCol': 'Nazwa usługi',
  'desk.prefs.nameCol': 'Nazwa',
  'desk.prefs.loginCol': 'Login konta',
  'desk.prefs.anonymous': '<Anonimowy>',
  'desk.prefs.changeName': 'Zmień nazwę',
  'desk.prefs.reauthorize': 'Autoryzuj konto ponownie',
  'desk.prefs.visitLabs': 'Odwiedź Sonos Labs',
  'desk.menu.settings': 'Ustawienia…',
  // The Mac app's sheets and About window (2026-09-15).
  'desk.queue.confirmTitle': 'Potwierdź',
  'desk.queue.clearBody': 'Czy na pewno chcesz wyczyścić kolejkę?',
  'desk.queue.enterName': 'Wpisz nazwę nowej listy odtwarzania:',
  'desk.queue.orReplace':
    'Lub wybierz istniejącą listę odtwarzania Sonos do zastąpienia:',
  'desk.sleep.setFor': 'Ustaw wyłącznik czasowy dla pomieszczenia „{room}”:',
  'desk.about.sonosOs': 'Sonos OS',
  'desk.about.products': 'Produkty',
  'desk.about.systemLine': 'Sonos OS {gen}: produkty: {count}',
  'desk.about.serial': 'Numer seryjny',
  'desk.about.hardware': 'Wersja sprzętu',
  'desk.about.series': 'Identyfikator serii',
  'desk.about.ip': 'Adres IP',
  'desk.about.wm': 'WM',
  'desk.about.copy': 'Kopiuj',
  'desk.about.copied': 'Skopiowano',
  'desk.alarms.note':
    'Alarmy tworzy się i edytuje w aplikacji Sonos; tutaj można je włączać, '
    + 'wyłączać i usuwać.',
  'desk.alarms.deleteBody':
    'Usunąć alarm o godzinie {time} w pomieszczeniu {room}?',
  'desk.alarms.deleteTitle': 'Usuń alarm',
  'desk.alarms.recurrence.WEEKENDS': 'Weekendy',
  'desk.alarms.recurrence.WEEKDAYS': 'Dni robocze',
  'desk.alarms.recurrence.DAILY': 'Codziennie',
  'desk.alarms.recurrence.ONCE': 'Raz',
  'desk.alarms.repeat': 'Powtarzanie',
  'desk.alarms.room': 'Pomieszczenie',
  'desk.alarms.time': 'Godzina',
  'desk.alarms.enabled': 'Wł.',
  'desk.alarms.delete': 'Usuń',
  'desk.alarms.none': 'Brak alarmów w tym systemie.',
  'win.saveQueue.name': 'Wpisz nazwę nowej listy odtwarzania:',
  'win.saveQueue.replace':
    'Lub wybierz istniejącą listę odtwarzania Sonos do zastąpienia:',
  'win.alarm.addTitle': 'Dodaj alarm',
  'win.alarm.editTitle': 'Edytuj alarm',
  'win.alarm.alarm': 'Alarm',
  'win.alarm.on': 'Wł.',
  'win.alarm.off': 'Wył.',
  'win.alarm.music': 'Muzyka',
  'win.alarm.select': 'Wybierz…',
  'win.alarm.schedule': 'Harmonogram',
  'win.alarm.onceOnly': 'Tylko raz',
  'win.alarm.volume': 'Głośność',
  'win.alarm.duration': 'Czas trwania',
  'win.alarm.noLimit': 'Bez limitu',
  'win.alarm.linked': 'Uwzględnij zgrupowane pomieszczenia',
  'win.alarm.shuffle': 'Odtwarzaj losowo',
  'win.alarm.chime': 'Dzwonek Sonos',
  'win.alarm.browseTitle': 'Wybierz muzykę alarmu',
  'win.alarm.alarmMusic': 'Muzyka alarmu',
  'win.alarm.importedPlaylists': 'Zaimportowane playlisty',
  'win.alarm.setMusic': 'Ustaw muzykę alarmu',
  'win.alarm.day.1': 'Poniedziałek',
  'win.alarm.day.2': 'Wtorek',
  'win.alarm.day.3': 'Środa',
  'win.alarm.day.4': 'Czwartek',
  'win.alarm.day.5': 'Piątek',
  'win.alarm.day.6': 'Sobota',
  'win.alarm.day.0': 'Niedziela',
  'win.alarms.manage': 'Zarządzaj alarmami Sonos',
  'win.alarms.currentTime': 'Bieżący czas: {time}',
  'desk.alarms.currentTime': 'Bieżący czas: {date} - {time} {zone}',
  'win.alarms.where': 'Gdzie',
  'win.alarms.when': 'Kiedy',
  'win.alarms.on': 'WŁ.',
  'win.alarms.add': 'Dodaj',
  'win.alarms.edit': 'Edytuj',
  'win.alarms.remove': 'Usuń',
  'win.alarms.deleteConfirm': 'Czy na pewno chcesz usunąć ten alarm?',
  'win.alarms.help1': 'Kliknij „Dodaj”, aby dodać nowy alarm.',
  'win.alarms.help2': 'Kliknij „Usuń”, aby usunąć wybrany alarm.',
  'desk.alarms.day.0': 'Nd',
  'desk.alarms.day.1': 'Pn',
  'desk.alarms.day.2': 'Wt',
  'desk.alarms.day.3': 'Śr',
  'desk.alarms.day.4': 'Cz',
  'desk.alarms.day.5': 'Pt',
  'desk.alarms.day.6': 'Sb',
  'desk.queue.saveHint': 'Nazwa playlisty',
  'desk.queue.saveBody':
    'Kolejka zostanie zapisana jako lista odtwarzania Sonos.',
  'desk.queue.saveTitle': 'Zapisz kolejkę',
  'desk.queue.mixName': 'Mix: {weekday}, {part}',
  'desk.queue.part.morning': 'rano',
  'desk.queue.part.afternoon': 'po południu',
  'desk.queue.part.night': 'wieczorem',
  'desk.sleep.none': 'Nie ustawiono wyłącznika czasowego.',
  'desk.sleep.elsewhere': 'Działa też gdzie indziej',
  'desk.sleep.remaining': 'Wyłącznik czasowy: pozostało {time}',
  'desk.sleep.minutes': '{count} min',
  'desk.sleep.off': 'Wył.',
  'desk.sleep.hours.one': '{count} godzina',
  'desk.sleep.hours.other': '{count} godziny',
  'services.needsSignIn':
    'Serwis {service} wymaga zalogowania, zanim cokolwiek wyświetli. Połącz '
    + 'go z aplikacją Sonora, aby przeglądać go tutaj; wszystko, co z niego '
    + 'zapisano w Ulubionych Sonos lub Playlistach Sonos, nadal się odtwarza.',
  'desk.library.folders': 'Foldery',
  'desk.library.advanced': 'Zaawansowane',
  'desk.library.mine': 'Moje foldery z muzyką w systemie Sonos',
  'desk.library.none':
    'Do tego systemu Sonos nie dodano żadnych folderów muzycznych.',
  'desk.library.addFolder': 'Dodaj…',
  'desk.library.add': 'Dodaj',
  'desk.library.remove': 'Usuń',
  'desk.library.pathHint': '//nas/Music',
  'desk.library.pathNote':
    'Sonora dodaje foldery według ich ścieżki sieciowej (na przykład '
    + '//nas/Music). Folder musi być już udostępniony w sieci. Odtwarzacze S1 '
    + 'obsługują tylko udziały SMBv1; odtwarzacze S2 obsługują też SMBv2 i '
    + 'SMBv3.',
  'desk.shareWizard.windowTitle': 'Konfiguracja Sonora',
  'desk.shareWizard.whereTitle': 'Dodaj folder z muzyką',
  'desk.shareWizard.wherePrompt': 'Gdzie jest muzyka, którą chcesz odtwarzać na Sonos?',
  'desk.shareWizard.myMusic': 'Folder Muzyka',
  'desk.shareWizard.otherFolder': 'Inny folder lub dysk podłączony do mojego komputera',
  'desk.shareWizard.network': 'Urządzenie sieciowe (np. dysk NAS)',
  'desk.shareWizard.serverNote': 'Sonora działa na serwerze, więc foldery na tym komputerze są poza jej zasięgiem: może dodać folder udostępniony w sieci.',
  'desk.shareWizard.pathTitle': 'Dodaj muzykę z udziału sieciowego',
  'desk.shareWizard.pathPrompt': 'Wpisz ścieżkę do udziału sieciowego:',
  'desk.shareWizard.loginTitle': 'Nazwa użytkownika i hasło',
  'desk.shareWizard.loginPrompt': 'Wpisz nazwę użytkownika i hasło do dysku sieciowego z muzyką. Zostaw oba puste, jeśli udział ich nie wymaga.',
  'desk.shareWizard.fieldLabel': '{label}:',
  'desk.shareWizard.adding': 'Dodawanie informacji o udziale do systemu Sonos.',
  'desk.shareWizard.done': '„{path}” jest teraz skonfigurowany w systemie Sonos. Muzyka jest dodawana do biblioteki.',
  'desk.shareWizard.failedTitle': 'Sonos nie mógł dodać folderu z muzyką',
  'desk.shareWizard.pathExamples': 'Przykłady:\n\\\\MyOtherComputer\\Shared\\Music\n\\\\MyNetworkedStorage\\Shared\\Music',
  'desk.library.username': 'Nazwa użytkownika',
  'desk.library.password': 'Hasło',
  'desk.library.credHint':
    'Pozostaw oba pola puste tylko wtedy, gdy udział zezwala na dostęp '
    + 'gościa. Wiele serwerów już na to nie pozwala.',
  'desk.library.removeTitle': 'Usuń folder muzyczny',
  'desk.library.removeBody':
    'Usunąć {folder} z biblioteki muzycznej systemu Sonos? Znajdująca się w '
    + 'nim muzyka nie będzie już widoczna w Sonos.',
  'desk.library.indexTitle': 'Aktualizacje biblioteki',
  'desk.library.schedule': 'Aktualizuj indeks muzyki codziennie o',
  'desk.library.updateNow': 'Zaktualizuj indeks muzyki teraz',
  'desk.library.noFolders': 'Nie dodano jeszcze żadnych folderów z muzyką do systemu Sonos.',
  'desk.library.addHint': 'Aby dodać muzykę do Sonos, wybierz {link} z menu {menu}.',
  'desk.library.working': 'Aktualizowanie ustawień biblioteki muzycznej…',
  'desk.library.indexing': 'Aktualizowanie biblioteki muzycznej… Czekaj.',
  'desk.library.indexError':
    'Sonos nie mógł dokończyć aktualizacji indeksu muzyki: {error}',
  'desk.library.addPending':
    'Sonos nadal dodaje ten folder. Pojawi się tutaj, gdy odtwarzacze go '
    + 'zamontują.',
  'desk.library.adding': 'Dodawanie folderu muzycznego',
  'desk.library.addedIndexing':
    'Dodano. Sonos aktualizuje indeks muzyki, co w przypadku dużego folderu '
    + 'może potrwać kilka minut.',
  'desk.library.addingPath':
    '{path} — odtwarzacze montują ten folder. W przypadku dużego folderu '
    + 'może to potrwać kilka minut.',
  'desk.library.addFailed':
    'System Sonos nie mógł dodać folderu muzycznego {path}.',
  'desk.library.addFailedWhy':
    'Sprawdź, czy ścieżka do folderu oraz, w razie potrzeby, nazwa '
    + 'użytkownika i hasło są prawidłowe.',
  'desk.library.addReason': 'Przyczyna: {reason}',
  'desk.library.compilations': 'Grupuj albumy według',
  'desk.library.updateDaily': 'Aktualizuj zawartość codziennie o:',
  'desk.library.showContributing':
    'Pokazuj współwykonawców w bibliotece muzycznej. To ustawienie dotyczy '
    + 'tylko tej aplikacji sterującej.',
  'desk.library.sortFolders': 'Sortuj foldery według',
  'desk.library.sort.songNumber': 'Numer utworu',
  'desk.library.sort.songName': 'Nazwa utworu',
  'desk.library.sort.fileName': 'Nazwa pliku',
  'desk.library.artists': 'Wykonawcy',
  'desk.library.contributingArtists': 'Współwykonawcy',
  'desk.library.albums': 'Albumy',
  'desk.library.composers': 'Kompozytorzy',
  'desk.library.genres': 'Gatunki',
  'desk.library.songs': 'Utwory',
  'desk.library.importedPlaylists': 'Zaimportowane playlisty',
  'desk.library.foldersNode': 'Foldery',
  'desk.library.groupBy': 'Grupuj składanki według',
  'desk.library.group.ITUNES': 'Składanki iTunes®',
  'desk.library.group.WMP': 'Wykonawcy albumu',
  'desk.library.group.NONE': 'Nie grupuj składanek',
  'desk.library.compilationsNote':
    'Zmiana sposobu grupowania składanek aktualizuje indeks muzyki.',
  'desk.time.timeZone': 'Strefa czasowa',
  'desk.time.autoDst': 'Automatycznie przestawiaj na czas letni',
  'desk.time.internet': 'Ustawiaj datę i godzinę z internetu',
  'desk.time.date': 'Data',
  'desk.time.time': 'Godzina',
  'desk.time.dateFormat': 'Format daty',
  'desk.time.timeFormat': 'Format godziny',
  'desk.time.fmt.MDY': 'Miesiąc/dzień/rok',
  'desk.time.fmt.DMY': 'Dzień/miesiąc/rok',
  'desk.time.fmt.YMD': 'Rok/miesiąc/dzień',
  'desk.time.fmt.12H': '12-godzinny',
  'desk.time.fmt.24H': '24-godzinny',
  'desk.time.notSet': 'Nie ustawiono',
  'desk.time.setNow': 'Ustaw',
  'desk.time.loading': 'Odczytywanie ustawień czasu…',
  'desk.time.server': 'Serwer czasu: {server}',
  'desk.parental.body':
    'Filtrowanie konkretnej zawartości to ustawienie samego systemu Sonos, '
    + 'wspólne dla wszystkich aplikacji, które nim sterują. Sonora odczytuje '
    + 'je z głośników i pokazuje poniżej.\nJego zmiana wymaga poświadczenia, '
    + 'które Sonos wydaje tylko własnym aplikacjom: głośniki przyjmą zapis od '
    + 'każdej aplikacji sterującej, ale tylko z tokenem wystawionym dla '
    + 'aplikacji Sonos, a jedyne uprawnienie, jakie Sonos oferuje innym '
    + 'deweloperom, obejmuje wyłącznie odtwarzanie. Aplikacja Sonos może to '
    + 'zrobić; ta czeka na firmę Sonos.\nNie wszystkie serwisy obsługują '
    + 'filtrowanie konkretnej zawartości.',
  'desk.parental.filter': 'Filtruj konkretną zawartość',
  'desk.parental.filterFor': 'Filtruj konkretną zawartość: {system}',
  'desk.parental.on': 'Filtry zawartości włączone',
  'desk.parental.off': 'Filtry zawartości wyłączone',
  'desk.parental.unknown': 'Nie można odczytać filtrów zawartości',
  'desk.parental.reading': 'Odczytywanie ustawienia…',
  'desk.parental.turnOn': 'Włącz filtr treści dla dorosłych',
  'desk.parental.moreInfo': 'Więcej informacji',
  'desk.parental.unavailable':
    'Sonos pozwala to zmieniać tylko własnym aplikacjom',
  'desk.prefs.roomSettings': 'Ustawienia pomieszczenia',
  'desk.prefs.settingsFor': 'Ustawienia dla: {room}',
  'desk.prefs.musicEq': 'Korektor muzyki',
  'desk.prefs.device': 'Urządzenie',
  'desk.prefs.bass': 'Bas',
  'desk.prefs.treble': 'Tony wysokie',
  'desk.prefs.balance': 'Balans',
  'desk.prefs.left': 'L',
  'desk.prefs.right': 'P',
  'desk.prefs.loudness': 'Loudness',
  'desk.prefs.reset': 'Resetuj',
  'desk.prefs.eqFixed':
    'Ustawienia korektora są niedostępne, gdy poziom wyjścia liniowego '
    + 'głośnika Sonos jest ustawiony jako stały.',
  'desk.prefs.roomName': 'Nazwa pomieszczenia',
  'desk.prefs.apply': 'Zastosuj',
  'desk.prefs.statusLight': 'Dioda stanu',
  'desk.prefs.on': 'Wł.',
  'desk.prefs.off': 'Wył.',
  'desk.prefs.servicesTitle': 'Moje konta usług w systemie Sonos',
  'desk.prefs.servicesSignIn':
    'Brak skonfigurowanych serwisów. Sonora odczytuje je bezpośrednio z '
    + 'głośników, więc zwykle oznacza to, że nie udało się połączyć z żadnym '
    + 'z nich.',
  'desk.about.title': 'Informacje o moim systemie Sonos',
  'desk.about.body': 'Głośniki w tej sieci według systemu.',
  'desk.about.model': 'Model',
  'desk.about.version': 'Wersja',
  'desk.about.address': 'Adres',
  'desk.about.speakers': 'Głośniki',
  'desk.about.system': 'System',
  'desk.shortcuts.title': 'Skróty klawiaturowe',
  'desk.shortcuts.playPause': 'Odtwórz/Pauza',
  'desk.shortcuts.volUp': 'Zwiększ głośność',
  'desk.shortcuts.volDown': 'Zmniejsz głośność',
  'desk.shortcuts.mute':
    'Wycisz/wyłącz wyciszenie bieżącego pomieszczenia/grupy',
  'desk.shortcuts.nextZone': 'Wybierz następną grupę pomieszczeń',
  'desk.shortcuts.prevZone': 'Wybierz poprzednią grupę pomieszczeń',
  'notice.cannotPlay.title': 'Nie udało się odtworzyć',
  'notice.cannotPlay.detail': '{room}: nie można odtworzyć {item}. {reason}',
  'notice.cannotPlay.stream':
    '{room}: nie można odtworzyć {item}, serwer {host} nic nie zwrócił. '
    + '{reason}',
  'notice.cannotPlay.format': 'Głośnik nie obsługuje tego formatu.',
  'notice.cannotPlay.connect': 'Głośnik nie mógł się z tym połączyć.',
  'notice.cannotPlay.refused': 'Serwis odmówił odtworzenia.',
  'notice.cannotPlay.missing': 'Tego już tam nie ma.',
  'notice.cannotPlay.permission':
    'To konto nie ma uprawnień do odtwarzania tej pozycji.',
  'notice.notPlaying.title': 'Nic nie zaczęło grać',
  'notice.notPlaying.detail':
    '{room}: polecenie odtwarzania zostało przyjęte, ale odtwarzanie znów '
    + 'się zatrzymało. Nie można odtworzyć bieżącego źródła; wybierz coś '
    + 'innego w panelu muzyki.',
  'notice.notPlaying.stream':
    '{room}: polecenie odtwarzania zostało przyjęte, ale odtwarzanie znów '
    + 'się zatrzymało. Źródłem jest strumień z serwera {host}, który wydaje '
    + 'się niedostępny.',
  'desk.menu.quit': 'Zakończ Sonos',
  'desk.menu.delete': 'Usuń',
  'desk.menu.selectAll': 'Zaznacz wszystko',
  'desk.menu.fullScreen': 'Otwórz tryb pełnoekranowy',
  'desk.menu.updatePlaylists': 'Aktualizuj listy odtwarzania iTunes teraz',
  'desk.menu.updateAlbumArt': 'Aktualizuj okładki albumów teraz',
  'desk.menu.window': 'Okno',
  'desk.menu.close': 'Zamknij',
  'desk.menu.uninstall': 'Odinstaluj…',
  'desk.menu.services': 'Usługi',
  'desk.menu.hideSonos': 'Ukryj Sonos',
  'desk.menu.hideOthers': 'Ukryj pozostałe',
  'desk.menu.showAll': 'Pokaż wszystko',
  'desk.menu.autofill': 'Autowypełnianie',
  'desk.menu.dictation': 'Rozpocznij dyktowanie…',
  'desk.menu.emoji': 'Emoji i symbole',
  'desk.menu.fill': 'Wypełnij',
  'desk.menu.center': 'Wyśrodkuj',
  'desk.menu.moveResize': 'Przenieś i zmień wielkość',
  'desk.menu.fullScreenTile': 'Kafelek pełnoekranowy',
  'desk.menu.removeFromSet': 'Usuń okno z zestawu',
  'win.menu.file': 'Plik',
  'win.menu.exit': 'Zakończ',
  'win.menu.showMini': 'Pokaż minikontroler',
  'win.shortcuts.toggleMini': 'Przełącz minikontroler',
  'win.setup.title': 'Konfiguracja Sonora',
  'win.setup.lib.pathTitle': 'Dodaj muzykę z udziału sieciowego',
  'win.setup.lib.pathText': 'Wpisz ścieżkę do udziału sieciowego:',
  'win.setup.lib.examples': 'Przykłady:',
  'win.setup.lib.browse': 'Przeglądaj',
  'win.setup.lib.credTitle': 'Nazwa użytkownika i hasło',
  'win.setup.lib.credText':
    'Wpisz nazwę użytkownika i hasło (jeśli są wymagane) dla dysku '
    + 'sieciowego zawierającego Twoją muzykę:',
  'win.setup.lib.username': 'Nazwa użytkownika:',
  'win.setup.lib.password': 'Hasło:',
  'win.setup.lib.adding': 'Dodawanie folderu muzycznego',
  'win.setup.lib.doneTitle': 'Konfiguracja biblioteki muzycznej',
  'win.setup.lib.doneSetUp':
    '„{folder}” ustawiono teraz w Twoim systemie Sonos.',
  'win.setup.lib.doneAdding':
    'Twoja muzyka jest teraz dodawana do systemu Sonos. Może to potrwać '
    + 'kilka minut.',
  'win.setup.lib.doneNotice':
    'W przyszłości możesz dodawać muzykę do systemu Sonos w Ustawieniach, w '
    + 'sekcji „Zarządzaj biblioteką muzyczną”.',
  'win.setup.lib.errorTitle': 'Błąd dodawania muzyki',
  'win.setup.lib.errorMessage': 'Sonos nie mógł dodać folderu z muzyką',
  'win.setup.lib.errorDetails':
    'Sprawdź, czy ścieżka do folderu oraz, w razie potrzeby, nazwa '
    + 'użytkownika i hasło są prawidłowe.',
  'win.setup.lib.errorReason': 'Przyczyna: {reason}',
  'win.services.addHint':
    'Kliknij „Dodaj”, aby dodać nowy serwis do systemu Sonos.',
  'win.services.labsHint':
    'Kliknij „Sonos Labs”, aby wypróbować zapowiadane serwisy w systemie '
    + 'Sonos.',
  'win.services.serviceName': 'Nazwa usługi',
  'win.services.name': 'Nazwa',
  'win.services.login': 'Login konta',
  'win.services.anonymous': '<Anonimowy>',
  'win.services.add': 'Dodaj',
  'win.services.signInWith': 'Zaloguj się przez: {service}',
  'win.services.labs': 'Sonos Labs',
  'win.services.addTitle': 'Dodaj serwis',
  'win.services.labsTitle': 'Witamy w Sonos Labs',
  'win.services.labsPrompt': 'Wybierz serwis Sonos Labs, który chcesz dodać:',
  'win.services.labsSignedOut':
    'Zaloguj się na konto Sonos, aby zobaczyć serwisy Sonos Labs.',
  'win.services.labsFailed':
    'Nie udało się pobrać listy serwisów Sonos Labs: {error}',
  'win.services.edit': 'Edytuj',
  'win.services.editTitle': 'Edytuj serwis',
  'win.services.editHeading': 'Edytuj konto w serwisie {service}',
  'win.services.editPrompt': 'Wpisz nazwę konta:',
  'win.services.editName': 'Nazwa:',
  'win.services.replace': 'Zastąp',
  'win.services.reauthorize': 'Autoryzuj ponownie',
  'win.services.removeTitle': 'Usuń konto',
  'win.services.removeBody':
    'Czy na pewno chcesz usunąć to konto w serwisie {service} z systemu '
    + 'Sonos?',
  'win.eq.tab': 'Korektor',
  'win.eq.intro': 'Dostosuj tony wysokie i bas do swoich upodobań.',
  'win.errorLog.title': 'Protokół błędów systemu Sonora',
  'desk.errorLog.empty': 'W ciągu ostatnich siedmiu dni nie zarejestrowano żadnych błędów.',
  'win.library.title': 'Moje foldery muzyczne w systemie Sonos',
  'win.library.addHint':
    'Kliknij „Dodaj”, aby dodać nowy folder muzyczny do systemu Sonos.',
  'win.library.removeHint': 'Kliknij „Usuń”, aby usunąć podświetlony folder.',
  'win.library.name': 'Nazwa',
  'win.library.path': 'Ścieżka',
  // The Windows app's own two lines while the library updates.
  'win.library.indexing1': 'Aktualizowanie biblioteki muzycznej…',
  'win.library.indexing2': 'Czekaj.',
  'win.mini.noMusic': '[brak muzyki]',
  'win.mini.volume': 'Głośność',
  'win.mini.larger': 'Większy',
  'win.mini.smaller': 'Mniejszy',
  'win.menu.checkUpdates': 'Wyszukaj aktualizacje oprogramowania…',
  'win.menu.changeLanguage': 'Zmień język…',
  'win.menu.settings': 'Ustawienia…',
  'win.settings.title': 'Ustawienia',
  'win.sleep.title': 'Wyłącznik czasowy ({state})',
  'win.sleep.choose':
    'Wybierz czas wyłącznika czasowego dla pomieszczenia „{room}”:',
  'desk.window.controller': 'Aplikacja sterująca Sonora {systems}',
  'win.about.title': 'Informacje',
  'win.about.version': 'Wersja:',
  'win.about.os': 'Sonos OS:',
  'win.about.license': 'Licencja:',
  'win.about.system': 'System Sonos {gen}:',
  'win.about.serial': 'Numer seryjny',
  'win.about.ip': 'Adres IP',
  'win.about.associated': 'Powiązany produkt:',
  'win.about.hardware': 'Wersja sprzętu',
  'win.about.series': 'Identyfikator serii',
  'win.about.wm': 'WM',
  'win.shortcuts.intro': 'Sonora obsługuje następujące skróty klawiszowe:',
  'win.shortcuts.function': 'Funkcja',
  'win.shortcuts.shortcut': 'Skrót',
  'win.shortcuts.toggleShuffle': 'Przełącz odtwarzanie losowe',
  'win.shortcuts.toggleRepeat': 'Przełącz powtarzanie',
  'win.shortcuts.muteAll': 'Wycisz wszystko',
  'win.shortcuts.topMenu': 'Powrót do głównego menu muzyki',
  'win.shortcuts.favorites': 'Przejdź do ulubionych',
  'win.shortcuts.toggleCrossfade': 'Przełącz płynne przejście',
  'win.shortcuts.scrollCurrent': 'Przewiń do bieżącego utworu w kolejce',
  'win.shortcuts.closeWindow': 'Zamknij aktywne okno',
  'win.shortcuts.browserNote':
    'Trzy z nich różnią się od aplikacji Sonos: przeglądarka zastrzega '
    + 'Ctrl+T, Ctrl+L i Ctrl+W dla siebie.',
  'win.shortcuts.jumpSearch': 'Przeskocz do pola wyszukiwania',
  'win.shortcuts.playNext': 'Odtwórz wybrany utwór jako następny',
  'win.shortcuts.replaceQueue': 'Zastąp kolejkę zaznaczeniem',
  'win.shortcuts.playLater': 'Odtwórz zaznaczenie później',
  'win.shortcuts.resizeQueue': 'Zmień rozmiar kolejki',
  'win.shortcuts.prevTrack': 'Poprzedni utwór',
  'win.shortcuts.nextTrack': 'Kolejny utwór',
  'win.shortcuts.showShortcuts': 'Pokaż listę skrótów klawiszowych',
  'win.settings.sonora': 'Sonora',
  'win.parental.title': 'Kontrola rodzicielska',
  'win.parental.enabled':
    'Filtrowanie treści dla dorosłych jest włączone. Kliknij przycisk '
    + 'poniżej, aby zezwolić na odtwarzanie treści dla dorosłych w systemie '
    + 'Sonos.\n\nNie wszystkie usługi obsługują filtrowanie treści.',
  'win.parental.disabled':
    'Filtrowanie treści dla dorosłych jest wyłączone. Kliknij przycisk '
    + 'poniżej, aby zablokować odtwarzanie treści dla dorosłych w systemie '
    + 'Sonos.\n\nNie wszystkie usługi obsługują filtrowanie treści.',
  'win.parental.noServices':
    'W systemie Sonos nie ma usług muzycznych obsługujących filtrowanie '
    + 'treści.',
  'win.parental.unreadable':
    'Ten system nie podał, czy filtrowanie konkretnej zawartości jest '
    + 'włączone.',
  'win.parental.turnOn': 'Włącz filtr treści dla dorosłych',
  'win.parental.turnOff': 'Wyłącz filtr treści dla dorosłych',
  'win.parental.moreInfo': 'Więcej informacji',
  'win.settings.eq': 'Ustawienia korektora',
  'win.settings.library': 'Biblioteka muzyczna',
  'win.settings.services': 'Usługi',
  'win.settings.eqFor': 'Ustawienia korektora dla',
  'win.settings.mobileNote':
    'Otwórz aplikację Sonos na urządzeniu mobilnym, aby zarządzać systemem.',
  'win.settings.getApp': 'Pobierz aplikację mobilną',
  'win.maximize': 'Maksymalizuj',
  'win.restore': 'Przywróć w dół',
  'desk.menu.minimize': 'Minimalizuj',
  'desk.menu.zoom': 'Powiększ',
  'desk.menu.bringAllToFront': 'Umieść wszystko na wierzchu',
  'desk.menu.shop': 'Kup produkty Sonos',
  'desk.menu.firewallHelp': 'Pomoc w konfiguracji zapory',
  'desk.menu.errorLog': 'Dziennik błędów',
  'desk.menu.reset': 'Resetuj kontroler',
  'desk.menu.forget': 'Zapomnij bieżący system Sonos',
  'desk.window.title': 'Sonora',
  'desk.add.title': 'Dodaj serwisy muzyczne',
  'desk.add.button': 'Dodaj…',
  'desk.add.intro': 'Wybierz serwis, który chcesz dodać do systemu Sonos.',
  'win.addService.title': 'Dodaj usługę',
  'win.addService.heading': 'Dostępne usługi',
  'win.addService.intro': 'Wybierz usługę, którą chcesz dodać do systemu Sonos.',
  'desk.add.auth.Anonymous': 'Konto niepotrzebne',
  'desk.add.appOnly': 'Tylko aplikacja Sonos',
  'desk.add.another': 'Inne konto',
  'desk.add.unpairable':
    'Serwis {service} można dodać tylko w oficjalnej aplikacji Sonos: jego '
    + 'dostawca nie loguje aplikacji sterujących innych niż Sonos.',
  'desk.add.auth.DeviceLink': 'Zaloguj się w witrynie dostawcy',
  'desk.add.auth.AppLink':
    'Zaloguj się w witrynie dostawcy, jeśli jest dostępna',
  'desk.add.needsApp':
    'Serwis {service} nie pozwala logować się z aplikacji Sonora; jego '
    + 'dostawca przyjmuje logowanie tylko przez oficjalną aplikację Sonos. '
    + 'Dodaj go tam, aby korzystać z niego w aplikacjach Sonos. Wszystko, co '
    + 'z niego zapisano w Ulubionych Sonos lub Playlistach Sonos, nadal '
    + 'odtwarza się w aplikacji Sonora.',
  'desk.add.instructions':
    'Przejdź na stronę {url}, zaloguj się i wpisz ten kod:',
  'desk.add.instructionsNoCode':
    'Przejdź na stronę {url} i zaloguj się, aby autoryzować Sonos.',
  'desk.add.open': 'Otwórz w przeglądarce',
  'desk.add.waiting': 'Oczekiwanie na potwierdzenie z serwisu {service}…',
  'desk.add.authorizeTitle': 'Dodaj konto {service}',
  'desk.add.authorizeBody': 'Zaloguj się do {service} w przeglądarce, aby Sonos mógł korzystać z Twojego konta.',
  'desk.add.authorize': 'Autoryzuj',
  'desk.add.doneSystem.multi':
    'Serwis {service} został dodany do systemu {gen} i jest gotowy na '
    + 'urządzeniach {gen}, w aplikacji Sonora i w oficjalnej aplikacji Sonos. '
    + 'Aby korzystać z niego także na urządzeniach {other}, dodaj go ponownie '
    + 'w sekcji {link}.',
  'desk.add.doneSystem.solo':
    'Serwis {service} został dodany do systemu Sonos i jest gotowy na '
    + 'Twoich urządzeniach, w aplikacji Sonora i w oficjalnej aplikacji '
    + 'Sonos.',
  'desk.add.doneAnon.multi':
    'Serwis {service} jest teraz dostępny w aplikacji Sonora na '
    + 'urządzeniach {gen}. Nie udało się dodać go do systemu Sonos, więc nie '
    + 'pojawi się w aplikacjach Sonos. Aby korzystać z niego w aplikacji '
    + 'Sonora na urządzeniach {other}, dodaj go ponownie w sekcji {link}.',
  'desk.add.doneAnon.solo':
    'Serwis {service} jest teraz dostępny w aplikacji Sonora na Twoich '
    + 'urządzeniach. Nie udało się dodać go do systemu Sonos, więc nie pojawi '
    + 'się w aplikacjach Sonos.',
  'desk.add.failed': 'Nie udało się dodać serwisu {service}: {error}',
  // --- About dialog ------------------------------------------------------
  'about.title': 'O aplikacji Sonora',
  'about.menu': 'O aplikacji Sonora',
  'about.version': 'Wersja {version}',
  'about.tagline': 'Samodzielnie hostowany kontroler webowy dla wszystkich głośników Sonos.',
  'about.pointLocal': 'Sterowanie przede wszystkim lokalne',
  'about.pointThemes': 'Dopracowane motywy',
  'about.pointNetwork': 'Rozwiązywanie problemów z siecią',
  'about.pointUpgrade': 'Doradca modernizacji sprzętu',
  'about.pointMore': 'I wiele więcej…',
  'about.license': 'Sonora to wolne oprogramowanie wydane na licencji {license}.',
  'about.github': 'Zobacz w serwisie GitHub',
  'about.thirdParty': 'Licencje innych firm',
  'about.support': 'Wesprzyj Sonorę',
  'about.supportNote': 'Jeśli Sonora jest dla Ciebie przydatna, rozważ wsparcie projektu.',
  'about.trademark': 'Sonora nie jest powiązana z firmą Sonos ani przez nią wspierana.\nSonos jest znakiem towarowym Sonos, Inc.',
  'desk.showSystem': 'Pokaż system',
  'desk.services.tab': 'Serwisy {system}',
  'desk.add.starting': 'Pobieranie linku logowania z serwisu {service}…',
  'desk.add.linking': 'Łączenie z serwisem {service}…',
  // --- removing a music service (every theme) --------------------------------
  'services.remove': 'Usuń',
  'services.rename': 'Zmień nazwę',
  'services.renameTitle': 'Zmień nazwę konta w serwisie {service}',
  'services.renamed': 'Zmieniono nazwę konta w serwisie {service} na {name}',
  'services.removeHint': 'Usuń zaznaczoną usługę',
  'services.removeTitle': 'Usunąć serwis {service}?',
  'services.removeChoose': 'Skąd chcesz usunąć serwis {service}?',
  'services.removeSonora': 'Sonora',
  'services.removeSonoraSub': 'jego logowanie i widoczność tutaj',
  'services.removeSonos': 'Sonos {gen}',
  'services.removeSonosSub': 'konto w Twoim systemie Sonos',
  'services.confirmRemove': 'Usuń',
  'services.removing': 'Usuwanie serwisu {service}…',
  'services.removeFailed': 'Nie udało się usunąć serwisu {service}: {error}',
  'services.removeFromSonos': 'Usuń z Sonos',
  'services.removeSonosBody':
    'Usunąć serwis {service} z systemu Sonos? Zostanie usunięty ze '
    + 'wszystkich aplikacji Sonos, nie tylko z aplikacji Sonora.',
  'services.removeSonoraBody': 'Usunąć {service} z Sonory? Sonora zapomni jego logowanie.',
  'desk.add.doneSonora.multi':
    'Serwis {service} jest teraz połączony z aplikacją Sonora.\nMusisz też '
    + 'połączyć serwis {service} po raz drugi, bezpośrednio w dowolnej '
    + 'aplikacji Sonos {gen}, aby Sonora mogła sterować urządzeniami '
    + '{gen}.\nAby korzystać z serwisu {service} w aplikacji Sonora na '
    + 'urządzeniach {other}, połącz go ponownie w sekcji {link}.',
  'services.relinkLinkText': 'Serwisy {other}',
  'services.caution.sonos':
    'Połączono z Sonos {gen}, jeszcze nie z aplikacją Sonora',
  'services.needsSonora.title': 'Wymagane połączenie z aplikacją Sonora',
  'services.needsSonos.title': 'Wymagane połączenie z Sonos {gen}',
  'services.caution.sonora':
    'Połączono z aplikacją Sonora, jeszcze nie z Sonos {gen}',
  'services.sonoraOnly.body':
    'Serwis {service} jest połączony z aplikacją Sonora, ale nie z Twoim '
    + 'systemem Sonos {gen}.\nSonora może go przeglądać, ale urządzenia {gen} '
    + 'nie mogą go odtwarzać, dopóki nie połączysz serwisu {service} w '
    + 'dowolnej aplikacji Sonos {gen}.',
  'desk.add.doneSonora.solo':
    'Serwis {service} jest teraz połączony z aplikacją Sonora.\nMusisz też '
    + 'połączyć serwis {service} po raz drugi, bezpośrednio w dowolnej '
    + 'aplikacji Sonos {gen}, aby Sonora mogła sterować urządzeniami {gen}.',

  // --- Sonofuture ---

  // --- S2 Upgrade Info ---
  's2.title': 'Doradca aktualizacji Sonos',
  's2.lede':
    'Sprawdź, jakiego sprzętu potrzebujesz, aby w pełni przejść na S2 lub '
    + 'S2.1, i ile mniej więcej to kosztuje.',
  's2.con4':
    'Aplikacja S1 od lat się nie zmienia i jest stabilna. Aplikacja S2 '
    + 'została napisana od nowa w 2024 roku, a to wydanie było '
    + 'problematyczne.',
  's2.colRoom': 'Pomieszczenie',
  's2.colProduct': 'Produkt',
  's2.colReplacement': 'Odpowiednik S2',
  's2.colReplacementS21': 'Odpowiednik S2.1',
  's2.colPrice': 'Cena w USA',
  's2.ready': 'Tak',
  's2.notReady': 'Nie, tylko S1',
  's2.unknown': 'Nieznane',
  's2.replaceTitle': 'Ile kosztowałoby S2 w każdym pomieszczeniu',
  's2.replaceBlurb': 'Każde urządzenie w domu i to, czego potrzebuje, by przejść na S2: aktualizacji oprogramowania, wymiany w cenie katalogowej albo niczego.',
  's2.noReplacement': 'Nic do kupienia',
  's2.noReplacementWhy':
    'sieć zapewnia głośnik podłączony kablem, a pilota zastąpiła aplikacja',
  's2.total': 'Łącznie, aby przenieść ten system na S2',
  's2.amazonDisclosure': 'Jako partner Amazon zarabiam na kwalifikujących się zakupach.',
  's2.pricesNote': 'Ceny katalogowe w USA, sprawdzone w {quarter}. kwartale {year}. Ceny mogą się zmienić, więc sprawdź je przed zakupem.',
  's2.timelineTitle': 'Trzy generacje sprzętu',
  's2.era.s1': 'Tylko S1',
  's2.era.s20': 'S2.0',
  's2.era.s21': 'S2.1',
  's2.eraSpan': '{from} – {to}',
  's2.eraOpen': '{from} – dziś',
  's2.eraBounds.s1':
    'Od ZonePlayer 100 (styczeń 2005) do Play:5 1. generacji (listopad '
    + '2015). Nic z tych lat nie działa z S2.',
  's2.eraBounds.s20':
    'Od Play:3 (lipiec 2011) do lampy stołowej Symfonisk 1. generacji '
    + '(styczeń 2022). Działa z S2, bez nowych funkcji od 2025 roku.',
  's2.eraBounds.s21':
    'Od Sonos One (październik 2017). Wszystko, co Sonos sprzedaje dziś.',
  's2.mark.s2app': 'Aplikacja S2, czerwiec 2020',
  's2.mark.freeze': 'Zamrożenie S2.0, 2025',
  's2.linksIntro': 'Słowami firmy Sonos:',
  's2.linkS2Launch': 'Przedstawiamy S2, czerwiec 2020',
  's2.linkS21Launch': 'Aktualizacja starszych produktów z 2025 roku',
  's2.allReady':
    'Każde urządzenie S1 w tym systemie może działać z S2. Ten system można '
    + 'przenieść bez żadnych zakupów.',
  's2.allS21':
    'Wszystkie Twoje urządzenia działają na platformie Sonos S2.1. Nie masz '
    + 'czego aktualizować. Albo jesteś nowy w świecie Sonos, albo bardzo '
    + 'bogaty. Tak czy inaczej, gratulacje!',

  // --- the network map ---
  'net.mapTitle': 'Wszystkie urządzenia w sieci',
  'net.mapBlurb': 'Jedna karta na głośnik. Każda mówi, czy połączenie jest w porządku i dlaczego, na podstawie tego, jak szybko i niezawodnie głośnik odpowiada. Resztę znajdziesz w Szczegółach.',
  'net.mapEmpty': 'Żadne urządzenie nie odpowiedziało.',
  'net.wired': 'Przewodowe',
  'net.onSonosnet': 'SonosNet',
  'net.onWifi': 'Wi-Fi',
  'net.channel': 'Kanał {n}',
  'net.unreachable': 'Brak odpowiedzi',
  'net.notMeasurable': 'Brak węzłów do pomiaru',
  'net.drop.title': 'Przerwy w odtwarzaniu',
  'net.drop.blurb': 'Chwile z ostatnich siedmiu dni, gdy muzyka w pomieszczeniu się urwała.',
  'net.drop.none': 'Brak przerw w ostatnich siedmiu dniach.',
  'net.drop.buffering': 'Wstrzymano na {seconds} s, by zbuforować',
  'net.drop.skipped': 'Pominięto coś, czego nie dało się odtworzyć',
  'net.drop.failed': 'Zatrzymano: nie można odtworzyć',
  'net.drop.more': 'I {count} wcześniejszych.',
  'net.fix.no_answer': 'Sprawdź, czy jest włączony i nadal w sieci.',
  'net.fix.lost': 'Zwykle słaby zasięg w jego miejscu lub zatłoczony kanał. Spróbuj bliżej routera.',
  'net.fix.slow': 'Często słaby sygnał z routera. Zwykle pomaga przybliżenie głośnika lub routera.',
  'net.fix.slow_often': 'Zwykle inny ruch Wi-Fi lub zakłócenia na jego kanale: częste przyczyny to mikrofalówki, nianie elektroniczne i sieci sąsiadów.',
  'net.fix.uneven': 'Zwykle inny ruch Wi-Fi lub zakłócenia na jego kanale: częste przyczyny to mikrofalówki, nianie elektroniczne i sieci sąsiadów.',
  'net.fix.stall': 'Pojedyncza długa przerwa to zwykle chwilowy wzrost innego ruchu Wi-Fi. Jeśli powtarza się w tym pokoju, poszukaj źródła zakłóceń w pobliżu.',
  'net.fix.dropping': 'Jego własne łącze Wi-Fi gubi pakiety. Zwykłą przyczyną jest słaby sygnał lub zakłócenia w pobliżu.',
  'net.fix.extender': 'Wzmacniacze dodają opóźnienie. Podłącz go do głównego routera, jeśli go łapie.',
  'net.summary.clear': 'Nic do zgłoszenia. Wszystkie głośniki odpowiadają szybko.',
  'net.summary.issues': '{parts}. Karta każdego głośnika poniżej mówi dlaczego.',
  'net.summary.and': ' i ',
  'net.probing': 'Sprawdzanie głośników. Proszę czekać...',
  'net.health.good': 'Dobrze',
  'net.health.watch': 'Warto obserwować',
  'net.health.problem': 'Problem',
  'net.health.unmeasured': 'Nie zmierzono',
  'net.why.ok': 'Odpowiada w {median} ms',
  'net.why.no_answer': 'Brak odpowiedzi na żadną z {attempts} prób',
  'net.why.lost': 'Brak {failed} z {attempts} odpowiedzi',
  'net.why.slow': 'Zwykle odpowiada w {median} ms',
  'net.why.slow_often': '1 odpowiedź na 20 trwa ponad {p95} ms',
  'net.why.uneven': '1 odpowiedź na 20 trwa ponad {p95} ms',
  'net.why.stall': 'Jedna odpowiedź trwała {worst} ms',
  'net.why.dropping': 'Gubi {rate} pakietów na minutę',
  'net.why.extender': 'Połączony przez wzmacniacz Wi-Fi',
  'net.details': 'Szczegóły',
  'net.replies': 'Odpowiedzi',
  'net.repliesLine': 'zwykle {median} ms · 1 na 20 ponad {p95} ms · najwolniejsza {worst} ms · brak {failed} z {attempts}',
  'net.dropped': 'Utracone pakiety',
  'net.perMinute': '{n} na minutę',
  'net.notReported': 'Nie podano',
  'net.hears': 'Słyszy inne głośniki Sonos',
  'net.hearsHint': 'Jak głośno ten głośnik słyszy pozostałe głośniki swojego systemu. Opisuje jego położenie, a nie połączenie Wi-Fi: żaden głośnik Sonos nie podaje, jak dobrze słyszy router.',
  'net.noiseLabel': 'Szum radiowy',
  'net.count.problem.one': '{count} problem',
  'net.count.problem.other': '{count} problemów',
  'net.count.watch.one': '{count} do obserwacji',
  'net.count.watch.other': '{count} do obserwacji',
  'net.margin': 'margines {n} dB',
  'net.alone': 'Brak głośnika w zasięgu',
  'net.mesh.title': 'Sieć mesh lub zarządzana?',
  'net.mesh.blurb': 'Systemy Wi-Fi mesh i zarządzane punkty dostępowe mogą {sometimes} uniemożliwiać głośnikom znalezienie się nawzajem. Rady producentów sprowadzają się do kilku zasad: podłącz wszystkie głośniki w ten sam sposób, wszystkie przez Wi-Fi albo wszystkie kablem; głośniki z kablem podłącz do jednej jednostki routera lub jednego przełącznika; i nie pozwól punktom dostępowym konwertować ani filtrować ruchu multicast.',
  'net.mesh.sometimes': 'czasem',
  'net.mesh.guidance': 'Poradniki:',
  's2.tier.s21': 'S2.1',
  's2.tier.s20': 'S2.0',
  's2.tier.unknown': 'Nieznane',
  's2.s21Title': 'Ile kosztowałoby S2.1 w każdym pomieszczeniu',
  's2.s21Blurb': 'Każde urządzenie w domu i to, czego potrzebuje, by przejść na S2.1. Urządzenie, które w ogóle nie obsługuje S2 albo dotarłoby tylko do S2.0, zastępuje obecny produkt, który zajmuje jego miejsce. Suma obejmuje koszt samego przejścia na S2.',
  's2.colWhy': 'Powód',
  's2.why.legacy': 'Nie działa z S2',
  's2.why.lower': 'Tylko S2.0',
  's2.why.upgradable': 'Można zaktualizować',
  's2.why.runningS2': 'Działa na S2',
  's2.why.runningS21': 'Działa na S2.1',
  's2.totalS21': 'Łącznie, aby mieć S2.1 w każdym pomieszczeniu',
  's2.s21AllReady': 'Każde pomieszczenie ma już S2.1. Nie ma nic do kupienia.',
  's2.tierUnknownNote.one':
    'Jednego urządzenia nie udało się przypisać do poziomu: Sonos wymienia '
    + 'tylko niektóre generacje tego produktu, a głośnik nie podaje, która to '
    + 'generacja.',
  's2.tierUnknownNote.other':
    'Urządzeń, których nie udało się przypisać do poziomu: {count}. Sonos '
    + 'wymienia tylko niektóre generacje tych produktów, a głośniki nie '
    + 'podają, które to generacje.',
  's2.choiceTitle': 'Co chcesz zrobić?',
  's2.choiceKeepBoth': 'Zachowaj osobne systemy S1 i S2',
  's2.choiceKeepBothNote':
    'Utrzymuj dwa osobne systemy Sonos, S1 i S2, tak jak teraz. (Niektóre '
    + 'urządzenia S1 można zaktualizować programowo do S2.)',
  's2.choiceStayS1': 'Korzystaj dalej z systemu S1',
  's2.choiceStayS1Note': 'Korzystaj z systemu S1 tak jak dotąd. Nie musisz nic robić.',
  's2.choiceStayS2': 'Korzystaj dalej z systemu S2',
  's2.choiceStayS2Note': 'Korzystaj z systemu S2 tak jak dotąd. Nie musisz nic robić.',
  's2.choiceS2': 'Przejdź na S2',
  's2.choiceS2Note':
    'Zaktualizuj programowo wszystkie kwalifikujące się głośniki S1 do S2 i '
    + 'kup nowe urządzenia w miejsce tych urządzeń S1, które nie mogą '
    + 'przejść.',
  's2.choiceS21': 'Przejdź na S2.1',
  's2.choiceS21Note':
    'Kup nowe urządzenia w miejsce wszystkich obecnych urządzeń Sonos, '
    + 'które nie obsługują S2.1. Opcja dla tych, którzy nie liczą pieniędzy i '
    + 'chcą być gotowi na przyszłość.',
  's2.choiceFree': 'Nic do kupienia',
  's2.colBuy': 'Działanie',
  's2.buyNow': 'Kup teraz',
  's2.updateNow': 'Aktualizuj teraz',
}
