// Portuguese (Portugal) (pt-PT). The keys mirror en-US.js, the reference catalog; a key
// missing here is looked for along this locale's fallback chain in locales.js,
// then in en-US.js.
//
// Placeholders are written {name} and substituted at render time. Counts that
// change the wording carry .one and .other keys (see en-US.js).

export default {

  // --- shared ------------------------------------------------------------
  'common.theme': 'Tema',
  'common.language': 'Idioma',
  'common.back': 'Voltar',
  'common.cancel': 'Cancelar',
  'common.save': 'Guardar',
  'common.submit': 'Enviar',
  'common.apply': 'Aplicar',
  'common.appearance': 'Aspeto',
  'common.appearanceLight': 'Claro',
  'common.appearanceDark': 'Escuro',
  'common.appearanceSystem': 'Sistema',
  'common.done': 'Concluído',
  'common.close': 'Fechar',
  'common.explicit': 'Explícito',
  'common.restricted': 'Restrito',
  'common.dismiss': 'Ignorar',
  'common.settings': 'Definições',
  'common.search': 'Pesquisar',
  'common.queue': 'Fila',
  'common.play': 'Reproduzir',
  'common.pause': 'Pausa',
  'common.stop': 'Parar',
  'common.next': 'Seguinte',
  'common.previous': 'Anterior',
  'common.shuffle': 'Aleatório',
  'common.repeat': 'Repetir',
  'common.mute': 'Silenciar',
  'common.unmute': 'Ativar som',
  'common.viewAll': 'Ver tudo',
  'common.reconnecting': 'a restabelecer ligação',
  'desk.lc.noNetwork':
    'Tem de estar ligado a uma rede com ou sem fios para utilizar o Sonora. '
    + 'Verifique as definições de rede.',
  'desk.lc.noSonora':
    'Esta página perdeu a ligação ao Sonora. Voltará a ligar-se sozinha '
    + 'assim que o Sonora responder.',
  'local.room': 'Este navegador',
  'local.cannotGroup.title': 'Este navegador não pode ser agrupado',
  'local.cannotGroup.detail':
    'O agrupamento mantém os altifalantes num relógio comum através da rede '
    + 'deles. Um navegador não faz parte disso, por isso reproduz sozinho.',
  'local.cannotPlay.title': 'Este navegador não consegue reproduzir isto',
  'local.cannotPlay.needsSpeaker':
    'Só um altifalante o consegue obter: um serviço de música entrega a '
    + 'transmissão ao sistema e uma partilha da biblioteca de música é '
    + 'montada pelos leitores. A rádio na Internet é reproduzida aqui.',
  'local.cannotPlay.unknown':
    'O Sonora não sabe reproduzir esta origem num navegador. A rádio na '
    + 'Internet é reproduzida aqui.',
  'local.cannotPlay.needsQueue':
    'Um álbum, uma lista de reprodução ou uma fila é uma lista de faixas, e '
    + 'essa lista é mantida pelo altifalante que a reproduz. Reproduza aqui '
    + 'uma única faixa ou uma estação.',
  'local.cannotPlay.needsLink':
    'O Sonora navega no {service} através dos altifalantes e não tem sessão '
    + 'própria para lhe pedir uma transmissão. Associe o serviço no Sonora e '
    + 'isto será reproduzido aqui.',
  'local.cannotPlay.serviceRefused':
    'O {service} não permite que o Sonora transmita isto fora do '
    + 'ecossistema Sonos. Experimente transmiti-lo diretamente para um leitor '
    + 'Sonos.',
  'local.cannotPlay.protected':
    'O {service} não permite que o Sonora transmita isto fora do '
    + 'ecossistema Sonos. Experimente transmiti-lo diretamente para um leitor '
    + 'Sonos.',
  'local.cannotDo.title': 'Só um altifalante pode fazer isso',
  'local.cannotDo.detail':
    'Este navegador é uma saída, não um leitor: sem equalizador, sem luz de '
    + 'estado, sem fila e sem par estéreo. O volume, a reprodução e a pausa '
    + 'funcionam.',
  'common.rooms.one': '{count} divisão',
  'common.rooms.other': '{count} divisões',
  'common.speakers.one': '{count} altifalante',
  'common.speakers.other': '{count} altifalantes',
  'common.groups.one': '{count} grupo',
  'common.groups.other': '{count} grupos',
  'common.items.one': '{count} item',
  'common.items.other': '{count} itens',
  'common.tracks.one': '{count} faixa',
  'common.tracks.other': '{count} faixas',
  'common.noResults': 'Sem resultados',
  'common.offline': 'offline',
  'common.system': 'Sistema {generation}',

  // --- start-up and failure states ---------------------------------------
  'splash.loading.title': 'À procura de altifalantes',
  'splash.loading.detail':
    'A enviar um pedido de deteção e a pedir ao primeiro altifalante que '
    + 'responder o resto do sistema.',
  'splash.empty.title': 'Não foram encontrados altifalantes',
  'splash.empty.detail':
    'A deteção usa multicast, por isso a máquina onde este controlador é '
    + 'executado tem de estar na mesma rede que os altifalantes, e não numa '
    + 'rede de convidados ou noutra VLAN.',
  'splash.error.title': 'Não é possível contactar o controlador',
  'splash.error.detail':
    'O servidor não respondeu. Verifique se está em execução.',
  'splash.searchAgain': 'Procurar novamente',
  'splash.crash.title': 'Este tema deixou de funcionar',
  'splash.crash.detail': 'Algo correu mal ao desenhá-lo. Recarregue a página ou escolha outro design abaixo.',
  'splash.reload': 'Recarregar',
  'rating.cannotUndo': 'O {service} não permite anular isto',
  'splash.connected': 'Ligado ao controlador',
  'splash.notConnected': 'Sem ligação',

  // --- notices ------------------------------------------------------------
  'notice.conflict.title': 'O altifalante recusou',
  'notice.skipLimit.title': 'Limite de saltos atingido',
  'notice.skipLimit.body': 'Atingiu o limite de saltos desta estação. Tente novamente mais tarde.',
  'notice.silent.title': 'O altifalante não respondeu',
  'notice.silent.body':
    '{room} deixou de responder por instantes. Normalmente volta sozinho; '
    + 'tente novamente dentro de alguns segundos.',
  'notice.error.title': 'Ocorreu um erro',
  'notice.network.title': 'Erro de rede',

  // --- what a room is doing ----------------------------------------------
  'search.category.artists': 'Artistas',
  'search.category.albums': 'Álbuns',
  'search.category.tracks': 'Músicas',
  'search.category.playlists': 'Listas de reprodução',
  'search.category.stations': 'Estações',
  'search.category.genres': 'Géneros',
  'search.category.podcasts': 'Podcasts e programas',
  'search.category.shows': 'Podcasts e programas',
  'search.category.audiobooks': 'Audiolivros',
  'search.category.people': 'Pessoas',
  'search.category.episodes': 'Episódios',
  'search.category.hosts': 'Apresentadores',
  'source.queue': 'Fila',
  'source.grouped': 'Agrupado',
  'source.line_in': 'Entrada de linha',
  'source.radio': 'Rádio',
  'source.service_stream': 'Rádio',
  'source.service_radio': 'Rádio',
  'source.service_hls': 'Rádio',
  'source.service_track': 'Serviço de streaming',
  'source.service_container': 'Serviço de streaming',
  'source.library_track': 'Biblioteca de música',
  'source.http_stream': 'Transmissão de rede',
  'source.external_session': 'AirPlay ou Spotify Connect',
  'source.tv': 'TV',
  'source.playlist': 'Lista de reprodução',
  'source.idle': 'Inativo',
  'source.unknown': 'Origem desconhecida',

  // --- web theme ----------------------------------------------------------
  'common.noMusicSelected': 'Sem músicas selecionadas',
  'common.queueIsEmpty': 'A Fila está vazia',
  'common.roomsGrouped': '{count} divisões agrupadas',
  'common.groupLabel': '{room} + {count}',
  'common.nothingQueued': 'Nada na fila',
  'common.setActive': 'Tornar {room} ativa',
  'common.openQueue': 'Abrir a fila',
  'common.seek': 'Procurar na faixa',
  'common.live': 'Em direto',
  'common.tv': 'TV',
  'desk.browse.lineIn': 'Entrada de linha',
  'desk.browse.noSelections': 'Não há seleções disponíveis.',
  'desk.browse.lineInNone':
    'Para utilizar a Entrada de linha, ligue um dispositivo a um produto '
    + 'Sonos com Entrada de linha.',
  'common.kind.playlist': 'Lista de reprodução',
  'common.kind.album': 'Álbum',

  // grouping

  // queue

  // settings
  'net.connection': 'Ligação',
  'net.live': 'em direto',
  'net.rescan': 'Procurar novamente na rede',

  // a service's own page
  'services.needsAccount':
    'O {service} não apresenta nada sem o token de sessão da sua conta. '
    + 'Esse token é guardado pelos altifalantes e nunca é exposto na rede, '
    + 'pelo que não é possível navegar no catálogo aqui; tudo o que tiver '
    + 'guardado dele nos Favoritos Sonos ou nas Listas de reprodução Sonos '
    + 'continua a ser reproduzido.',

  // --- Sonos account, network check and TV audio, used across themes -------
  'account.title': 'Conta Sonos',
  'account.blurb': 'As colunas que já configurou dão ao Sonora tudo o que precisa para o controlo diário do seu sistema Sonos.',
  'account.optional': 'Iniciar sessão na sua conta Sonos é opcional. Mostra a lista completa de serviços de música configurados no seu sistema com os respetivos logótipos, os serviços Sonos Labs disponíveis e o nome da entrada de TV que uma soundbar está a reproduzir.',
  'account.signIn': 'Iniciar sessão',
  'account.signOut': 'Terminar sessão',
  'account.signingIn': 'A iniciar sessão…',
  'account.email': 'E-mail',
  'account.password': 'Palavra-passe',
  'account.signedInAs': 'Sessão iniciada como: {email}',
  'account.notSignedIn': 'sem sessão iniciada',
  'net.scanning': 'A analisar a rede…',
  'net.scanDone': '{rooms} encontradas em {systems}',
  'common.systems.one': '{count} sistema',
  'common.systems.other': '{count} sistemas',
  'source.noSignal': 'Sem sinal',
  'desk.now.tvInput': 'Entrada',
  'desk.now.tvFormat': 'Formato',
  'tvFormat.0': 'Nenhuma entrada ligada',
  'tvFormat.2': 'Estéreo',
  'tvFormat.7': 'Dolby 2.0',
  'tvFormat.18': 'Dolby 5.1',
  'tvFormat.21': 'Sem entrada',
  'tvFormat.22': 'Sem áudio',
  'tvFormat.59': 'Dolby Atmos (DD+)',
  'tvFormat.61': 'Dolby Atmos (TrueHD)',
  'tvFormat.63': 'Dolby Atmos (MAT 2.0)',
  'tvFormat.33554434': 'PCM 2.0',
  'tvFormat.33554454': 'PCM 2.0 sem áudio',
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
  'desk.menu.edit': 'Editar',
  'desk.menu.view': 'Ver',
  'desk.menu.manage': 'Gerir',
  'desk.menu.help': 'Ajuda',
  'desk.menu.preferences': 'Preferências…',
  'desk.menu.checkUpdates': 'Procurar atualizações…',
  'desk.menu.cut': 'Cortar',
  'desk.menu.copy': 'Copiar',
  'desk.menu.paste': 'Colar',
  'desk.menu.mainWindow': 'Controlador Sonos',
  'desk.menu.miniController': 'Minicontrolador',
  'desk.menu.musicLibrarySettings': 'Definições da biblioteca de música…',
  'desk.menu.serviceSettings': 'Definições de serviços…',
  'desk.menu.addRadioStation': 'Adicionar estação de rádio…',
  'desk.radio.myShows': 'Os meus programas de rádio',
  'desk.radio.changeLocation': 'Alterar localização',
  'desk.radio.enterZip': 'Introduzir código postal',
  'desk.radio.zipBody': 'Introduza o seu código postal:',
  'desk.radio.pickCity': 'Escolher uma cidade',
  'desk.radio.locationSet': 'A rádio local passou a ser {city}.',
  'desk.radio.localRadio': 'Rádio local',
  'desk.radio.localRadioIn': 'Rádio local ({city})',
  'desk.radio.myStations': 'As minhas estações de rádio',
  'desk.radio.addNew': 'Adicionar nova estação de rádio',
  'desk.playlists.new': 'Nova lista de reprodução',
  'desk.playlists.addTitle': 'Adicionar música à lista de reprodução',
  'desk.playlists.removeSong': 'Remover música',
  'desk.playlists.removedSong': '{title} foi removida da lista de reprodução.',
  'desk.playlists.added': '{title} foi adicionada a {playlist}.',
  'desk.playlists.addedMany':
    'Foram adicionadas {count} músicas a {playlist}.',
  'desk.playlists.nameTitle': 'Dar um nome a esta lista de reprodução',
  'desk.playlists.nameBody': 'Dê um nome a esta lista de reprodução:',
  'desk.playlists.rename': 'Mudar o nome da lista',
  'desk.playlists.renameBody':
    'Introduza um novo nome para esta lista de reprodução:',
  'desk.playlists.delete': 'Eliminar lista de reprodução',
  'desk.playlists.deleted': '«{title}» foi eliminada.',
  'desk.queue.editedTitle': 'A Fila foi editada',
  'desk.queue.editedBody': 'Reproduzir isto irá substituir a fila.',
  'desk.queue.playAnyway': 'Reproduzir na mesma',
  'desk.radio.title': 'Adicionar uma estação de rádio',
  'desk.radio.intro': 'Introduza as informações da nova estação de rádio.',
  'desk.radio.where':
    'A nova estação de rádio será adicionada a TuneIn > As minhas estações '
    + 'de rádio.',
  'desk.radio.url': 'URL de streaming',
  'desk.radio.name': 'Nome da estação',
  'desk.radio.added':
    '«{title}» foi adicionada a As minhas estações de rádio.',
  'desk.radio.exists': '«{title}» já está em As minhas estações de rádio.',
  'desk.menu.updateLibrary': 'Atualizar biblioteca de música agora',
  'desk.menu.systemHelp': 'Ajuda do sistema Sonos',
  'desk.menu.supportSite': 'Site de suporte técnico',
  'desk.menu.submitDiagnostics': 'Enviar diagnóstico',
  'desk.menu.about': 'Acerca do meu sistema Sonos',
  'desk.menu.disabledNote':
    'Os itens a cinzento só estão disponíveis na aplicação Sonos.',
  'desk.transport.groupVolume': 'Volume do grupo',
  'desk.transport.back30': 'Recuar 30 segundos',
  'desk.transport.forward30': 'Avançar 30 segundos',
  'desk.transport.repeatOff': 'Repetição desativada',
  'desk.transport.repeatOne': 'Repetir faixa',
  'desk.transport.repeatAll': 'Repetir tudo',
  'desk.transport.crossfade': 'Transição gradual',
  'desk.rooms.title': 'Divisões',
  'desk.rooms.system': 'Sistema',
  'desk.rooms.pauseAll': 'Pausar tudo',
  'desk.rooms.pause': 'Pausa',
  'desk.rooms.confirmPauseAll':
    'Tem a certeza de que pretende colocar em pausa a música em todas as '
    + 'divisões?',
  'desk.rooms.playGroup': 'Reproduzir grupo',
  'desk.rooms.pauseGroup': 'Pausar grupo',
  'desk.rooms.stopGroup': 'Parar grupo',
  'desk.rooms.offline': 'Sem ligação',
  'desk.rooms.batteryLevel': '{level}%',
  'desk.rooms.battery': 'Bateria {level}%',
  'desk.rooms.batteryCharging': 'Bateria {level}%, a carregar',
  'desk.now.title': 'A reproduzir',
  'desk.now.next': 'Seguinte',
  'desk.now.noMusic': '[Nenhuma música selecionada]',
  'desk.now.episode': 'Episódio',
  'desk.now.podcast': 'Podcast',
  'desk.now.releaseDate': 'Data de lançamento',
  'desk.now.chapter': 'Capítulo',
  'desk.now.author': 'Autor',
  'desk.now.narrator': 'Narrador',
  'desk.now.book': 'Livro',
  'desk.now.station': 'Estação',
  'desk.now.onNow': 'No ar',
  'desk.now.information': 'Informações',
  'desk.now.zp.connecting': 'A ligar...',
  'desk.now.zp.buffering': 'A iniciar...',
  'desk.now.zp.starting': 'A iniciar...',
  'desk.now.artist': 'Artista',
  'desk.now.album': 'Álbum',
  'desk.now.song': 'Música [{n}/{total}]',
  'desk.now.songLabel': 'Música',
  'desk.now.infoOptions': 'Informações e opções',
  'desk.now.thumbsUp': 'Gosto',
  'desk.now.thumbsDown': 'Não gosto',
  'desk.info.source': 'Origem',
  'desk.info.room': 'Divisão',
  'desk.info.duration': 'Duração',
  'desk.info.station': 'Estação',
  'desk.info.addMyStations': 'Adicionar a As minhas estações de rádio',
  'desk.info.removeMyStations': 'Remover de As minhas estações de rádio',
  'desk.radio.removedMine':
    '{title} foi removida de As minhas estações de rádio',
  'desk.info.addMyShows': 'Adicionar a Os meus programas de rádio',
  'desk.radio.addedMine':
    '{title} foi adicionada a As minhas estações de rádio',
  'desk.radio.addedShow':
    '{title} foi adicionado a Os meus programas de rádio',
  'desk.radio.alreadyShow': '{title} já está em Os meus programas de rádio',
  'desk.radio.alreadyMine': '{title} já está em As minhas estações de rádio',
  'desk.info.startRadio': 'Iniciar rádio',
  'desk.info.addToServicePlaylist':
    'Adicionar música a uma lista de reprodução do {service}',
  'desk.info.saveToMusic': 'Guardar na sua música',
  'desk.info.addSongFavorite': 'Adicionar música aos Favoritos Sonos',
  'desk.info.removeFavorite': 'Remover dos Favoritos Sonos',
  'desk.info.removedFavorite': '{title} foi removido dos Favoritos Sonos',
  'desk.info.albumInfo': 'Informações do álbum',
  'desk.info.artistInfo': 'Informações do artista',
  'desk.info.podcastInfo': 'Informações do podcast',
  'desk.info.provider': 'Fornecedor',
  'desk.info.addEpisodeFavorite': 'Adicionar episódio aos Favoritos Sonos',
  'desk.info.addEpisodePlaylist':
    'Adicionar episódio a uma Lista de reprodução Sonos',
  'desk.info.actionDone': 'Concluído.',
  'desk.info.actionFailed': 'O serviço recusou o pedido.',
  'desk.info.viewAllSongs': 'Ver todas as músicas do álbum',
  'desk.info.addAlbumFavorite': 'Adicionar álbum aos Favoritos Sonos',
  'desk.info.addBookFavorite': 'Adicionar livro aos Favoritos Sonos',
  'desk.info.addAlbumPlaylist':
    'Adicionar álbum a uma Lista de reprodução Sonos',
  'desk.info.addToSonosPlaylist':
    'Adicionar música a uma Lista de reprodução Sonos',
  'desk.info.addStationFavorite': 'Adicionar estação aos Favoritos Sonos',
  'desk.info.addedFavorite': '«{title}» foi adicionado aos Favoritos Sonos.',
  'desk.info.alreadyFavorite': '«{title}» já está nos Favoritos Sonos.',
  'desk.queue.title': 'Fila',
  'desk.queue.notInUse': '(Não utilizada)',
  'desk.queue.collapse': 'Mostrar A reproduzir',
  'desk.queue.expand': 'Expandir a fila',
  'desk.queue.songs.one': '{count} música',
  'desk.queue.songs.other': '{count} músicas',
  'desk.queue.empty': 'A Fila está vazia',
  'win.queue.empty': 'A Fila está vazia.',
  'win.queue.confirmTitle': 'Confirmar',
  'win.queue.confirmClear': 'Tem a certeza de que pretende limpar a Fila?',
  'win.queue.clearAction': 'Limpar',
  'desk.queue.clear': 'Limpar Fila',
  'desk.queue.save': 'Guardar Fila',
  'desk.queue.confirmClear': 'Limpar a Fila',
  'desk.queue.playSong': 'Reproduzir música',
  'desk.queue.removeSong': 'Remover música',
  'desk.queue.playEpisode': 'Reproduzir episódio',
  'desk.queue.removeEpisode': 'Remover episódio',
  'desk.queue.playTrack': 'Reproduzir a faixa {n}',
  'desk.browse.root': 'Selecione uma fonte de música',
  'desk.browse.music': 'Música',
  'desk.browse.favorites': 'Favoritos Sonos',
  'desk.browse.updateNow': 'Atualizar agora',
  'desk.update.title': 'Atualização disponível',
  'desk.update.body':
    'Há uma atualização pronta para os teus altifalantes Sonos: versão '
    + '{version}. A música para em cada divisão durante a instalação, o que '
    + 'pode demorar alguns minutos.',
  'desk.update.bodySystem':
    'Há uma atualização pronta para os teus altifalantes Sonos {system}: versão '
    + '{version}. A música para em cada divisão durante a instalação, o que '
    + 'pode demorar alguns minutos.',
  'desk.update.start': 'Atualizar',
  'desk.update.notNow': 'Agora não',
  'desk.update.started':
    'A atualização começou. Cada divisão reinicia quando terminar.',
  'desk.browse.library': 'Biblioteca de música',
  'desk.browse.playlists': 'Listas de reprodução Sonos',
  'desk.browse.radio': 'TuneIn',
  'desk.browse.addServices': 'Adicionar serviços de música',
  'desk.browse.addServicesFor': 'Adicionar serviços de música {gen}',
  'desk.browse.switchAccount': 'Mudar de conta',
  'desk.browse.sleepTimer': 'Temporizador',
  'desk.browse.alarms': 'Despertadores',
  'desk.browse.results': 'Resultados: {query}',
  'desk.search.in': 'Pesquisar em {service}',
  'desk.search.clear': 'Limpar pesquisa',
  'desk.search.recent': 'Pesquisas recentes',
  'desk.search.clearRecent': 'Limpar pesquisas recentes',
  'desk.search.scope': 'Escolher onde pesquisar',
  'desk.browse.noResults':
    'A pesquisa não devolveu resultados para «{query}». Tente uma categoria '
    + 'diferente ou um novo termo de pesquisa.',
  'desk.browse.selectRoom':
    'Selecione uma divisão para procurar música para ela.',
  'desk.browse.loading': 'A carregar…',
  'desk.browse.empty': 'Não há seleções disponíveis.',
  'desk.browse.unableToBrowse': 'Não é possível navegar nas músicas',
  'desk.browse.actions': 'Mais opções',
  'desk.browse.select': 'Selecionar',
  'desk.browse.needsLink.body':
    'O {service} está associado ao seu sistema Sonos {gen}.\nSe quiser '
    + 'navegar e controlar o {service}, também terá de o associar ao Sonora. '
    + 'É um início de sessão separado e não altera nada na sua aplicação '
    + 'Sonos.',
  'desk.browse.needsLink.action': 'Associar o {service} ao Sonora',
  'desk.actions.playNow': 'Reproduzir agora',
  'desk.actions.playNext': 'Reproduzir a seguir',
  'desk.actions.addToQueue': 'Adicionar ao fim da fila',
  'desk.actions.addFavorite': 'Adicionar aos Favoritos Sonos',
  'desk.actions.unselectAll': 'Desmarcar tudo',
  'desk.actions.replaceQueue': 'Substituir fila',
  'desk.favorites.addToSonosPlaylist':
    'Adicionar a uma Lista de reprodução Sonos',
  'desk.favorites.addToServicePlaylist':
    'Adicionar a uma lista de reprodução do {service}',
  'desk.favorites.rename': 'Mudar o nome do Favorito Sonos',
  'desk.favorites.remove': 'Remover dos Favoritos Sonos',
  'desk.favorites.renameBody':
    'Introduza um novo nome para este Favorito Sonos:',
  'desk.favorites.removed': '«{title}» foi removido dos Favoritos Sonos.',
  'common.ok': 'OK',
  'desk.grouping.title': 'Agrupar divisões',
  'desk.grouping.willPlay': 'As divisões selecionadas vão reproduzir:',
  'desk.grouping.select': 'Selecione as divisões a agrupar:',
  'desk.grouping.partyMode': 'Selecionar tudo - Modo festa',
  'desk.grouping.noMusic': '[sem música]',
  'desk.grouping.chooseMusic': 'Clique em Concluído para escolher a música',
  'desk.grouping.pickTitle': 'Selecionar música',
  'desk.grouping.pickHeading':
    'Selecionar a música a reproduzir na divisão selecionada',
  'desk.grouping.unselectAll': 'Desmarcar tudo',
  'desk.grouping.noneTitle': 'Nenhuma divisão selecionada',
  'desk.grouping.noneBody':
    'Isto irá parar qualquer música que esteja a ser reproduzida. Pretende '
    + 'continuar?',
  'desk.grouping.noneYes': 'Sim',
  'desk.prefs.title': 'Preferências',
  'desk.prefs.general': 'Gerais',
  'desk.prefs.basic': 'Básico',
  'desk.prefs.themeShot': 'Pré-visualização do tema {theme}',
  'desk.prefs.themeNoShot': 'Sem pré-visualização para este tema.',
  'desk.prefs.themeVersion': 'versão {version}',
  'desk.prefs.themeInstalled': 'instalado',
  'desk.prefs.manageThemes': 'Gerir temas',
  'desk.prefs.themeUpload': 'Instalar tema…',
  'desk.prefs.themeDelete': 'Eliminar tema',
  'desk.prefs.themeBuiltIn':
    'Os temas incluídos no Sonora não podem ser eliminados.',
  'desk.room.nightSound': 'Som noturno',
  'desk.room.speech': 'Melhoria do diálogo',
  'desk.room.sub': 'Subwoofer',
  'desk.room.subLevel': 'Nível do subwoofer',
  'desk.room.surround': 'Surround',
  'desk.room.surroundLevel': 'Nível da TV',
  'desk.room.musicSurroundLevel': 'Nível da música',
  'desk.room.audioDelay': 'Atraso de áudio (sincronização labial)',
  'desk.room.heightLevel': 'Nível de altura',
  'desk.room.lineInName': 'Nome da origem da Entrada de linha',
  'desk.room.lineInLevel': 'Nível da origem da Entrada de linha',
  'desk.room.autoplayRoom': 'Divisão de reprodução automática',
  'desk.room.autoplayOff': 'Desligado',
  'desk.room.autoplayLinked': 'Incluir divisões de grupo',
  'desk.room.autoplayUseVolume': 'Usar volume de reprodução automática',
  'desk.room.autoplayVolume': 'Volume de reprodução automática',
  'desk.room.stereoPair': 'Par estéreo',
  'desk.room.separate': 'Separar par estéreo',
  'desk.room.separateBody':
    'Separar o par estéreo «{room}» novamente em duas divisões? A '
    + 'reprodução para enquanto os altifalantes se reorganizam.',
  'desk.room.pairWith': 'Escolher o altifalante direito…',
  'desk.room.createPair': 'Criar par estéreo',
  'desk.room.pairBody':
    'Tornar «{left}» o canal esquerdo e «{right}» o canal direito de um par '
    + 'estéreo? O par mantém o nome «{left}»; a reprodução para enquanto os '
    + 'altifalantes se reorganizam.',
  'desk.rooms.showMore': 'Apresentar mais {n}…',
  'desk.rooms.showLess': 'Mostrar menos…',
  'desk.rooms.allSystems': 'Todos',
  'desk.rooms.menu.play': 'Reproduzir {name}',
  'desk.rooms.menu.pause': 'Colocar em pausa {name}',
  'desk.rooms.menu.stop': 'Parar {name}',
  'desk.rooms.menu.mute': 'Silenciar {name}',
  'desk.rooms.menu.unmute': 'Não silenciar {name}',
  'desk.rooms.menu.eq': 'EQ de {name}…',
  'desk.rooms.menu.group': 'Agrupar',
  'desk.prefs.musicLibrary': 'Definições da biblioteca de música',
  'desk.prefs.services': 'Definições de serviços',
  'desk.prefs.parental': 'Controlo parental',
  'desk.prefs.dateTime': 'Definições de data e hora',
  // The Mac Preferences window (S1 57.x on Tahoe, 2026-09-15).
  'desk.prefs.eqSettings': 'Definições de EQ',
  'desk.prefs.musicLibraryShort': 'Biblioteca de música',
  'desk.prefs.servicesShort': 'Serviços',
  'desk.prefs.dateTimeShort': 'Data e hora',
  'desk.prefs.sonora': 'Sonora',
  'desk.prefs.mobileNote':
    'Abra a aplicação Sonos num dispositivo móvel para gerir o seu sistema.',
  'desk.prefs.getMobileApp': 'Obter a aplicação móvel',
  'desk.prefs.eqFor': 'Definições de EQ de música para',
  'desk.prefs.eqCaption': 'Ajuste os agudos e os graves a seu gosto.',
  'desk.prefs.roomFor': 'Definições da divisão para',
  'desk.prefs.noRooms': 'Não foram encontradas divisões Sonos.',
  'desk.prefs.folderCol': 'Pasta',
  'desk.prefs.pathCol': 'Caminho',
  'desk.prefs.serviceNameCol': 'Nome do serviço',
  'desk.prefs.nameCol': 'Nome',
  'desk.prefs.loginCol': 'Início de sessão',
  'desk.prefs.anonymous': '<Anónimo>',
  'desk.prefs.changeName': 'Alterar nome',
  'desk.prefs.reauthorize': 'Voltar a autorizar a conta',
  'desk.prefs.visitLabs': 'Visitar o Sonos Labs',
  'desk.menu.settings': 'Definições…',
  // The Mac app's sheets and About window (2026-09-15).
  'desk.queue.confirmTitle': 'Confirmar',
  'desk.queue.clearBody': 'Tem a certeza de que pretende limpar a Fila?',
  'desk.queue.enterName': 'Introduza um nome para a nova lista de reprodução:',
  'desk.queue.orReplace':
    'Ou selecione uma lista de reprodução Sonos existente para substituir:',
  'desk.sleep.setFor': 'Definir um temporizador para «{room}»:',
  'desk.about.sonosOs': 'Sonos OS',
  'desk.about.products': 'Produtos',
  'desk.about.systemLine': 'Sonos OS {gen}: {count} produtos',
  'desk.about.serial': 'Número de série',
  'desk.about.hardware': 'Versão do hardware',
  'desk.about.series': 'ID da série',
  'desk.about.ip': 'Endereço IP',
  'desk.about.wm': 'WM',
  'desk.about.copy': 'Copiar',
  'desk.about.copied': 'Copiado',
  'desk.alarms.note':
    'Os despertadores são criados e editados na aplicação Sonos; aqui pode '
    + 'ligá-los, desligá-los e eliminá-los.',
  'desk.alarms.deleteBody': 'Eliminar o despertador das {time} em {room}?',
  'desk.alarms.deleteTitle': 'Eliminar despertador',
  'desk.alarms.recurrence.WEEKENDS': 'Fins de semana',
  'desk.alarms.recurrence.WEEKDAYS': 'Dias úteis',
  'desk.alarms.recurrence.DAILY': 'Todos os dias',
  'desk.alarms.recurrence.ONCE': 'Uma vez',
  'desk.alarms.repeat': 'Repetir',
  'desk.alarms.room': 'Divisão',
  'desk.alarms.time': 'Hora',
  'desk.alarms.enabled': 'Ativado',
  'desk.alarms.delete': 'Eliminar',
  'desk.alarms.none': 'Não há despertadores neste sistema.',
  'win.saveQueue.name': 'Introduza um nome para a nova lista de reprodução:',
  'win.saveQueue.replace':
    'Ou selecione uma lista de reprodução Sonos existente para substituir:',
  'win.alarm.addTitle': 'Adicionar despertador',
  'win.alarm.editTitle': 'Editar despertador',
  'win.alarm.alarm': 'Despertador',
  'win.alarm.on': 'Ligado',
  'win.alarm.off': 'Desligado',
  'win.alarm.music': 'Música',
  'win.alarm.select': 'Selecionar…',
  'win.alarm.schedule': 'Programação',
  'win.alarm.onceOnly': 'Apenas uma vez',
  'win.alarm.volume': 'Volume',
  'win.alarm.duration': 'Duração',
  'win.alarm.noLimit': 'Sem limite',
  'win.alarm.linked': 'Incluir divisões agrupadas',
  'win.alarm.shuffle': 'Reproduzir música aleatoriamente',
  'win.alarm.chime': 'Toque Sonos',
  'win.alarm.browseTitle': 'Procurar música para o despertador',
  'win.alarm.alarmMusic': 'Música do despertador',
  'win.alarm.importedPlaylists': 'Listas de reprodução importadas',
  'win.alarm.setMusic': 'Definir música do despertador',
  'win.alarm.day.1': 'Segunda-feira',
  'win.alarm.day.2': 'Terça-feira',
  'win.alarm.day.3': 'Quarta-feira',
  'win.alarm.day.4': 'Quinta-feira',
  'win.alarm.day.5': 'Sexta-feira',
  'win.alarm.day.6': 'Sábado',
  'win.alarm.day.0': 'Domingo',
  'win.alarms.manage': 'Gerir despertadores Sonos',
  'win.alarms.currentTime': 'Hora atual: {time}',
  'desk.alarms.currentTime': 'Hora atual: {date} - {time} {zone}',
  'win.alarms.where': 'Onde',
  'win.alarms.when': 'Quando',
  'win.alarms.on': 'LIGADO',
  'win.alarms.add': 'Adicionar',
  'win.alarms.edit': 'Editar',
  'win.alarms.remove': 'Remover',
  'win.alarms.deleteConfirm':
    'Tem a certeza de que pretende eliminar este despertador?',
  'win.alarms.help1':
    'Clique em «Adicionar» para adicionar um novo despertador.',
  'win.alarms.help2':
    'Clique em «Remover» para remover o despertador selecionado.',
  'desk.alarms.day.0': 'Dom',
  'desk.alarms.day.1': 'Seg',
  'desk.alarms.day.2': 'Ter',
  'desk.alarms.day.3': 'Qua',
  'desk.alarms.day.4': 'Qui',
  'desk.alarms.day.5': 'Sex',
  'desk.alarms.day.6': 'Sáb',
  'desk.queue.saveHint': 'Nome da lista de reprodução',
  'desk.queue.saveBody':
    'A Fila será guardada como lista de reprodução Sonos.',
  'desk.queue.saveTitle': 'Guardar Fila',
  'desk.queue.mixName': 'Mix de {weekday}, {part}',
  'desk.queue.part.morning': 'manhã',
  'desk.queue.part.afternoon': 'tarde',
  'desk.queue.part.night': 'noite',
  'desk.sleep.none': 'Nenhum temporizador definido.',
  'desk.sleep.elsewhere': 'Também ativo noutro local',
  'desk.sleep.remaining': 'Temporizador: faltam {time}',
  'desk.sleep.minutes': '{count} minutos',
  'desk.sleep.off': 'Desligado',
  'desk.sleep.hours.one': '{count} hora',
  'desk.sleep.hours.other': '{count} horas',
  'services.needsSignIn':
    'O {service} precisa de um início de sessão antes de apresentar alguma '
    + 'coisa. Associe-o ao Sonora para navegar nele aqui; tudo o que tiver '
    + 'guardado dele nos Favoritos Sonos ou nas Listas de reprodução Sonos '
    + 'continua a ser reproduzido.',
  'desk.library.folders': 'Pastas',
  'desk.library.advanced': 'Avançadas',
  'desk.library.mine': 'As minhas pastas de música no Sonos',
  'desk.library.none':
    'Não foram adicionadas pastas de música a este sistema Sonos.',
  'desk.library.addFolder': 'Adicionar…',
  'desk.library.add': 'Adicionar',
  'desk.library.remove': 'Remover',
  'desk.library.pathHint': '//nas/Musica',
  'desk.library.pathNote':
    'O Sonora adiciona pastas pelo caminho de rede (por exemplo, '
    + '//nas/Musica). A pasta já tem de estar partilhada na sua rede. Os '
    + 'leitores S1 só conseguem usar partilhas SMBv1; os leitores S2 também '
    + 'suportam SMBv2 e SMBv3.',
  'desk.shareWizard.windowTitle': 'Configuração do Sonora',
  'desk.shareWizard.whereTitle': 'Adicionar pasta de música',
  'desk.shareWizard.wherePrompt': 'Onde está a música que quer reproduzir no Sonos?',
  'desk.shareWizard.myMusic': 'Pasta Música',
  'desk.shareWizard.otherFolder': 'Outra pasta ou uma unidade ligada ao meu computador',
  'desk.shareWizard.network': 'Dispositivo em rede (ex.: unidade NAS)',
  'desk.shareWizard.serverNote': 'O Sonora é executado num servidor, por isso as pastas deste computador estão fora do seu alcance: pode adicionar uma pasta partilhada na rede.',
  'desk.shareWizard.pathTitle': 'Adicionar música da partilha de rede',
  'desk.shareWizard.pathPrompt': 'Escreva o caminho da partilha de rede:',
  'desk.shareWizard.loginTitle': 'Nome de utilizador e palavra-passe',
  'desk.shareWizard.loginPrompt': 'Introduza o nome de utilizador e a palavra-passe da unidade de rede com a sua música. Deixe ambos vazios se a partilha não os pedir.',
  'desk.shareWizard.fieldLabel': '{label}:',
  'desk.shareWizard.adding': 'A adicionar as informações da partilha ao sistema Sonos.',
  'desk.shareWizard.done': '"{path}" está agora configurado no seu sistema Sonos. A música está a ser adicionada à biblioteca.',
  'desk.shareWizard.failedTitle': 'O Sonos não conseguiu adicionar a pasta de música',
  'desk.shareWizard.pathExamples': 'Exemplos:\n\\\\MyOtherComputer\\Shared\\Music\n\\\\MyNetworkedStorage\\Shared\\Music',
  'desk.library.username': 'Nome de utilizador',
  'desk.library.password': 'Palavra-passe',
  'desk.library.credHint':
    'Deixe ambos em branco só se a partilha permitir convidados. Muitos '
    + 'servidores já não o permitem.',
  'desk.library.removeTitle': 'Remover pasta de música',
  'desk.library.removeBody':
    'Remover {folder} da biblioteca de música do seu sistema Sonos? A '
    + 'música nela deixará de aparecer no Sonos.',
  'desk.library.indexTitle': 'Atualizações da biblioteca',
  'desk.library.schedule': 'Atualizar o índice de música todos os dias às',
  'desk.library.updateNow': 'Atualizar índice de música agora',
  'desk.library.noFolders': 'Ainda não adicionou nenhuma pasta de música ao seu sistema Sonos.',
  'desk.library.addHint': 'Para adicionar música ao Sonos, escolha {link} no menu {menu}.',
  'desk.library.working':
    'A atualizar as definições da sua biblioteca de música…',
  'desk.library.indexing': 'A atualizar a Biblioteca de música… Aguarde.',
  'desk.library.indexError':
    'O Sonos não conseguiu concluir a atualização do índice de música: '
    + '{error}',
  'desk.library.addPending':
    'O Sonos ainda está a adicionar essa pasta. Aparece aqui assim que os '
    + 'leitores a montarem.',
  'desk.library.adding': 'A adicionar pasta de música',
  'desk.library.addedIndexing':
    'Adicionada. O Sonos está a atualizar o índice de música, o que pode '
    + 'demorar vários minutos no caso de uma pasta grande.',
  'desk.library.addingPath':
    '{path} — os leitores estão a montá-la. Isto pode demorar vários '
    + 'minutos no caso de uma pasta grande.',
  'desk.library.addFailed':
    'O Sonos não conseguiu adicionar a pasta de músicas {path}.',
  'desk.library.addFailedWhy':
    'Verifique se o caminho da pasta e, se necessário, o nome de utilizador '
    + 'e a palavra-passe estão corretos.',
  'desk.library.addReason': 'Motivo: {reason}',
  'desk.library.compilations': 'Agrupar álbuns usando',
  'desk.library.updateDaily': 'Atualizar o conteúdo todos os dias às:',
  'desk.library.showContributing':
    'Mostrar artistas participantes na Biblioteca de música. Esta '
    + 'preferência afeta apenas este controlador.',
  'desk.library.sortFolders': 'Ordenar pastas por',
  'desk.library.sort.songNumber': 'Número da música',
  'desk.library.sort.songName': 'Nome da música',
  'desk.library.sort.fileName': 'Nome do ficheiro',
  'desk.library.artists': 'Artistas',
  'desk.library.contributingArtists': 'Artistas participantes',
  'desk.library.albums': 'Álbuns',
  'desk.library.composers': 'Compositores',
  'desk.library.genres': 'Géneros',
  'desk.library.songs': 'Músicas',
  'desk.library.importedPlaylists': 'Listas de reprodução importadas',
  'desk.library.foldersNode': 'Pastas',
  'desk.library.groupBy': 'Agrupar compilações usando',
  'desk.library.group.ITUNES': 'Compilações do iTunes®',
  'desk.library.group.WMP': 'Artistas do álbum',
  'desk.library.group.NONE': 'Não agrupar compilações',
  'desk.library.compilationsNote':
    'Alterar a forma como as compilações são agrupadas atualiza o índice de '
    + 'música.',
  'desk.time.timeZone': 'Fuso horário',
  'desk.time.autoDst': 'Ajustar automaticamente para a hora de verão',
  'desk.time.internet': 'Definir a data e a hora a partir da Internet',
  'desk.time.date': 'Data',
  'desk.time.time': 'Hora',
  'desk.time.dateFormat': 'Formato da data',
  'desk.time.timeFormat': 'Formato da hora',
  'desk.time.fmt.MDY': 'Mês/Dia/Ano',
  'desk.time.fmt.DMY': 'Dia/Mês/Ano',
  'desk.time.fmt.YMD': 'Ano/Mês/Dia',
  'desk.time.fmt.12H': '12 horas',
  'desk.time.fmt.24H': '24 horas',
  'desk.time.notSet': 'Não definida',
  'desk.time.setNow': 'Definir',
  'desk.time.loading': 'A ler as definições de hora…',
  'desk.time.server': 'Servidor de hora: {server}',
  'desk.parental.body':
    'A filtragem de conteúdos explícitos é uma definição do próprio sistema '
    + 'Sonos, partilhada por todas as aplicações que o controlam. O Sonora '
    + 'lê-a dos seus altifalantes e mostra-a abaixo.\nAlterá-la exige uma '
    + 'credencial que a Sonos só emite para as suas próprias aplicações: os '
    + 'altifalantes aceitam a alteração de qualquer controlador, mas apenas '
    + 'com um token emitido para a aplicação Sonos, e a única permissão que a '
    + 'Sonos oferece a outros programadores abrange apenas a reprodução. A '
    + 'aplicação Sonos consegue fazê-lo; esta aguarda uma resposta da '
    + 'Sonos.\nNem todos os serviços suportam a filtragem de conteúdos.',
  'desk.parental.filter': 'Filtrar conteúdos explícitos',
  'desk.parental.filterFor': 'Filtrar conteúdos explícitos em {system}',
  'desk.parental.on': 'Filtragem de conteúdos ligada',
  'desk.parental.off': 'Filtragem de conteúdos desligada',
  'desk.parental.unknown': 'Não foi possível ler a filtragem de conteúdos',
  'desk.parental.reading': 'A ler a definição…',
  'desk.parental.turnOn': 'Ativar filtro de conteúdo explícito',
  'desk.parental.moreInfo': 'Mais informações',
  'desk.parental.unavailable':
    'A Sonos só permite que as suas próprias aplicações alterem isto',
  'desk.prefs.roomSettings': 'Definições da divisão',
  'desk.prefs.settingsFor': 'Definições de {room}',
  'desk.prefs.musicEq': 'Equalização da música',
  'desk.prefs.device': 'Dispositivo',
  'desk.prefs.bass': 'Graves',
  'desk.prefs.treble': 'Agudos',
  'desk.prefs.balance': 'Equilíbrio',
  'desk.prefs.left': 'E',
  'desk.prefs.right': 'D',
  'desk.prefs.loudness': 'Loudness',
  'desk.prefs.reset': 'Repor',
  'desk.prefs.eqFixed':
    'As definições de equalização não estão disponíveis enquanto o nível da '
    + 'saída de linha de um altifalante Sonos estiver definido como Fixo.',
  'desk.prefs.roomName': 'Nome da divisão',
  'desk.prefs.apply': 'Aplicar',
  'desk.prefs.statusLight': 'Luz de estado',
  'desk.prefs.on': 'Ligado',
  'desk.prefs.off': 'Desligado',
  'desk.prefs.servicesTitle': 'As minhas contas de serviços no Sonos',
  'desk.prefs.servicesSignIn':
    'Não há serviços configurados na lista. O Sonora lê-os dos próprios '
    + 'altifalantes, por isso normalmente significa que não foi possível '
    + 'contactar nenhum.',
  'desk.about.title': 'Acerca do meu sistema Sonos',
  'desk.about.body': 'Altifalantes nesta rede, por sistema.',
  'desk.about.model': 'Modelo',
  'desk.about.version': 'Versão',
  'desk.about.address': 'Endereço',
  'desk.about.speakers': 'Altifalantes',
  'desk.about.system': 'Sistema',
  'desk.shortcuts.title': 'Atalhos de teclado',
  'desk.shortcuts.playPause': 'Reproduzir/Pausa',
  'desk.shortcuts.volUp': 'Aumentar volume',
  'desk.shortcuts.volDown': 'Diminuir volume',
  'desk.shortcuts.mute': 'Silenciar/ativar som da divisão/grupo atual',
  'desk.shortcuts.nextZone': 'Selecionar grupo de divisões seguinte',
  'desk.shortcuts.prevZone': 'Selecionar grupo de divisões anterior',
  'notice.cannotPlay.title': 'Não foi possível reproduzir',
  'notice.cannotPlay.detail':
    '{room} não conseguiu reproduzir {item}. {reason}',
  'notice.cannotPlay.stream':
    '{room} não conseguiu reproduzir {item}: {host} não devolveu nada. '
    + '{reason}',
  'notice.cannotPlay.format': 'O altifalante não suporta esse formato.',
  'notice.cannotPlay.connect': 'O altifalante não o conseguiu contactar.',
  'notice.cannotPlay.refused': 'O serviço recusou reproduzi-lo.',
  'notice.cannotPlay.missing': 'Já não existe.',
  'notice.cannotPlay.permission':
    'Esta conta não tem permissão para o reproduzir.',
  'notice.notPlaying.title': 'Nada começou a ser reproduzido',
  'notice.notPlaying.detail':
    '{room} aceitou Reproduzir, mas voltou a parar. Não foi possível '
    + 'reproduzir a origem atual; escolha outra coisa no painel de música.',
  'notice.notPlaying.stream':
    '{room} aceitou Reproduzir, mas voltou a parar. A origem é uma '
    + 'transmissão de {host}, que parece estar offline.',
  'desk.menu.quit': 'Sair do Sonos',
  'desk.menu.delete': 'Eliminar',
  'desk.menu.selectAll': 'Selecionar tudo',
  'desk.menu.fullScreen': 'Entrar em ecrã completo',
  'desk.menu.updatePlaylists':
    'Atualizar listas de reprodução do iTunes agora',
  'desk.menu.updateAlbumArt': 'Atualizar capas de álbuns agora',
  'desk.menu.window': 'Janela',
  'desk.menu.close': 'Fechar',
  'desk.menu.uninstall': 'Desinstalar…',
  'desk.menu.services': 'Serviços',
  'desk.menu.hideSonos': 'Ocultar Sonos',
  'desk.menu.hideOthers': 'Ocultar outros',
  'desk.menu.showAll': 'Mostrar tudo',
  'desk.menu.autofill': 'Preenchimento automático',
  'desk.menu.dictation': 'Iniciar ditado…',
  'desk.menu.emoji': 'Emojis e símbolos',
  'desk.menu.fill': 'Preencher',
  'desk.menu.center': 'Centrar',
  'desk.menu.moveResize': 'Mover e redimensionar',
  'desk.menu.fullScreenTile': 'Mosaico em ecrã completo',
  'desk.menu.removeFromSet': 'Remover janela do conjunto',
  'win.menu.file': 'Ficheiro',
  'win.menu.exit': 'Sair',
  'win.menu.showMini': 'Mostrar minicontrolador',
  'win.shortcuts.toggleMini': 'Mostrar/ocultar minicontrolador',
  'win.setup.title': 'Configuração do Sonora',
  'win.setup.lib.pathTitle': 'Adicionar música da sua partilha de rede',
  'win.setup.lib.pathText': 'Escreva o caminho para a sua partilha de rede:',
  'win.setup.lib.examples': 'Exemplos:',
  'win.setup.lib.browse': 'Procurar',
  'win.setup.lib.credTitle': 'Nome de utilizador e palavra-passe',
  'win.setup.lib.credText':
    'Introduza o nome de utilizador e a palavra-passe, se existirem, da '
    + 'unidade de rede que contém a sua música:',
  'win.setup.lib.username': 'Nome de utilizador:',
  'win.setup.lib.password': 'Palavra-passe:',
  'win.setup.lib.adding': 'A adicionar pasta de música',
  'win.setup.lib.doneTitle': 'Configuração da biblioteca de música',
  'win.setup.lib.doneSetUp':
    '«{folder}» está agora configurada no seu sistema Sonos.',
  'win.setup.lib.doneAdding':
    'A sua música está a ser adicionada ao sistema Sonos. Isto pode demorar '
    + 'vários minutos.',
  'win.setup.lib.doneNotice':
    'Mais tarde, pode adicionar música ao Sonos em «Gerir Biblioteca de '
    + 'música», nas Definições.',
  'win.setup.lib.errorTitle': 'Erro ao adicionar música',
  'win.setup.lib.errorMessage':
    'O Sonos não conseguiu adicionar a pasta de música',
  'win.setup.lib.errorDetails':
    'Verifique se o caminho da pasta e, se necessário, o nome de utilizador '
    + 'e a palavra-passe estão corretos.',
  'win.setup.lib.errorReason': 'Motivo: {reason}',
  'win.services.addHint':
    'Clique em «Adicionar» para adicionar um novo serviço ao seu sistema '
    + 'Sonos.',
  'win.services.labsHint':
    'Clique em «Sonos Labs» para experimentar os próximos serviços no seu '
    + 'sistema Sonos.',
  'win.services.serviceName': 'Nome do serviço',
  'win.services.name': 'Nome',
  'win.services.login': 'Início de sessão',
  'win.services.anonymous': '<Anónimo>',
  'win.services.add': 'Adicionar',
  'win.services.signInWith': 'Iniciar sessão com o {service}',
  'win.services.labs': 'Sonos Labs',
  'win.services.addTitle': 'Adicionar um serviço',
  'win.services.labsTitle': 'Bem-vindo ao Sonos Labs',
  'win.services.labsPrompt':
    'Selecione o serviço do Sonos Labs que pretende adicionar:',
  'win.services.labsSignedOut':
    'Inicie sessão na sua conta Sonos para ver os serviços do Sonos Labs.',
  'win.services.labsFailed':
    'Não foi possível obter a lista de serviços do Sonos Labs: {error}',
  'win.services.edit': 'Editar',
  'win.services.editTitle': 'Editar serviço',
  'win.services.editHeading': 'Editar conta do {service}',
  'win.services.editPrompt': 'Introduza um nome para a conta:',
  'win.services.editName': 'Nome:',
  'win.services.replace': 'Substituir',
  'win.services.reauthorize': 'Voltar a autorizar',
  'win.services.removeTitle': 'Remover conta',
  'win.services.removeBody':
    'Tem a certeza de que pretende remover esta conta do {service} do seu '
    + 'sistema Sonos?',
  'win.eq.tab': 'EQ',
  'win.eq.intro': 'Ajuste os agudos e os graves a seu gosto.',
  'win.errorLog.title': 'Registo de erros do sistema Sonora',
  'desk.errorLog.empty': 'Não foram registados erros nos últimos sete dias.',
  'win.library.title': 'As minhas pastas de músicas no Sonos',
  'win.library.addHint':
    'Clique em «Adicionar» para adicionar uma nova pasta de música ao seu '
    + 'sistema Sonos.',
  'win.library.removeHint':
    'Clique em «Remover» para remover a pasta selecionada.',
  'win.library.name': 'Nome',
  'win.library.path': 'Caminho',
  // The Windows app's own two lines while the library updates.
  'win.library.indexing1': 'A atualizar a Biblioteca de música…',
  'win.library.indexing2': 'Aguarde.',
  'win.mini.noMusic': '[sem música]',
  'win.mini.volume': 'Volume',
  'win.mini.larger': 'Maior',
  'win.mini.smaller': 'Menor',
  'win.menu.checkUpdates': 'Procurar atualizações de software…',
  'win.menu.changeLanguage': 'Alterar idioma…',
  'win.menu.settings': 'Definições…',
  'win.settings.title': 'Definições',
  'win.sleep.title': 'Temporizador ({state})',
  'win.sleep.choose': 'Escolha a duração do temporizador para «{room}»:',
  'desk.window.controller': 'Controlador Sonora {systems}',
  'win.about.title': 'Acerca de',
  'win.about.version': 'Versão:',
  'win.about.os': 'Sonos OS:',
  'win.about.license': 'Licença:',
  'win.about.system': 'Sistema Sonos {gen}:',
  'win.about.serial': 'Número de série',
  'win.about.ip': 'Endereço IP',
  'win.about.associated': 'Produto associado:',
  'win.about.hardware': 'Versão do hardware',
  'win.about.series': 'ID da série',
  'win.about.wm': 'WM',
  'win.shortcuts.intro': 'Atalhos de teclado suportados pelo Sonora:',
  'win.shortcuts.function': 'Função',
  'win.shortcuts.shortcut': 'Atalho',
  'win.shortcuts.toggleShuffle': 'Ativar/desativar aleatório',
  'win.shortcuts.toggleRepeat': 'Ativar/desativar repetição',
  'win.shortcuts.muteAll': 'Silenciar tudo',
  'win.shortcuts.topMenu': 'Voltar ao menu principal de Música',
  'win.shortcuts.favorites': 'Ir para Favoritos',
  'win.shortcuts.toggleCrossfade': 'Ativar/desativar transição gradual',
  'win.shortcuts.scrollCurrent': 'Deslocar até à faixa atual na fila',
  'win.shortcuts.closeWindow': 'Fechar a janela ativa',
  'win.shortcuts.browserNote':
    'Três destes diferem da aplicação Sonos: o navegador reserva Ctrl+T, '
    + 'Ctrl+L e Ctrl+W para si.',
  'win.shortcuts.jumpSearch': 'Ir para a caixa de pesquisa',
  'win.shortcuts.playNext': 'Reproduzir faixa selecionada a seguir',
  'win.shortcuts.replaceQueue': 'Substituir Fila pela seleção',
  'win.shortcuts.playLater': 'Reproduzir seleção mais tarde',
  'win.shortcuts.resizeQueue': 'Redimensionar Fila',
  'win.shortcuts.prevTrack': 'Faixa anterior',
  'win.shortcuts.nextTrack': 'Faixa seguinte',
  'win.shortcuts.showShortcuts': 'Mostrar lista de atalhos de teclado',
  'win.settings.sonora': 'Sonora',
  'win.parental.title': 'Controlo parental',
  'win.parental.enabled':
    'O filtro de conteúdo explícito está ativado. Clique no botão abaixo '
    + 'para permitir a reprodução de conteúdo explícito no seu sistema '
    + 'Sonos.\n\nNem todos os serviços suportam a filtragem de conteúdo.',
  'win.parental.disabled':
    'O filtro de conteúdo explícito está desativado. Clique no botão abaixo '
    + 'para impedir a reprodução de conteúdo explícito no seu sistema '
    + 'Sonos.\n\nNem todos os serviços suportam a filtragem de conteúdo.',
  'win.parental.noServices':
    'Não existem serviços de música no seu sistema Sonos que suportem a '
    + 'filtragem de conteúdo.',
  'win.parental.unreadable':
    'Este sistema não indicou se a filtragem de conteúdos explícitos está '
    + 'ligada.',
  'win.parental.turnOn': 'Ativar filtro de conteúdo explícito',
  'win.parental.turnOff': 'Desativar filtro de conteúdo explícito',
  'win.parental.moreInfo': 'Mais informações',
  'win.settings.eq': 'Definições de EQ',
  'win.settings.library': 'Biblioteca de música',
  'win.settings.services': 'Serviços',
  'win.settings.eqFor': 'Definições de EQ para',
  'win.settings.mobileNote':
    'Abra a aplicação Sonos num dispositivo móvel para gerir o seu sistema.',
  'win.settings.getApp': 'Obter a aplicação móvel',
  'win.maximize': 'Maximizar',
  'win.restore': 'Restaurar para baixo',
  'desk.menu.minimize': 'Minimizar',
  'desk.menu.zoom': 'Zoom',
  'desk.menu.bringAllToFront': 'Trazer tudo para a frente',
  'desk.menu.shop': 'Comprar produtos Sonos',
  'desk.menu.firewallHelp': 'Ajuda para configurar a firewall',
  'desk.menu.errorLog': 'Registo de erros',
  'desk.menu.reset': 'Repor controlador',
  'desk.menu.forget': 'Esquecer o sistema Sonos atual',
  'desk.window.title': 'Sonora',
  'desk.add.title': 'Adicionar serviços de música',
  'desk.add.button': 'Adicionar…',
  'desk.add.intro':
    'Selecione um serviço para adicionar ao seu sistema Sonos.',
  'win.addService.title': 'Adicionar um serviço',
  'win.addService.heading': 'Serviços disponíveis',
  'win.addService.intro': 'Selecione o serviço que pretende adicionar ao seu sistema Sonos.',
  'desk.add.auth.Anonymous': 'Não é necessária conta',
  'desk.add.appOnly': 'Só na aplicação Sonos',
  'desk.add.another': 'Outra conta',
  'desk.add.unpairable':
    'O {service} só pode ser adicionado com a aplicação Sonos oficial: o '
    + 'seu fornecedor não inicia sessão num controlador que não seja da '
    + 'Sonos.',
  'desk.add.auth.DeviceLink': 'Iniciar sessão no site do fornecedor',
  'desk.add.auth.AppLink':
    'Iniciar sessão no site do fornecedor, se disponível',
  'desk.add.needsApp':
    'O {service} não permite iniciar sessão a partir do Sonora; o seu '
    + 'fornecedor só aceita o início de sessão através da aplicação Sonos '
    + 'oficial. Adicione-o lá para o usar nas aplicações Sonos. Tudo o que '
    + 'tiver guardado dele nos Favoritos Sonos ou nas Listas de reprodução '
    + 'Sonos continua a ser reproduzido no Sonora.',
  'desk.add.instructions':
    'Aceda a {url}, inicie sessão e introduza este código:',
  'desk.add.instructionsNoCode':
    'Aceda a {url} e inicie sessão para autorizar a Sonos.',
  'desk.add.open': 'Abrir no navegador',
  'desk.add.waiting': 'A aguardar a confirmação do {service}…',
  'desk.add.authorizeTitle': 'Adicionar conta do {service}',
  'desk.add.authorizeBody': 'Inicie sessão no {service} no navegador para que o Sonos possa usar a sua conta.',
  'desk.add.authorize': 'Autorizar',
  'desk.add.doneSystem.multi':
    'O {service} foi adicionado ao seu sistema {gen} e está pronto nos seus '
    + 'dispositivos {gen}, no Sonora e na aplicação Sonos oficial. Para o '
    + 'usar também nos seus dispositivos {other}, adicione-o novamente a '
    + 'partir dos {link}.',
  'desk.add.doneSystem.solo':
    'O {service} foi adicionado ao seu sistema Sonos e está pronto nos seus '
    + 'dispositivos, no Sonora e na aplicação Sonos oficial.',
  'desk.add.doneAnon.multi':
    'O {service} já está disponível no Sonora nos seus dispositivos {gen}. '
    + 'Não foi possível adicioná-lo ao seu sistema Sonos, por isso não '
    + 'aparecerá nas aplicações Sonos. Para o usar no Sonora nos seus '
    + 'dispositivos {other}, adicione-o novamente a partir dos {link}.',
  'desk.add.doneAnon.solo':
    'O {service} já está disponível no Sonora nos seus dispositivos. Não '
    + 'foi possível adicioná-lo ao seu sistema Sonos, por isso não aparecerá '
    + 'nas aplicações Sonos.',
  'desk.add.failed': 'Não foi possível adicionar o {service}: {error}',
  // --- About dialog ------------------------------------------------------
  'about.title': 'Acerca do Sonora',
  'about.menu': 'Acerca do Sonora',
  'about.version': 'Versão {version}',
  'about.tagline': 'Um controlador web alojado por si para todas as colunas Sonos.',
  'about.pointLocal': 'Controlo local em primeiro lugar',
  'about.pointThemes': 'Temas muito cuidados',
  'about.pointNetwork': 'Diagnóstico de rede',
  'about.pointUpgrade': 'Assistente de atualização de hardware',
  'about.pointMore': 'E muito mais…',
  'about.license': 'O Sonora é software livre, publicado sob a licença {license}.',
  'about.github': 'Ver no GitHub',
  'about.thirdParty': 'Licenças de terceiros',
  'about.support': 'Apoiar o Sonora',
  'about.supportNote': 'Se o Sonora lhe for útil, considere apoiar o projeto.',
  'about.trademark': 'O Sonora não é afiliado nem aprovado pela Sonos.\nSonos é uma marca registada da Sonos, Inc.',
  'desk.showSystem': 'Mostrar sistema',
  'desk.services.tab': 'Serviços {system}',
  'desk.add.starting': 'A pedir ao {service} uma ligação de início de sessão…',
  'desk.add.linking': 'A associar ao {service}…',
  // --- removing a music service (every theme) --------------------------------
  'services.remove': 'Remover',
  'services.rename': 'Mudar o nome',
  'services.renameTitle': 'Mudar o nome da conta do {service}',
  'services.renamed': 'Conta do {service} passou a chamar-se {name}',
  'services.removeHint': 'Remover o serviço realçado',
  'services.removeTitle': 'Remover o {service}?',
  'services.removeChoose': 'De onde pretende remover o {service}?',
  'services.removeSonora': 'Sonora',
  'services.removeSonoraSub': 'o início de sessão e a entrada aqui',
  'services.removeSonos': 'Sonos {gen}',
  'services.removeSonosSub': 'a conta no seu sistema Sonos',
  'services.confirmRemove': 'Remover',
  'services.removing': 'A remover o {service}…',
  'services.removeFailed': 'Não foi possível remover o {service}: {error}',
  'services.removeFromSonos': 'Remover do Sonos',
  'services.removeSonosBody':
    'Remover o {service} do seu sistema Sonos? Será removido de todas as '
    + 'aplicações Sonos, e não apenas do Sonora.',
  'services.removeSonoraBody': 'Remover {service} do Sonora? O Sonora esquece o início de sessão.',
  'desk.add.doneSonora.multi':
    'O {service} está agora associado no Sonora.\nTambém terá de associar o '
    + '{service} uma segunda vez, diretamente numa das aplicações Sonos '
    + '{gen}, para que o Sonora controle os seus dispositivos {gen}.\nPara '
    + 'usar o {service} no Sonora nos seus dispositivos {other}, associe-o '
    + 'novamente a partir dos {link}.',
  'services.relinkLinkText': 'serviços {other}',
  'services.caution.sonos': 'Associado ao Sonos {gen}, ainda não ao Sonora',
  'services.needsSonora.title': 'É necessário associar ao Sonora',
  'services.needsSonos.title': 'É necessário associar ao Sonos {gen}',
  'services.caution.sonora': 'Associado ao Sonora, ainda não ao Sonos {gen}',
  'services.sonoraOnly.body':
    'O {service} está associado no Sonora, mas não ao seu sistema Sonos '
    + '{gen}.\nO Sonora consegue navegar nele, mas os seus dispositivos {gen} '
    + 'não o conseguem reproduzir até associar o {service} numa das '
    + 'aplicações Sonos {gen}.',
  'desk.add.doneSonora.solo':
    'O {service} está agora associado no Sonora.\nTambém terá de associar o '
    + '{service} uma segunda vez, diretamente numa das aplicações Sonos '
    + '{gen}, para que o Sonora controle os seus dispositivos {gen}.',

  // --- Sonofuture ---

  // --- S2 Upgrade Info ---
  's2.title': 'Assistente de atualização Sonos',
  's2.lede':
    'Perceba que hardware precisaria para passar totalmente para o S2 ou o '
    + 'S2.1 e quanto custaria, aproximadamente.',
  's2.con4':
    'A aplicação S1 não muda há anos e é estável. A aplicação S2 foi '
    + 'reescrita em 2024 e esse lançamento correu mal.',
  's2.colRoom': 'Divisão',
  's2.colProduct': 'Produto',
  's2.colReplacement': 'Equivalente S2',
  's2.colReplacementS21': 'Equivalente S2.1',
  's2.colPrice': 'PVP nos EUA',
  's2.ready': 'Sim',
  's2.notReady': 'Não, só S1',
  's2.unknown': 'Desconhecido',
  's2.replaceTitle': 'Quanto custaria ter o S2 em todas as divisões',
  's2.replaceBlurb': 'Todos os dispositivos da casa e o que cada um precisa para chegar ao S2: uma atualização de software, uma substituição pelo preço de tabela ou nada.',
  's2.noReplacement': 'Nada a comprar',
  's2.noReplacementWhy':
    'um altifalante com fios assegura a rede, e a aplicação substituiu o '
    + 'controlador',
  's2.total': 'Total para passar este sistema para o S2',
  's2.amazonDisclosure': 'Como associado da Amazon, ganho com compras qualificadas.',
  's2.pricesNote': 'Preços de tabela nos EUA, verificados no {quarter}.º trimestre de {year}. Os preços podem mudar, por isso confirme antes de comprar.',
  's2.timelineTitle': 'Três gerações de hardware',
  's2.era.s1': 'Só S1',
  's2.era.s20': 'S2.0',
  's2.era.s21': 'S2.1',
  's2.eraSpan': 'de {from} a {to}',
  's2.eraOpen': 'de {from} até hoje',
  's2.eraBounds.s1':
    'Do ZonePlayer 100 (janeiro de 2005) ao Play:5 de 1.ª geração (novembro '
    + 'de 2015). Nada destes anos consegue executar o S2.',
  's2.eraBounds.s20':
    'Do Play:3 (julho de 2011) ao candeeiro de mesa Symfonisk de 1.ª '
    + 'geração (janeiro de 2022). Executa o S2, mas deixou de receber novas '
    + 'funcionalidades em 2025.',
  's2.eraBounds.s21':
    'Do Sonos One (outubro de 2017) em diante. Tudo o que a Sonos vende '
    + 'hoje.',
  's2.mark.s2app': 'Aplicação S2, junho de 2020',
  's2.mark.freeze': 'S2.0 congelado, 2025',
  's2.linksIntro': 'Nas palavras da Sonos:',
  's2.linkS2Launch': 'Apresentação do S2, junho de 2020',
  's2.linkS21Launch': 'A atualização dos produtos antigos de 2025',
  's2.allReady':
    'Todos os dispositivos S1 aqui conseguem executar o S2. Este sistema '
    + 'pode passar sem comprar nada.',
  's2.allS21':
    'Todos os seus dispositivos estão na plataforma Sonos S2.1. Não tem '
    + 'nada para atualizar. Ou é muito recente na Sonos, ou é muito rico. '
    + 'Seja como for, parabéns!',

  // --- the network map ---
  'net.mapTitle': 'Todos os dispositivos na rede',
  'net.mapBlurb': 'Um cartão por coluna. Cada um diz se a ligação está saudável e porquê, pela rapidez e fiabilidade das respostas. Abra Detalhes para ver o resto.',
  'net.mapEmpty': 'Nenhum dispositivo respondeu.',
  'net.wired': 'Com fios',
  'net.onSonosnet': 'SonosNet',
  'net.onWifi': 'Wi-Fi',
  'net.channel': 'Canal {n}',
  'net.unreachable': 'Não respondeu',
  'net.notMeasurable': 'Sem vizinhos para medir',
  'net.drop.title': 'Falhas na reprodução',
  'net.drop.blurb': 'As vezes nos últimos sete dias em que a música de uma divisão falhou.',
  'net.drop.none': 'Nenhuma falha nos últimos sete dias.',
  'net.drop.buffering': 'Em pausa {seconds} s para carregar',
  'net.drop.skipped': 'Saltou algo que não conseguia reproduzir',
  'net.drop.failed': 'Parou: não foi possível reproduzir',
  'net.drop.more': 'E mais {count} anteriores.',
  'net.fix.no_answer': 'Verifique se está ligada e ainda na sua rede.',
  'net.fix.lost': 'Normalmente cobertura fraca onde está ou um canal congestionado. Experimente-a mais perto do router.',
  'net.fix.slow': 'Muitas vezes um sinal fraco do router. Aproximar a coluna ou o router costuma ajudar.',
  'net.fix.slow_often': 'Normalmente outro tráfego Wi-Fi ou interferência no canal: micro-ondas, intercomunicadores de bebé e redes dos vizinhos são causas comuns.',
  'net.fix.uneven': 'Normalmente outro tráfego Wi-Fi ou interferência no canal: micro-ondas, intercomunicadores de bebé e redes dos vizinhos são causas comuns.',
  'net.fix.stall': 'Uma única pausa longa costuma ser um pico de outro tráfego Wi-Fi. Se continuar nesta divisão, procure interferências por perto.',
  'net.fix.dropping': 'A própria ligação Wi-Fi está a perder pacotes. Sinal fraco ou interferência por perto são as causas habituais.',
  'net.fix.extender': 'Os repetidores acrescentam atraso. Ligue-a ao router principal se o alcançar.',
  'net.summary.clear': 'Nada a assinalar. Todas as colunas respondem rapidamente.',
  'net.summary.issues': '{parts}. O cartão de cada coluna abaixo explica porquê.',
  'net.summary.and': ' e ',
  'net.probing': 'A verificar as colunas. Aguarde...',
  'net.health.good': 'Bom',
  'net.health.watch': 'A acompanhar',
  'net.health.problem': 'Problema',
  'net.health.unmeasured': 'Não medido',
  'net.why.ok': 'Responde em {median} ms',
  'net.why.no_answer': 'Sem resposta em nenhuma de {attempts} tentativas',
  'net.why.lost': 'Faltaram {failed} de {attempts} respostas',
  'net.why.slow': 'Responde normalmente em {median} ms',
  'net.why.slow_often': '1 resposta em 20 demora mais de {p95} ms',
  'net.why.uneven': '1 resposta em 20 demora mais de {p95} ms',
  'net.why.stall': 'Uma resposta demorou {worst} ms',
  'net.why.dropping': 'Perde {rate} pacotes por minuto',
  'net.why.extender': 'Ligado através de um repetidor Wi-Fi',
  'net.details': 'Detalhes',
  'net.replies': 'Respostas',
  'net.repliesLine': 'normalmente {median} ms · 1 em 20 acima de {p95} ms · a mais lenta {worst} ms · faltaram {failed} de {attempts}',
  'net.dropped': 'Pacotes perdidos',
  'net.perMinute': '{n} por minuto',
  'net.notReported': 'Não indicado',
  'net.hears': 'Ouve outras colunas Sonos',
  'net.hearsHint': 'Com que intensidade esta coluna ouve as outras colunas do seu sistema. Indica onde está, não a ligação Wi-Fi: nenhuma coluna Sonos indica como ouve o seu router.',
  'net.noiseLabel': 'Ruído de rádio',
  'net.count.problem.one': '{count} problema',
  'net.count.problem.other': '{count} problemas',
  'net.count.watch.one': '{count} a acompanhar',
  'net.count.watch.other': '{count} a acompanhar',
  'net.margin': 'margem de {n} dB',
  'net.alone': 'Nenhuma coluna ao alcance',
  'net.mesh.title': 'Usa uma rede mesh ou gerida?',
  'net.mesh.blurb': 'Os sistemas Wi-Fi mesh e os pontos de acesso geridos podem {sometimes} impedir que as colunas se encontrem. Os conselhos dos fabricantes resumem-se a poucas regras: ligue todas as colunas da mesma forma, todas por Wi-Fi ou todas por cabo; ligue as colunas com cabo a uma mesma unidade do router ou a um mesmo switch; e não deixe os pontos de acesso converter nem filtrar o tráfego multicast.',
  'net.mesh.sometimes': 'por vezes',
  'net.mesh.guidance': 'Orientações:',
  's2.tier.s21': 'S2.1',
  's2.tier.s20': 'S2.0',
  's2.tier.unknown': 'Desconhecido',
  's2.s21Title': 'Quanto custaria ter o S2.1 em todas as divisões',
  's2.s21Blurb': 'Todos os dispositivos da casa e o que cada um precisa para chegar ao S2.1. Uma unidade que não executa S2, ou que só chegaria ao S2.0, é substituída pelo produto atual que ocupa o seu lugar. Este total inclui o custo de passar para o S2.',
  's2.colWhy': 'Motivo',
  's2.why.legacy': 'Não executa o S2',
  's2.why.lower': 'Só S2.0',
  's2.why.upgradable': 'Atualizável',
  's2.why.runningS2': 'A executar S2',
  's2.why.runningS21': 'A executar S2.1',
  's2.totalS21': 'Total para chegar ao S2.1 em todas as divisões',
  's2.s21AllReady':
    'Todas as divisões aqui já seriam S2.1. Não há nada a comprar.',
  's2.tierUnknownNote.one':
    'Não foi possível classificar um dispositivo: a Sonos só lista algumas '
    + 'gerações desse produto e o altifalante não indica qual é.',
  's2.tierUnknownNote.other':
    'Não foi possível classificar {count} dispositivos: a Sonos só lista '
    + 'algumas gerações desses produtos e os altifalantes não indicam quais '
    + 'são.',
  's2.choiceTitle': 'O que pretende fazer?',
  's2.choiceKeepBoth': 'Manter sistemas S1 e S2 separados',
  's2.choiceKeepBothNote':
    'Manter dois sistemas Sonos separados, S1 e S2, como tem agora. (Alguns '
    + 'dispositivos S1 podem ser atualizados por software para o S2.)',
  's2.choiceStayS1': 'Continuar a usar o sistema S1',
  's2.choiceStayS1Note': 'Continue a usar o seu sistema S1 como até agora. Não é preciso fazer nada.',
  's2.choiceStayS2': 'Continuar a usar o sistema S2',
  's2.choiceStayS2Note': 'Continue a usar o seu sistema S2 como até agora. Não é preciso fazer nada.',
  's2.choiceS2': 'Atualizar para o S2',
  's2.choiceS2Note':
    'Atualizar por software todos os altifalantes S1 elegíveis para o S2 e '
    + 'comprar dispositivos novos para substituir os dispositivos S1 que não '
    + 'podem fazer a transição.',
  's2.choiceS21': 'Atualizar para o S2.1',
  's2.choiceS21Note':
    'Comprar dispositivos novos para substituir todos os dispositivos Sonos '
    + 'existentes que não são compatíveis com o S2.1. A opção sem olhar a '
    + 'custos, preparada para o futuro.',
  's2.choiceFree': 'Nada a comprar',
  's2.colBuy': 'Ação',
  's2.buyNow': 'Comprar',
  's2.updateNow': 'Atualizar agora',
}
