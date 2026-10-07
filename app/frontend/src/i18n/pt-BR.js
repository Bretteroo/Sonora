// Portuguese (Brazil) (pt-BR). The keys mirror en-US.js, the reference catalog; a key
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
  'common.save': 'Salvar',
  'common.submit': 'Enviar',
  'common.apply': 'Aplicar',
  'common.appearance': 'Aparência',
  'common.appearanceLight': 'Claro',
  'common.appearanceDark': 'Escuro',
  'common.appearanceSystem': 'Sistema',
  'common.done': 'Concluído',
  'common.close': 'Fechar',
  'common.explicit': 'Explícito',
  'common.restricted': 'Restrito',
  'common.dismiss': 'Dispensar',
  'common.settings': 'Configurações',
  'common.search': 'Buscar',
  'common.queue': 'Fila',
  'common.play': 'Reproduzir',
  'common.pause': 'Pausar',
  'common.stop': 'Parar',
  'common.next': 'Próxima',
  'common.previous': 'Anterior',
  'common.shuffle': 'Aleatório',
  'common.repeat': 'Repetir',
  'common.mute': 'Silenciar',
  'common.unmute': 'Reativar o som',
  'common.viewAll': 'Ver tudo',
  'common.reconnecting': 'reconectando',
  'desk.lc.noNetwork': 'Você precisa estar conectado a uma rede com ou sem fio para usar o Sonora. Verifique suas configurações de rede.',
  'desk.lc.noSonora': 'Esta página perdeu a conexão com o Sonora. Ela vai se reconectar sozinha assim que o Sonora responder.',
  'local.room': 'Este navegador',
  'local.cannotGroup.title': 'Este navegador não pode ser agrupado',
  'local.cannotGroup.detail':
    'O agrupamento mantém as caixas de som em um relógio comum, pela rede '
    + 'delas. Um navegador não participa disso, então toca sozinho.',
  'local.cannotPlay.title': 'Este navegador não consegue reproduzir isso',
  'local.cannotPlay.needsSpeaker':
    'Só uma caixa de som consegue buscar: um serviço de música entrega o '
    + 'fluxo ao sistema, e um compartilhamento da biblioteca musical é '
    + 'montado pelos players. Rádio pela internet toca aqui.',
  'local.cannotPlay.unknown':
    'O Sonora não sabe reproduzir essa fonte em um navegador. Rádio pela '
    + 'internet toca aqui.',
  'local.cannotPlay.needsQueue':
    'Um álbum, uma playlist ou uma fila é uma lista de faixas, e essa lista '
    + 'pertence à caixa de som que a reproduz. Escolha aqui uma faixa avulsa '
    + 'ou uma estação.',
  'local.cannotPlay.needsLink':
    'O Sonora navega no {service} através das caixas de som e não tem login '
    + 'próprio para pedir um fluxo. Vincule o serviço ao Sonora e ele tocará '
    + 'aqui.',
  'local.cannotPlay.serviceRefused':
    'O {service} não permite que o Sonora transmita isto fora do '
    + 'ecossistema Sonos. Tente transmitir direto para um player Sonos.',
  'local.cannotPlay.protected':
    'O {service} não permite que o Sonora transmita isto fora do '
    + 'ecossistema Sonos. Tente transmitir direto para um player Sonos.',
  'local.cannotDo.title': 'Só uma caixa de som faz isso',
  'local.cannotDo.detail':
    'Este navegador é uma saída, não um player: sem equalizador, sem luz de '
    + 'status, sem fila e sem par estéreo. Volume, reprodução e pausa '
    + 'funcionam.',
  'common.rooms.one': '{count} cômodo',
  'common.rooms.other': '{count} cômodos',
  'common.speakers.one': '{count} caixa de som',
  'common.speakers.other': '{count} caixas de som',
  'common.groups.one': '{count} grupo',
  'common.groups.other': '{count} grupos',
  'common.items.one': '{count} item',
  'common.items.other': '{count} itens',
  'common.tracks.one': '{count} faixa',
  'common.tracks.other': '{count} faixas',
  'common.noResults': 'Nenhum resultado',
  'common.offline': 'off-line',
  'common.system': 'Sistema {generation}',

  // --- start-up and failure states ---------------------------------------
  'splash.loading.title': 'Procurando caixas de som',
  'splash.loading.detail':
    'Enviando uma solicitação de descoberta e perguntando à primeira caixa '
    + 'de som que responder sobre o resto do sistema.',
  'splash.empty.title': 'Nenhuma caixa de som encontrada',
  'splash.empty.detail':
    'A descoberta usa multicast, então a máquina que roda este controlador '
    + 'precisa estar na mesma rede das caixas de som, e não em uma rede de '
    + 'convidados ou em outra VLAN.',
  'splash.error.title': 'Não foi possível alcançar o controlador',
  'splash.error.detail':
    'O backend não respondeu. Verifique se ele está em execução.',
  'splash.searchAgain': 'Buscar de novo',
  'splash.crash.title': 'Este tema parou de funcionar',
  'splash.crash.detail': 'Algo deu errado ao desenhá-lo. Recarregue a página ou escolha outro design abaixo.',
  'splash.reload': 'Recarregar',
  'rating.cannotUndo': 'O {service} não permite desfazer isto',
  'splash.connected': 'Conectado ao controlador',
  'splash.notConnected': 'Não conectado',

  // --- notices ------------------------------------------------------------
  'notice.conflict.title': 'A caixa de som recusou',
  'notice.skipLimit.title': 'Limite de pulos atingido',
  'notice.skipLimit.body': 'Você atingiu o limite de pulos desta estação. Tente novamente mais tarde.',
  'notice.silent.title': 'A caixa de som não respondeu',
  'notice.silent.body':
    '{room} parou de responder por um momento. Em geral ela volta sozinha; '
    + 'tente de novo em alguns segundos.',
  'notice.error.title': 'Algo deu errado',
  'notice.network.title': 'Erro de rede',

  // --- what a room is doing ----------------------------------------------
  'search.category.artists': 'Artistas',
  'search.category.albums': 'Álbuns',
  'search.category.tracks': 'Músicas',
  'search.category.playlists': 'Playlists',
  'search.category.stations': 'Estações',
  'search.category.genres': 'Gêneros',
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
  'source.library_track': 'Biblioteca musical',
  'source.http_stream': 'Fluxo de rede',
  'source.external_session': 'AirPlay ou Spotify Connect',
  'source.tv': 'TV',
  'source.playlist': 'Playlist',
  'source.idle': 'Ocioso',
  'source.unknown': 'Fonte desconhecida',

  // --- web theme ----------------------------------------------------------
  'common.noMusicSelected': 'Nenhuma música selecionada',
  'common.queueIsEmpty': 'A fila está vazia',
  'common.roomsGrouped': '{count} cômodos agrupados',
  'common.groupLabel': '{room} + {count}',
  'common.nothingQueued': 'Nada na fila',
  'common.setActive': 'Tornar {room} ativo',
  'common.openQueue': 'Abrir a fila',
  'common.seek': 'Avançar na faixa',
  'common.live': 'Ao vivo',
  'common.tv': 'TV',
  'desk.browse.lineIn': 'Entrada de linha',
  'desk.browse.noSelections': 'Nenhuma seleção disponível.',
  'desk.browse.lineInNone':
    'Para usar a entrada de linha, conecte um aparelho a um produto Sonos '
    + 'que tenha entrada de linha.',
  'common.kind.playlist': 'Playlist',
  'common.kind.album': 'Álbum',

  // grouping

  // queue

  // settings
  'net.connection': 'Conexão',
  'net.live': 'ao vivo',
  'net.rescan': 'Examinar a rede de novo',

  // a service's own page
  'services.needsAccount':
    'O {service} não lista nada sem o token de login da sua conta. Esse '
    + 'token fica com as caixas de som e nunca é exposto na rede, então o '
    + 'catálogo dele não pode ser navegado aqui; o que você salvou dele nos '
    + 'Favoritos Sonos ou nas playlists Sonos continua tocando.',

  // --- Sonos account, network check and TV audio, used across themes -------
  'account.title': 'Conta Sonos',
  'account.blurb': 'Seus alto-falantes já configurados dão ao Sonora tudo o que ele precisa para o controle diário do seu sistema Sonos.',
  'account.optional': 'Entrar na sua conta Sonos é opcional. Isso mostra a lista completa de serviços de música configurados no seu sistema com seus logotipos, os serviços do Sonos Labs disponíveis e o nome da entrada de TV que uma soundbar está reproduzindo.',
  'account.signIn': 'Entrar',
  'account.signOut': 'Sair',
  'account.signingIn': 'Entrando…',
  'account.email': 'E-mail',
  'account.password': 'Senha',
  'account.signedInAs': 'Conectado como: {email}',
  'account.notSignedIn': 'não conectado',
  'net.scanning': 'Examinando a rede…',
  'net.scanDone': '{rooms} encontrados em {systems}',
  'common.systems.one': '{count} sistema',
  'common.systems.other': '{count} sistemas',
  'source.noSignal': 'Sem sinal',
  'desk.now.tvInput': 'Entrada',
  'desk.now.tvFormat': 'Formato',
  'tvFormat.0': 'Nenhuma entrada conectada',
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
  'desk.menu.view': 'Exibir',
  'desk.menu.manage': 'Gerenciar',
  'desk.menu.help': 'Ajuda',
  'desk.menu.preferences': 'Preferências…',
  'desk.menu.checkUpdates': 'Verificar atualizações…',
  'desk.menu.cut': 'Recortar',
  'desk.menu.copy': 'Copiar',
  'desk.menu.paste': 'Colar',
  'desk.menu.mainWindow': 'Controlador Sonos',
  'desk.menu.miniController': 'Mini controlador',
  'desk.menu.musicLibrarySettings': 'Configurações da biblioteca musical…',
  'desk.menu.serviceSettings': 'Configurações dos serviços…',
  'desk.menu.addRadioStation': 'Adicionar estação de rádio…',
  'desk.radio.myShows': 'Meus programas de rádio',
  'desk.radio.changeLocation': 'Mudar o local',
  'desk.radio.enterZip': 'Informar o CEP',
  'desk.radio.zipBody': 'Digite seu CEP:',
  'desk.radio.pickCity': 'Escolher uma cidade',
  'desk.radio.locationSet': 'A rádio local agora é {city}.',
  'desk.radio.localRadio': 'Rádio local',
  'desk.radio.localRadioIn': 'Rádio local ({city})',
  'desk.radio.myStations': 'Minhas estações de rádio',
  'desk.radio.addNew': 'Adicionar nova estação de rádio',
  'desk.playlists.new': 'Nova playlist',
  'desk.playlists.addTitle': 'Adicionar música à playlist',
  'desk.playlists.removeSong': 'Remover música',
  'desk.playlists.removedSong': '{title} foi removida da playlist.',
  'desk.playlists.added': '{title} foi adicionada a {playlist}.',
  'desk.playlists.addedMany':
    '{count} músicas foram adicionadas a {playlist}.',
  'desk.playlists.nameTitle': 'Dar nome a esta playlist',
  'desk.playlists.nameBody': 'Dê um nome a esta playlist:',
  'desk.playlists.rename': 'Renomear playlist',
  'desk.playlists.renameBody': 'Digite um novo nome para esta playlist:',
  'desk.playlists.delete': 'Excluir playlist',
  'desk.playlists.deleted': '“{title}” foi excluída.',
  'desk.queue.editedTitle': 'A fila foi editada',
  'desk.queue.editedBody': 'Reproduzir isso vai substituir a fila.',
  'desk.queue.playAnyway': 'Reproduzir mesmo assim',
  'desk.radio.title': 'Adicionar uma estação de rádio',
  'desk.radio.intro': 'Informe os dados da nova estação de rádio.',
  'desk.radio.where':
    'A nova estação será adicionada em TuneIn > Minhas estações de rádio.',
  'desk.radio.url': 'URL do fluxo',
  'desk.radio.name': 'Nome da estação',
  'desk.radio.added': '“{title}” foi adicionada a Minhas estações de rádio.',
  'desk.radio.exists': '“{title}” já está em Minhas estações de rádio.',
  'desk.menu.updateLibrary': 'Atualizar a biblioteca musical agora',
  'desk.menu.systemHelp': 'Ajuda do sistema Sonos',
  'desk.menu.supportSite': 'Site de suporte técnico',
  'desk.menu.submitDiagnostics': 'Enviar diagnóstico',
  'desk.menu.about': 'Sobre meu sistema Sonos',
  'desk.menu.disabledNote':
    'Os itens em cinza só existem no aplicativo Sonos.',
  'desk.transport.groupVolume': 'Volume do grupo',
  'desk.transport.back30': 'Voltar 30 segundos',
  'desk.transport.forward30': 'Avançar 30 segundos',
  'desk.transport.repeatOff': 'Repetição desativada',
  'desk.transport.repeatOne': 'Repetir a música',
  'desk.transport.repeatAll': 'Repetir tudo',
  'desk.transport.crossfade': 'Transição suave',
  'desk.rooms.title': 'Cômodos',
  'desk.rooms.system': 'Sistema',
  'desk.rooms.pauseAll': 'Pausar tudo',
  'desk.rooms.pause': 'Pausar',
  'desk.rooms.confirmPauseAll':
    'Tem certeza de que quer pausar a música em todos os cômodos?',
  'desk.rooms.playGroup': 'Reproduzir o grupo',
  'desk.rooms.pauseGroup': 'Pausar o grupo',
  'desk.rooms.stopGroup': 'Parar o grupo',
  'desk.rooms.offline': 'Off-line',
  'desk.rooms.batteryLevel': '{level}%',
  'desk.rooms.battery': 'Bateria {level}%',
  'desk.rooms.batteryCharging': 'Bateria {level}%, carregando',
  'desk.now.title': 'Tocando agora',
  'desk.now.next': 'Próxima',
  'desk.now.noMusic': '[Nenhuma música selecionada]',
  'desk.now.episode': 'Episódio',
  'desk.now.podcast': 'Podcast',
  'desk.now.releaseDate': 'Data de lançamento',
  'desk.now.chapter': 'Capítulo',
  'desk.now.author': 'Autor',
  'desk.now.narrator': 'Narrador',
  'desk.now.book': 'Livro',
  'desk.now.station': 'Estação',
  'desk.now.onNow': 'No ar agora',
  'desk.now.information': 'Informações',
  'desk.now.zp.connecting': 'Conectando...',
  'desk.now.zp.buffering': 'Iniciando...',
  'desk.now.zp.starting': 'Iniciando...',
  'desk.now.artist': 'Artista',
  'desk.now.album': 'Álbum',
  'desk.now.song': 'Música [{n}/{total}]',
  'desk.now.songLabel': 'Música',
  'desk.now.infoOptions': 'Informações e opções',
  'desk.now.thumbsUp': 'Curtir',
  'desk.now.thumbsDown': 'Não curtir',
  'desk.info.source': 'Fonte',
  'desk.info.room': 'Cômodo',
  'desk.info.duration': 'Duração',
  'desk.info.station': 'Estação',
  'desk.info.addMyStations': 'Adicionar a Minhas estações de rádio',
  'desk.info.removeMyStations': 'Remover de Minhas estações de rádio',
  'desk.radio.removedMine': '{title} foi removida de Minhas estações de rádio',
  'desk.info.addMyShows': 'Adicionar a Meus programas de rádio',
  'desk.radio.addedMine': '{title} foi adicionada a Minhas estações de rádio',
  'desk.radio.addedShow': '{title} foi adicionado a Meus programas de rádio',
  'desk.radio.alreadyShow': '{title} já está em Meus programas de rádio',
  'desk.radio.alreadyMine': '{title} já está em Minhas estações de rádio',
  'desk.info.startRadio': 'Iniciar rádio',
  'desk.info.addToServicePlaylist':
    'Adicionar a música a uma playlist do {service}',
  'desk.info.saveToMusic': 'Salvar em Minha música',
  'desk.info.addSongFavorite': 'Adicionar a música aos Favoritos Sonos',
  'desk.info.removeFavorite': 'Remover dos Favoritos Sonos',
  'desk.info.removedFavorite': '{title} foi removida dos Favoritos Sonos',
  'desk.info.albumInfo': 'Informações do álbum',
  'desk.info.artistInfo': 'Informações do artista',
  'desk.info.podcastInfo': 'Informações do podcast',
  'desk.info.provider': 'Provedor',
  'desk.info.addEpisodeFavorite': 'Adicionar o episódio aos Favoritos Sonos',
  'desk.info.addEpisodePlaylist': 'Adicionar o episódio a uma playlist Sonos',
  'desk.info.actionDone': 'Concluído.',
  'desk.info.actionFailed': 'O serviço recusou a solicitação.',
  'desk.info.viewAllSongs': 'Ver todas as músicas do álbum',
  'desk.info.addAlbumFavorite': 'Adicionar o álbum aos Favoritos Sonos',
  'desk.info.addBookFavorite': 'Adicionar o livro aos Favoritos Sonos',
  'desk.info.addAlbumPlaylist': 'Adicionar o álbum a uma playlist Sonos',
  'desk.info.addToSonosPlaylist': 'Adicionar a música a uma playlist Sonos',
  'desk.info.addStationFavorite': 'Adicionar a estação aos Favoritos Sonos',
  'desk.info.addedFavorite': '“{title}” foi adicionado aos Favoritos Sonos.',
  'desk.info.alreadyFavorite': '“{title}” já está nos Favoritos Sonos.',
  'desk.queue.title': 'Fila',
  'desk.queue.notInUse': '(Não está em uso)',
  'desk.queue.collapse': 'Mostrar o que está tocando',
  'desk.queue.expand': 'Expandir a fila',
  'desk.queue.songs.one': '{count} música',
  'desk.queue.songs.other': '{count} músicas',
  'desk.queue.empty': 'A fila está vazia',
  'win.queue.empty': 'A fila está vazia.',
  'win.queue.confirmTitle': 'Confirmar',
  'win.queue.confirmClear': 'Tem certeza de que quer limpar a fila?',
  'win.queue.clearAction': 'Limpar',
  'desk.queue.clear': 'Limpar a fila',
  'desk.queue.save': 'Salvar a fila',
  'desk.queue.confirmClear': 'Limpar a fila',
  'desk.queue.playSong': 'Reproduzir a música',
  'desk.queue.removeSong': 'Remover a música',
  'desk.queue.playEpisode': 'Reproduzir o episódio',
  'desk.queue.removeEpisode': 'Remover o episódio',
  'desk.queue.playTrack': 'Reproduzir a faixa {n}',
  'desk.browse.root': 'Selecionar uma fonte de música',
  'desk.browse.music': 'Música',
  'desk.browse.favorites': 'Favoritos Sonos',
  'desk.browse.updateNow': 'Atualizar agora',
  'desk.update.title': 'Atualização disponível',
  'desk.update.body': 'Há uma atualização pronta para seus alto-falantes Sonos: versão {version}. A música para em cada cômodo durante a instalação, o que pode levar alguns minutos.',
  'desk.update.bodySystem': 'Há uma atualização pronta para seus alto-falantes Sonos {system}: versão {version}. A música para em cada cômodo durante a instalação, o que pode levar alguns minutos.',
  'desk.update.start': 'Atualizar',
  'desk.update.notNow': 'Agora não',
  'desk.update.started': 'A atualização começou. Cada cômodo reinicia quando terminar.',
  'desk.browse.library': 'Biblioteca musical',
  'desk.browse.playlists': 'Playlists Sonos',
  'desk.browse.radio': 'TuneIn',
  'desk.browse.addServices': 'Adicionar serviços de música',
  'desk.browse.addServicesFor': 'Adicionar serviços de música {gen}',
  'desk.browse.switchAccount': 'Trocar de conta',
  'desk.browse.sleepTimer': 'Timer de desligamento',
  'desk.browse.alarms': 'Alarmes',
  'desk.browse.results': 'Resultados: {query}',
  'desk.search.in': 'Buscar em {service}',
  'desk.search.clear': 'Limpar pesquisa',
  'desk.search.recent': 'Buscas recentes',
  'desk.search.clearRecent': 'Limpar as buscas recentes',
  'desk.search.scope': 'Escolher onde buscar',
  'desk.browse.noResults':
    'A busca não encontrou nada para “{query}”. Tente outra categoria ou um '
    + 'novo termo.',
  'desk.browse.selectRoom':
    'Selecione um cômodo para navegar pela música dele.',
  'desk.browse.loading': 'Carregando…',
  'desk.browse.empty': 'Nenhuma seleção disponível.',
  'desk.browse.unableToBrowse': 'Não é possível navegar pelas músicas',
  'desk.browse.actions': 'Mais opções',
  'desk.browse.select': 'Selecionar',
  'desk.browse.needsLink.body':
    'O {service} está vinculado ao seu sistema Sonos {gen}.\nSe quiser '
    + 'navegar e controlar o {service}, também será preciso vinculá-lo ao '
    + 'Sonora. É um login separado e não mexe no seu aplicativo Sonos.',
  'desk.browse.needsLink.action': 'Vincular o {service} ao Sonora',
  'desk.actions.playNow': 'Reproduzir agora',
  'desk.actions.playNext': 'Reproduzir em seguida',
  'desk.actions.addToQueue': 'Adicionar ao fim da fila',
  'desk.actions.addFavorite': 'Adicionar aos Favoritos Sonos',
  'desk.actions.unselectAll': 'Desmarcar tudo',
  'desk.actions.replaceQueue': 'Substituir a fila',
  'desk.favorites.addToSonosPlaylist': 'Adicionar a uma playlist Sonos',
  'desk.favorites.addToServicePlaylist':
    'Adicionar a uma playlist do {service}',
  'desk.favorites.rename': 'Renomear o favorito Sonos',
  'desk.favorites.remove': 'Remover dos Favoritos Sonos',
  'desk.favorites.renameBody': 'Digite um novo nome para este favorito Sonos:',
  'desk.favorites.removed': '“{title}” foi removido dos Favoritos Sonos.',
  'common.ok': 'OK',
  'desk.grouping.title': 'Agrupar cômodos',
  'desk.grouping.willPlay': 'Os cômodos selecionados vão reproduzir:',
  'desk.grouping.select': 'Selecionar salas para agrupar:',
  'desk.grouping.partyMode': 'Selecionar tudo – Modo festa',
  'desk.grouping.noMusic': '[sem música]',
  'desk.grouping.chooseMusic': 'Clique em Concluído para escolher a música',
  'desk.grouping.pickTitle': 'Escolher a música',
  'desk.grouping.pickHeading':
    'Escolha a música para tocar no cômodo selecionado',
  'desk.grouping.unselectAll': 'Desmarcar tudo',
  'desk.grouping.noneTitle': 'Nenhuma Sala Selecionada',
  'desk.grouping.noneBody': 'Isso vai parar qualquer música que esteja tocando. Deseja continuar?',
  'desk.grouping.noneYes': 'Sim',
  'desk.prefs.title': 'Preferências',
  'desk.prefs.general': 'Geral',
  'desk.prefs.basic': 'Básico',
  'desk.prefs.themeShot': 'Uma prévia do tema {theme}',
  'desk.prefs.themeNoShot': 'Sem prévia para este tema.',
  'desk.prefs.themeVersion': 'versão {version}',
  'desk.prefs.themeInstalled': 'instalado',
  'desk.prefs.manageThemes': 'Gerenciar temas',
  'desk.prefs.themeUpload': 'Instalar tema…',
  'desk.prefs.themeDelete': 'Excluir tema',
  'desk.prefs.themeBuiltIn':
    'Os temas que vêm com o Sonora não podem ser excluídos.',
  'desk.room.nightSound': 'Som noturno',
  'desk.room.speech': 'Realce de diálogos',
  'desk.room.sub': 'Sub',
  'desk.room.subLevel': 'Nível do sub',
  'desk.room.surround': 'Surround',
  'desk.room.surroundLevel': 'Nível da TV',
  'desk.room.musicSurroundLevel': 'Nível da música',
  'desk.room.audioDelay': 'Atraso de áudio (sincronia labial)',
  'desk.room.heightLevel': 'Nível dos canais de altura',
  'desk.room.lineInName': 'Nome da fonte de entrada de linha',
  'desk.room.lineInLevel': 'Nível da fonte de entrada de linha',
  'desk.room.autoplayRoom': 'Cômodo de reprodução automática',
  'desk.room.autoplayOff': 'Desativado',
  'desk.room.autoplayLinked': 'Incluir os cômodos agrupados',
  'desk.room.autoplayUseVolume': 'Usar o volume da reprodução automática',
  'desk.room.autoplayVolume': 'Volume da reprodução automática',
  'desk.room.stereoPair': 'Par estéreo',
  'desk.room.separate': 'Separar o par estéreo',
  'desk.room.separateBody':
    'Separar o par estéreo “{room}” de volta em dois cômodos? A reprodução '
    + 'para enquanto as caixas de som se reorganizam.',
  'desk.room.pairWith': 'Escolher a caixa de som direita…',
  'desk.room.createPair': 'Criar par estéreo',
  'desk.room.pairBody':
    'Tornar “{left}” o canal esquerdo e “{right}” o canal direito de um par '
    + 'estéreo? O par mantém o nome “{left}”; a reprodução para enquanto as '
    + 'caixas de som se reorganizam.',
  'desk.rooms.showMore': 'Mostrar mais {n}…',
  'desk.rooms.showLess': 'Mostrar menos…',
  'desk.rooms.allSystems': 'Todos',
  'desk.rooms.menu.play': 'Reproduzir {name}',
  'desk.rooms.menu.pause': 'Pausar {name}',
  'desk.rooms.menu.stop': 'Parar {name}',
  'desk.rooms.menu.mute': 'Silenciar {name}',
  'desk.rooms.menu.unmute': 'Reativar o som de {name}',
  'desk.rooms.menu.eq': 'Equalizador de {name}…',
  'desk.rooms.menu.group': 'Agrupar',
  'desk.prefs.musicLibrary': 'Configurações da biblioteca musical',
  'desk.prefs.services': 'Configurações dos serviços',
  'desk.prefs.parental': 'Controle dos pais',
  'desk.prefs.dateTime': 'Configurações de data e hora',
  // The Mac Preferences window (S1 57.x on Tahoe, 2026-09-15).
  'desk.prefs.eqSettings': 'Configurações de equalização',
  'desk.prefs.musicLibraryShort': 'Biblioteca musical',
  'desk.prefs.servicesShort': 'Serviços',
  'desk.prefs.dateTimeShort': 'Data e hora',
  'desk.prefs.sonora': 'Sonora',
  'desk.prefs.mobileNote':
    'Abra o aplicativo Sonos em um dispositivo móvel para gerenciar seu '
    + 'sistema.',
  'desk.prefs.getMobileApp': 'Baixar o aplicativo móvel',
  'desk.prefs.eqFor': 'Configurações de equalização de música para',
  'desk.prefs.eqCaption': 'Ajuste graves e agudos como preferir.',
  'desk.prefs.roomFor': 'Configurações do cômodo para',
  'desk.prefs.noRooms': 'Nenhum cômodo Sonos foi encontrado.',
  'desk.prefs.folderCol': 'Pasta',
  'desk.prefs.pathCol': 'Caminho',
  'desk.prefs.serviceNameCol': 'Nome do serviço',
  'desk.prefs.nameCol': 'Nome',
  'desk.prefs.loginCol': 'Login da conta',
  'desk.prefs.anonymous': '<Anônimo>',
  'desk.prefs.changeName': 'Alterar Nome',
  'desk.prefs.reauthorize': 'Autorizar Conta Novamente',
  'desk.prefs.visitLabs': 'Visitar o Sonos Labs',
  'desk.menu.settings': 'Configurações…',
  // The Mac app's sheets and About window (2026-09-15).
  'desk.queue.confirmTitle': 'Confirmar',
  'desk.queue.clearBody': 'Tem certeza de que quer limpar a fila?',
  'desk.queue.enterName': 'Digite um novo nome de playlist:',
  'desk.queue.orReplace':
    'Ou escolha uma playlist Sonos existente para substituir:',
  'desk.sleep.setFor': 'Definir um timer de desligamento para “{room}”:',
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
    'Os alarmes são criados e editados no aplicativo Sonos; aqui dá para '
    + 'ligá-los, desligá-los e excluí-los.',
  'desk.alarms.deleteBody': 'Excluir o alarme das {time} em {room}?',
  'desk.alarms.deleteTitle': 'Excluir alarme',
  'desk.alarms.recurrence.WEEKENDS': 'Fins de semana',
  'desk.alarms.recurrence.WEEKDAYS': 'Dias de semana',
  'desk.alarms.recurrence.DAILY': 'Todos os dias',
  'desk.alarms.recurrence.ONCE': 'Uma vez',
  'desk.alarms.repeat': 'Repetir',
  'desk.alarms.room': 'Cômodo',
  'desk.alarms.time': 'Hora',
  'desk.alarms.enabled': 'Ligado',
  'desk.alarms.delete': 'Excluir',
  'desk.alarms.none': 'Nenhum alarme neste sistema.',
  'win.saveQueue.name': 'Digite um novo nome de playlist:',
  'win.saveQueue.replace':
    'Ou escolha uma playlist Sonos existente para substituir:',
  'win.alarm.addTitle': 'Adicionar alarme',
  'win.alarm.editTitle': 'Editar alarme',
  'win.alarm.alarm': 'Alarme',
  'win.alarm.on': 'Ligado',
  'win.alarm.off': 'Desligado',
  'win.alarm.music': 'Música',
  'win.alarm.select': 'Selecionar…',
  'win.alarm.schedule': 'Programação',
  'win.alarm.onceOnly': 'Só uma vez',
  'win.alarm.volume': 'Volume',
  'win.alarm.duration': 'Duração',
  'win.alarm.noLimit': 'Sem limite',
  'win.alarm.linked': 'Incluir os cômodos agrupados',
  'win.alarm.shuffle': 'Tocar a música em ordem aleatória',
  'win.alarm.chime': 'Som da Sonos',
  'win.alarm.browseTitle': 'Navegar pela música do alarme',
  'win.alarm.alarmMusic': 'Música do alarme',
  'win.alarm.importedPlaylists': 'Playlists importadas',
  'win.alarm.setMusic': 'Definir a música do alarme',
  'win.alarm.day.1': 'Segunda-feira',
  'win.alarm.day.2': 'Terça-feira',
  'win.alarm.day.3': 'Quarta-feira',
  'win.alarm.day.4': 'Quinta-feira',
  'win.alarm.day.5': 'Sexta-feira',
  'win.alarm.day.6': 'Sábado',
  'win.alarm.day.0': 'Domingo',
  'win.alarms.manage': 'Gerenciar os alarmes Sonos',
  'win.alarms.currentTime': 'Hora atual: {time}',
  'desk.alarms.currentTime': 'Hora Atual: {date} - {time} {zone}',
  'win.alarms.where': 'Onde',
  'win.alarms.when': 'Quando',
  'win.alarms.on': 'LIGADO',
  'win.alarms.add': 'Adicionar',
  'win.alarms.edit': 'Editar',
  'win.alarms.remove': 'Remover',
  'win.alarms.deleteConfirm': 'Tem certeza de que quer excluir este alarme?',
  'win.alarms.help1': 'Adicionar',
  'win.alarms.help2': 'Remover',
  'desk.alarms.day.0': 'Dom',
  'desk.alarms.day.1': 'Seg',
  'desk.alarms.day.2': 'Ter',
  'desk.alarms.day.3': 'Qua',
  'desk.alarms.day.4': 'Qui',
  'desk.alarms.day.5': 'Sex',
  'desk.alarms.day.6': 'Sáb',
  'desk.queue.saveHint': 'Nome da playlist',
  'desk.queue.saveBody': 'A fila será salva como uma playlist Sonos.',
  'desk.queue.saveTitle': 'Salvar a fila',
  'desk.queue.mixName': 'Mix de {weekday} à {part}',
  'desk.queue.part.morning': 'manhã',
  'desk.queue.part.afternoon': 'tarde',
  'desk.queue.part.night': 'noite',
  'desk.sleep.none': 'Nenhum timer de desligamento definido.',
  'desk.sleep.elsewhere': 'Também ativo em outro lugar',
  'desk.sleep.remaining': 'Timer de desligamento: faltam {time}',
  'desk.sleep.minutes': '{count} minutos',
  'desk.sleep.off': 'Desligado',
  'desk.sleep.hours.one': '{count} hora',
  'desk.sleep.hours.other': '{count} horas',
  'services.needsSignIn':
    'O {service} exige login antes de listar qualquer coisa. Vincule-o ao '
    + 'Sonora para navegar por ele aqui; o que você salvou dele nos Favoritos '
    + 'Sonos ou nas playlists Sonos continua tocando.',
  'desk.library.folders': 'Pastas',
  'desk.library.advanced': 'Avançado',
  'desk.library.mine': 'Minhas pastas de música na Sonos',
  'desk.library.none':
    'Nenhuma pasta de música foi adicionada a este sistema Sonos.',
  'desk.library.addFolder': 'Adicionar…',
  'desk.library.add': 'Adicionar',
  'desk.library.remove': 'Remover',
  'desk.library.pathHint': '//nas/Musica',
  'desk.library.pathNote':
    'O Sonora adiciona pastas pelo caminho de rede (por exemplo '
    + '//nas/Musica). A pasta já precisa estar compartilhada na sua rede. '
    + 'Players S1 só usam compartilhamentos SMBv1; players S2 também falam '
    + 'SMBv2 e SMBv3.',
  'desk.shareWizard.windowTitle': 'Configuração do Sonora',
  'desk.shareWizard.whereTitle': 'Adicionar pasta de músicas',
  'desk.shareWizard.wherePrompt': 'Onde está a música que você quer tocar no Sonos?',
  'desk.shareWizard.myMusic': 'Pasta Músicas',
  'desk.shareWizard.otherFolder': 'Outra pasta ou uma unidade conectada ao meu computador',
  'desk.shareWizard.network': 'Dispositivo em rede (ex.: unidade NAS)',
  'desk.shareWizard.serverNote': 'O Sonora roda em um servidor, então as pastas deste computador estão fora do alcance: ele pode adicionar uma pasta compartilhada na sua rede.',
  'desk.shareWizard.pathTitle': 'Adicionar músicas do compartilhamento de rede',
  'desk.shareWizard.pathPrompt': 'Digite o caminho do compartilhamento de rede:',
  'desk.shareWizard.loginTitle': 'Nome de usuário e senha',
  'desk.shareWizard.loginPrompt': 'Digite o nome de usuário e a senha da unidade de rede com as suas músicas. Deixe os dois vazios se o compartilhamento não pedir.',
  'desk.shareWizard.fieldLabel': '{label}:',
  'desk.shareWizard.adding': 'Adicionando as informações do compartilhamento ao sistema Sonos.',
  'desk.shareWizard.done': '"{path}" agora está configurado no seu sistema Sonos. As músicas estão sendo adicionadas à biblioteca.',
  'desk.shareWizard.failedTitle': 'O Sonos não conseguiu adicionar a pasta de músicas',
  'desk.shareWizard.pathExamples': 'Exemplos:\n\\\\MyOtherComputer\\Shared\\Music\n\\\\MyNetworkedStorage\\Shared\\Music',
  'desk.library.username': 'Nome de usuário',
  'desk.library.password': 'Senha',
  'desk.library.credHint':
    'Deixe os dois campos em branco só se o compartilhamento aceitar '
    + 'convidados. Muitos servidores não aceitam mais.',
  'desk.library.removeTitle': 'Remover pasta de música',
  'desk.library.removeBody':
    'Remover {folder} da biblioteca musical do seu sistema Sonos? A música '
    + 'dentro dela não vai mais aparecer na Sonos.',
  'desk.library.indexTitle': 'Atualizações da biblioteca',
  'desk.library.schedule': 'Atualizar o índice musical todo dia às',
  'desk.library.updateNow': 'Atualizar o índice musical agora',
  'desk.library.noFolders': 'Você ainda não adicionou nenhuma pasta de música ao seu sistema Sonos.',
  'desk.library.addHint': 'Para adicionar músicas ao Sonos, escolha {link} no menu {menu}.',
  'desk.library.working':
    'Atualizando as configurações da sua biblioteca musical…',
  'desk.library.indexing': 'Atualizando a biblioteca musical… Aguarde.',
  'desk.library.indexError':
    'A Sonos não conseguiu terminar a atualização do índice musical: '
    + '{error}',
  'desk.library.addPending':
    'A Sonos ainda está adicionando essa pasta. Ela aparece aqui assim que '
    + 'os players a montarem.',
  'desk.library.adding': 'Adicionando a pasta de música',
  'desk.library.addedIndexing':
    'Adicionada. A Sonos está atualizando o índice musical, o que pode '
    + 'levar vários minutos com uma pasta grande.',
  'desk.library.addingPath':
    '{path} — os players estão montando a pasta. Isso pode levar vários '
    + 'minutos com uma pasta grande.',
  'desk.library.addFailed':
    'A Sonos não conseguiu adicionar a pasta de música {path}.',
  'desk.library.addFailedWhy':
    'Verifique se o caminho da pasta e, se necessário, o nome de usuário e '
    + 'a senha estão corretos.',
  'desk.library.addReason': 'Motivo: {reason}',
  'desk.library.compilations': 'Agrupar álbuns por',
  'desk.library.updateDaily': 'Atualizar o conteúdo todo dia às:',
  'desk.library.showContributing':
    'Mostrar artistas participantes na biblioteca musical. Esta preferência '
    + 'vale só para este controlador.',
  'desk.library.sortFolders': 'Ordenar pastas por',
  'desk.library.sort.songNumber': 'Número da faixa',
  'desk.library.sort.songName': 'Nome da música',
  'desk.library.sort.fileName': 'Nome do arquivo',
  'desk.library.artists': 'Artistas',
  'desk.library.contributingArtists': 'Artistas participantes',
  'desk.library.albums': 'Álbuns',
  'desk.library.composers': 'Compositores',
  'desk.library.genres': 'Gêneros',
  'desk.library.songs': 'Músicas',
  'desk.library.importedPlaylists': 'Playlists importadas',
  'desk.library.foldersNode': 'Pastas',
  'desk.library.groupBy': 'Agrupar coletâneas por',
  'desk.library.group.ITUNES': 'Coletâneas do iTunes®',
  'desk.library.group.WMP': 'Artistas do álbum',
  'desk.library.group.NONE': 'Não agrupar coletâneas',
  'desk.library.compilationsNote':
    'Mudar o agrupamento das coletâneas atualiza o índice musical.',
  'desk.time.timeZone': 'Fuso horário',
  'desk.time.autoDst': 'Ajustar automaticamente para o horário de verão',
  'desk.time.internet': 'Definir data e hora pela internet',
  'desk.time.date': 'Data',
  'desk.time.time': 'Hora',
  'desk.time.dateFormat': 'Formato de data',
  'desk.time.timeFormat': 'Formato de hora',
  'desk.time.fmt.MDY': 'Mês/Dia/Ano',
  'desk.time.fmt.DMY': 'Dia/Mês/Ano',
  'desk.time.fmt.YMD': 'Ano/Mês/Dia',
  'desk.time.fmt.12H': '12 horas',
  'desk.time.fmt.24H': '24 horas',
  'desk.time.notSet': 'Não definido',
  'desk.time.setNow': 'Definir',
  'desk.time.loading': 'Lendo as configurações de hora…',
  'desk.time.server': 'Servidor de hora: {server}',
  'desk.parental.body':
    'O filtro de conteúdo explícito é uma configuração do seu sistema '
    + 'Sonos, compartilhada por todos os aplicativos que o controlam. O '
    + 'Sonora a lê das suas caixas de som e a mostra abaixo.\nAlterá-la exige '
    + 'uma credencial que a Sonos só concede aos próprios aplicativos: as '
    + 'caixas de som aceitam a escrita de qualquer controlador, mas apenas '
    + 'com um token emitido para o aplicativo Sonos, e a única permissão que '
    + 'a Sonos oferece a outros desenvolvedores cobre somente a reprodução. O '
    + 'aplicativo Sonos consegue; este aqui aguarda a Sonos.\nNem todos os '
    + 'serviços oferecem filtro de conteúdo.',
  'desk.parental.filter': 'Filtrar conteúdo explícito',
  'desk.parental.filterFor': 'Filtrar conteúdo explícito em {system}',
  'desk.parental.on': 'Filtros de conteúdo ativados',
  'desk.parental.off': 'Filtros de conteúdo desativados',
  'desk.parental.unknown': 'Não foi possível ler os filtros de conteúdo',
  'desk.parental.reading': 'Lendo a configuração…',
  'desk.parental.turnOn': 'Ativar o filtro de conteúdo explícito',
  'desk.parental.moreInfo': 'Mais informações',
  'desk.parental.unavailable':
    'A Sonos só permite esta mudança nos próprios aplicativos',
  'desk.prefs.roomSettings': 'Configurações do cômodo',
  'desk.prefs.settingsFor': 'Configurações de {room}',
  'desk.prefs.musicEq': 'Equalização de música',
  'desk.prefs.device': 'Dispositivo',
  'desk.prefs.bass': 'Graves',
  'desk.prefs.treble': 'Agudos',
  'desk.prefs.balance': 'Balanço',
  'desk.prefs.left': 'E',
  'desk.prefs.right': 'D',
  'desk.prefs.loudness': 'Loudness',
  'desk.prefs.reset': 'Redefinir',
  'desk.prefs.eqFixed':
    'As configurações de equalização não ficam disponíveis enquanto o nível '
    + 'da saída de linha de uma caixa de som Sonos estiver em Fixo.',
  'desk.prefs.roomName': 'Nome do cômodo',
  'desk.prefs.apply': 'Aplicar',
  'desk.prefs.statusLight': 'Luz de status',
  'desk.prefs.on': 'Ligada',
  'desk.prefs.off': 'Desligada',
  'desk.prefs.servicesTitle': 'Minhas contas de serviços na Sonos',
  'desk.prefs.servicesSignIn':
    'Nenhum serviço configurado está listado. O Sonora os lê das próprias '
    + 'caixas de som, então isso costuma significar que nenhuma foi '
    + 'alcançada.',
  'desk.about.title': 'Sobre meu sistema Sonos',
  'desk.about.body': 'As caixas de som desta rede, por sistema.',
  'desk.about.model': 'Modelo',
  'desk.about.version': 'Versão',
  'desk.about.address': 'Endereço',
  'desk.about.speakers': 'Caixas de som',
  'desk.about.system': 'Sistema',
  'desk.shortcuts.title': 'Atalhos de teclado',
  'desk.shortcuts.playPause': 'Reproduzir/Pausar',
  'desk.shortcuts.volUp': 'Aumentar o volume',
  'desk.shortcuts.volDown': 'Diminuir o volume',
  'desk.shortcuts.mute': 'Silenciar/reativar o cômodo ou grupo atual',
  'desk.shortcuts.nextZone': 'Selecionar o próximo grupo de cômodos',
  'desk.shortcuts.prevZone': 'Selecionar o grupo de cômodos anterior',
  'notice.cannotPlay.title': 'Isso não tocou',
  'notice.cannotPlay.detail':
    '{room} não conseguiu reproduzir {item}. {reason}',
  'notice.cannotPlay.stream':
    '{room} não conseguiu reproduzir {item}: nada voltou de {host}. '
    + '{reason}',
  'notice.cannotPlay.format': 'A caixa de som não aceita esse formato.',
  'notice.cannotPlay.connect': 'A caixa de som não conseguiu alcançá-lo.',
  'notice.cannotPlay.refused': 'O serviço recusou a reprodução.',
  'notice.cannotPlay.missing': 'Não está mais lá.',
  'notice.cannotPlay.permission':
    'Esta conta não tem permissão para reproduzir isso.',
  'notice.notPlaying.title': 'Nada começou a tocar',
  'notice.notPlaying.detail':
    '{room} aceitou o comando e parou de novo. A fonte atual não pôde ser '
    + 'reproduzida; escolha outra coisa no painel de música.',
  'notice.notPlaying.stream':
    '{room} aceitou o comando e parou de novo. A fonte é um fluxo de '
    + '{host}, que parece estar off-line.',
  'desk.menu.quit': 'Sair da Sonos',
  'desk.menu.delete': 'Excluir',
  'desk.menu.selectAll': 'Selecionar tudo',
  'desk.menu.fullScreen': 'Entrar em tela cheia',
  'desk.menu.updatePlaylists': 'Atualizar as playlists do iTunes agora',
  'desk.menu.updateAlbumArt': 'Atualizar as capas agora',
  'desk.menu.window': 'Janela',
  'desk.menu.close': 'Fechar',
  'desk.menu.uninstall': 'Desinstalar…',
  'desk.menu.services': 'Serviços',
  'desk.menu.hideSonos': 'Ocultar Sonos',
  'desk.menu.hideOthers': 'Ocultar Outros',
  'desk.menu.showAll': 'Mostrar Tudo',
  'desk.menu.autofill': 'Preenchimento Automático',
  'desk.menu.dictation': 'Iniciar Ditado…',
  'desk.menu.emoji': 'Emojis e Símbolos',
  'desk.menu.fill': 'Preencher',
  'desk.menu.center': 'Centralizar',
  'desk.menu.moveResize': 'Mover e Redimensionar',
  'desk.menu.fullScreenTile': 'Lado a Lado em Tela Cheia',
  'desk.menu.removeFromSet': 'Remover Janela do Conjunto',
  'win.menu.file': 'Arquivo',
  'win.menu.exit': 'Sair',
  'win.menu.showMini': 'Mostrar o mini controlador',
  'win.shortcuts.toggleMini': 'Mostrar/ocultar o mini controlador',
  'win.setup.title': 'Configuração do Sonora',
  'win.setup.lib.pathTitle': 'Adicionar música de um compartilhamento de rede',
  'win.setup.lib.pathText':
    'Digite o caminho do seu compartilhamento de rede:',
  'win.setup.lib.examples': 'Exemplos:',
  'win.setup.lib.browse': 'Procurar',
  'win.setup.lib.credTitle': 'Nome de usuário e senha',
  'win.setup.lib.credText':
    'Informe o nome de usuário e a senha, se houver, da unidade de rede que '
    + 'contém sua música:',
  'win.setup.lib.username': 'Nome de usuário:',
  'win.setup.lib.password': 'Senha:',
  'win.setup.lib.adding': 'Adicionando a pasta de música',
  'win.setup.lib.doneTitle': 'Configuração da biblioteca musical',
  'win.setup.lib.doneSetUp':
    '“{folder}” agora está configurada no seu sistema Sonos.',
  'win.setup.lib.doneAdding':
    'Sua música está sendo adicionada ao sistema Sonos. Isso pode levar '
    + 'vários minutos.',
  'win.setup.lib.doneNotice':
    'Você poderá adicionar música à Sonos depois em “Gerenciar biblioteca '
    + 'musical”, nas Configurações.',
  'win.setup.lib.errorTitle': 'Erro ao adicionar a música',
  'win.setup.lib.errorMessage':
    'A Sonos não conseguiu adicionar a pasta de música',
  'win.setup.lib.errorDetails':
    'Verifique se o caminho da pasta e, se necessário, o nome de usuário e '
    + 'a senha estão corretos.',
  'win.setup.lib.errorReason': 'Motivo: {reason}',
  'win.services.addHint':
    'Clique em “Adicionar” para adicionar um novo serviço ao seu sistema '
    + 'Sonos.',
  'win.services.labsHint':
    'Clique em “Sonos Labs” para experimentar serviços que estão por vir no '
    + 'seu sistema Sonos.',
  'win.services.serviceName': 'Nome do serviço',
  'win.services.name': 'Nome',
  'win.services.login': 'Login da conta',
  'win.services.anonymous': '<Anônimo>',
  'win.services.add': 'Adicionar',
  'win.services.signInWith': 'Entrar com o {service}',
  'win.services.labs': 'Sonos Labs',
  'win.services.addTitle': 'Adicionar um serviço',
  'win.services.labsTitle': 'Bem-vindo ao Sonos Labs',
  'win.services.labsPrompt':
    'Escolha o serviço do Sonos Labs que você quer adicionar:',
  'win.services.labsSignedOut':
    'Entre na sua conta Sonos para ver os serviços do Sonos Labs.',
  'win.services.labsFailed':
    'Não foi possível obter a lista de serviços do Sonos Labs: {error}',
  'win.services.edit': 'Editar',
  'win.services.editTitle': 'Editar serviço',
  'win.services.editHeading': 'Editar a conta do {service}',
  'win.services.editPrompt': 'Digite um nome para a conta:',
  'win.services.editName': 'Nome:',
  'win.services.replace': 'Substituir',
  'win.services.reauthorize': 'Reautorizar',
  'win.services.removeTitle': 'Remover conta',
  'win.services.removeBody':
    'Tem certeza de que quer remover esta conta do {service} do seu sistema '
    + 'Sonos?',
  'win.eq.tab': 'Equalização',
  'win.eq.intro': 'Ajuste graves e agudos como preferir.',
  'win.errorLog.title': 'Registro de erros do sistema Sonora',
  'desk.errorLog.empty': 'Nenhum erro foi registrado nos últimos sete dias.',
  'win.library.title': 'Minhas pastas de música na Sonos',
  'win.library.addHint':
    'Clique em “Adicionar” para adicionar uma nova pasta de música ao seu '
    + 'sistema Sonos.',
  'win.library.removeHint':
    'Clique em “Remover” para tirar a pasta destacada.',
  'win.library.name': 'Nome',
  'win.library.path': 'Caminho',
  // The Windows app's own two lines while the library updates.
  'win.library.indexing1': 'Atualizando a biblioteca musical…',
  'win.library.indexing2': 'Aguarde.',
  'win.mini.noMusic': '[sem música]',
  'win.mini.volume': 'Volume',
  'win.mini.larger': 'Maior',
  'win.mini.smaller': 'Menor',
  'win.menu.checkUpdates': 'Verificar atualizações de software…',
  'win.menu.changeLanguage': 'Mudar o idioma…',
  'win.menu.settings': 'Configurações…',
  'win.settings.title': 'Configurações',
  'win.sleep.title': 'Timer de desligamento ({state})',
  'win.sleep.choose':
    'Escolha a duração do timer de desligamento para "{room}":',
  'desk.window.controller': 'Controlador Sonora {systems}',
  'win.about.title': 'Sobre',
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
  'win.shortcuts.intro': 'O Sonora aceita os seguintes atalhos de teclado:',
  'win.shortcuts.function': 'Função',
  'win.shortcuts.shortcut': 'Atalho',
  'win.shortcuts.toggleShuffle': 'Ativar/desativar a reprodução aleatória',
  'win.shortcuts.toggleRepeat': 'Ativar/desativar a repetição',
  'win.shortcuts.muteAll': 'Silenciar tudo',
  'win.shortcuts.topMenu': 'Voltar ao menu Música principal',
  'win.shortcuts.favorites': 'Ir para os favoritos',
  'win.shortcuts.toggleCrossfade': 'Ativar/desativar a transição suave',
  'win.shortcuts.scrollCurrent': 'Rolar até a faixa atual na fila',
  'win.shortcuts.closeWindow': 'Fechar a janela ativa',
  'win.shortcuts.browserNote':
    'Três deles diferem do aplicativo Sonos: um navegador guarda Ctrl+T, '
    + 'Ctrl+L e Ctrl+W para si.',
  'win.shortcuts.jumpSearch': 'Ir para o campo de busca',
  'win.shortcuts.playNext': 'Reproduzir a faixa selecionada em seguida',
  'win.shortcuts.replaceQueue': 'Substituir a fila pela seleção',
  'win.shortcuts.playLater': 'Reproduzir a seleção depois',
  'win.shortcuts.resizeQueue': 'Redimensionar a fila',
  'win.shortcuts.prevTrack': 'Faixa anterior',
  'win.shortcuts.nextTrack': 'Próxima faixa',
  'win.shortcuts.showShortcuts': 'Mostrar a lista de atalhos de teclado',
  'win.settings.sonora': 'Sonora',
  'win.parental.title': 'Controle dos pais',
  'win.parental.enabled':
    'O filtro de conteúdo explícito está ativado. Clique no botão abaixo '
    + 'para permitir conteúdo explícito no seu sistema Sonos.\n\nNem todos os '
    + 'serviços oferecem filtro de conteúdo.',
  'win.parental.disabled':
    'O filtro de conteúdo explícito está desativado. Clique no botão abaixo '
    + 'para impedir que conteúdo explícito toque no seu sistema Sonos.\n\nNem '
    + 'todos os serviços oferecem filtro de conteúdo.',
  'win.parental.noServices':
    'Não há serviços de música no seu sistema Sonos que ofereçam filtro de '
    + 'conteúdo.',
  'win.parental.unreadable':
    'Este sistema não informou se o filtro de conteúdo explícito está '
    + 'ativado.',
  'win.parental.turnOn': 'Ativar o filtro de conteúdo explícito',
  'win.parental.turnOff': 'Desativar o filtro de conteúdo explícito',
  'win.parental.moreInfo': 'Mais informações',
  'win.settings.eq': 'Configurações de equalização',
  'win.settings.library': 'Biblioteca musical',
  'win.settings.services': 'Serviços',
  'win.settings.eqFor': 'Configurações de equalização para',
  'win.settings.mobileNote':
    'Abra o aplicativo Sonos em um dispositivo móvel para gerenciar seu '
    + 'sistema.',
  'win.settings.getApp': 'Baixar o aplicativo móvel',
  'win.maximize': 'Maximizar',
  'win.restore': 'Restaurar',
  'desk.menu.minimize': 'Minimizar',
  'desk.menu.zoom': 'Zoom',
  'desk.menu.bringAllToFront': 'Trazer tudo para a frente',
  'desk.menu.shop': 'Comprar produtos Sonos',
  'desk.menu.firewallHelp': 'Ajuda para configurar o firewall',
  'desk.menu.errorLog': 'Registro de erros',
  'desk.menu.reset': 'Redefinir o controlador',
  'desk.menu.forget': 'Esquecer o sistema Sonos atual',
  'desk.window.title': 'Sonora',
  'desk.add.title': 'Adicionar serviços de música',
  'desk.add.button': 'Adicionar…',
  'desk.add.intro': 'Escolha um serviço para adicionar ao seu sistema Sonos.',
  'win.addService.title': 'Adicionar um serviço',
  'win.addService.heading': 'Serviços disponíveis',
  'win.addService.intro': 'Selecione o serviço que você quer adicionar ao seu sistema Sonos.',
  'desk.add.auth.Anonymous': 'Não precisa de conta',
  'desk.add.appOnly': 'Só no aplicativo Sonos',
  'desk.add.another': 'Outra conta',
  'desk.add.unpairable':
    'O {service} só pode ser adicionado pelo aplicativo Sonos oficial: o '
    + 'provedor dele não autentica um controlador que não seja da Sonos.',
  'desk.add.auth.DeviceLink': 'Login no site do provedor',
  'desk.add.auth.AppLink': 'Login no site do provedor, se oferecido',
  'desk.add.needsApp':
    'O {service} não permite login pelo Sonora; o provedor dele só aceita '
    + 'login pelo aplicativo Sonos oficial. Adicione-o por lá para usá-lo nos '
    + 'aplicativos Sonos. O que você salvou dele nos Favoritos Sonos ou nas '
    + 'playlists Sonos continua tocando no Sonora.',
  'desk.add.instructions': 'Acesse {url}, faça login e informe este código:',
  'desk.add.instructionsNoCode':
    'Acesse {url} e faça login para autorizar a Sonos.',
  'desk.add.open': 'Abrir no navegador',
  'desk.add.waiting': 'Aguardando a confirmação do {service}…',
  'desk.add.authorizeTitle': 'Adicionar conta do {service}',
  'desk.add.authorizeBody': 'Entre no {service} pelo navegador para que o Sonos possa usar sua conta.',
  'desk.add.authorize': 'Autorizar',
  'desk.add.doneSystem.multi':
    'O {service} foi adicionado ao seu sistema {gen} e está pronto nos seus '
    + 'dispositivos {gen}, tanto no Sonora quanto no aplicativo Sonos '
    + 'oficial. Para usá-lo também nos dispositivos {other}, adicione-o de '
    + 'novo pelos {link}.',
  'desk.add.doneSystem.solo':
    'O {service} foi adicionado ao seu sistema Sonos e está pronto nos seus '
    + 'dispositivos, tanto no Sonora quanto no aplicativo Sonos oficial.',
  'desk.add.doneAnon.multi':
    'O {service} já está disponível no Sonora nos seus dispositivos {gen}. '
    + 'Não foi possível adicioná-lo ao seu sistema Sonos, então ele não vai '
    + 'aparecer nos aplicativos Sonos. Para usá-lo nos dispositivos {other} '
    + 'no Sonora, adicione-o de novo pelos {link}.',
  'desk.add.doneAnon.solo':
    'O {service} já está disponível no Sonora nos seus dispositivos. Não '
    + 'foi possível adicioná-lo ao seu sistema Sonos, então ele não vai '
    + 'aparecer nos aplicativos Sonos.',
  'desk.add.failed': 'Não foi possível adicionar o {service}: {error}',
  // --- About dialog ------------------------------------------------------
  'about.title': 'Sobre o Sonora',
  'about.menu': 'Sobre o Sonora',
  'about.version': 'Versão {version}',
  'about.tagline': 'Um controlador web auto-hospedado para todos os alto-falantes Sonos.',
  'about.pointLocal': 'Controle local em primeiro lugar',
  'about.pointThemes': 'Temas muito bem acabados',
  'about.pointNetwork': 'Diagnóstico de rede',
  'about.pointUpgrade': 'Assistente de atualização de hardware',
  'about.pointMore': 'E muito mais…',
  'about.license': 'Sonora é software livre, publicado sob a licença {license}.',
  'about.github': 'Ver no GitHub',
  'about.thirdParty': 'Licenças de terceiros',
  'about.support': 'Apoiar o Sonora',
  'about.supportNote': 'Se o Sonora for útil para você, considere apoiar o projeto.',
  'about.trademark': 'O Sonora não é afiliado nem endossado pela Sonos.\nSonos é uma marca registrada da Sonos, Inc.',
  'desk.showSystem': 'Mostrar o sistema',
  'desk.services.tab': 'Serviços {system}',
  'desk.add.starting': 'Pedindo ao {service} um link de login…',
  'desk.add.linking': 'Vinculando ao {service}…',
  // --- removing a music service (every theme) --------------------------------
  'services.remove': 'Remover',
  'services.rename': 'Renomear',
  'services.renameTitle': 'Renomear a conta do {service}',
  'services.renamed': 'Conta do {service} renomeada para {name}',
  'services.removeHint': 'Remover o serviço destacado',
  'services.removeTitle': 'Remover o {service}?',
  'services.removeChoose': 'De onde você quer remover o {service}?',
  'services.removeSonora': 'Sonora',
  'services.removeSonoraSub': 'o login dele e a entrada aqui',
  'services.removeSonos': 'Sonos {gen}',
  'services.removeSonosSub': 'a conta no seu sistema Sonos',
  'services.confirmRemove': 'Remover',
  'services.removing': 'Removendo o {service}…',
  'services.removeFailed': 'Não foi possível remover o {service}: {error}',
  'services.removeFromSonos': 'Remover da Sonos',
  'services.removeSonosBody':
    'Remover o {service} do seu sistema Sonos? Ele sairá de todos os '
    + 'aplicativos Sonos, não só do Sonora.',
  'services.removeSonoraBody': 'Remover {service} do Sonora? O Sonora esquece o login.',
  'desk.add.doneSonora.multi':
    'O {service} agora está vinculado no Sonora.\nVocê também precisará '
    + 'vincular o {service} uma segunda vez — direto em algum dos aplicativos '
    + 'Sonos {gen} — para que o Sonora controle seus dispositivos {gen}.\nPara '
    + 'usar o {service} nos dispositivos {other} no Sonora, vincule-o de novo '
    + 'pelos {link}.',
  'services.relinkLinkText': 'serviços {other}',
  'services.caution.sonos': 'Vinculado ao Sonos {gen}, ainda não ao Sonora',
  'services.needsSonora.title': 'Vínculo com o Sonora necessário',
  'services.needsSonos.title': 'Vínculo com o Sonos {gen} necessário',
  'services.caution.sonora': 'Vinculado ao Sonora, ainda não ao Sonos {gen}',
  'services.sonoraOnly.body':
    'O {service} está vinculado no Sonora, mas não ao seu sistema Sonos '
    + '{gen}.\nO Sonora consegue navegar por ele, mas seus dispositivos {gen} '
    + 'não vão reproduzi-lo até que você vincule o {service} em algum dos '
    + 'aplicativos Sonos {gen}.',
  'desk.add.doneSonora.solo':
    'O {service} agora está vinculado no Sonora.\nVocê também precisará '
    + 'vincular o {service} uma segunda vez — direto em algum dos aplicativos '
    + 'Sonos {gen} — para que o Sonora controle seus dispositivos {gen}.',

  // --- Sonofuture ---

  // --- S2 Upgrade Info ---
  's2.title': 'Consultor de atualização Sonos',
  's2.lede':
    'Entenda qual hardware seria necessário para migrar de vez para o S2 ou '
    + 'o S2.1, e quanto isso custaria aproximadamente.',
  's2.con4':
    'O aplicativo S1 está inalterado há anos e é estável. O aplicativo S2 '
    + 'foi reescrito em 2024 e esse lançamento foi conturbado.',
  's2.colRoom': 'Cômodo',
  's2.colProduct': 'Produto',
  's2.colReplacement': 'Equivalente S2',
  's2.colReplacementS21': 'Equivalente S2.1',
  's2.colPrice': 'Preço de tabela nos EUA',
  's2.ready': 'Sim',
  's2.notReady': 'Não, só S1',
  's2.unknown': 'Desconhecido',
  's2.replaceTitle': 'Quanto custaria ter o S2 em todos os cômodos',
  's2.replaceBlurb': 'Todos os dispositivos da casa e o que cada um precisa para chegar ao S2: uma atualização de software, uma substituição pelo preço de tabela ou nada.',
  's2.noReplacement': 'Nada a comprar',
  's2.noReplacementWhy':
    'uma caixa de som com fio sustenta a rede, e o aplicativo substituiu o '
    + 'controlador',
  's2.total': 'Total para levar este sistema ao S2',
  's2.amazonDisclosure': 'Como associado da Amazon, ganho com compras qualificadas.',
  's2.pricesNote': 'Preços de tabela nos EUA, verificados no {quarter}º trimestre de {year}. Os preços podem mudar, então confirme antes de comprar.',
  's2.timelineTitle': 'Três gerações de hardware',
  's2.era.s1': 'Só S1',
  's2.era.s20': 'S2.0',
  's2.era.s21': 'S2.1',
  's2.eraSpan': 'de {from} a {to}',
  's2.eraOpen': 'de {from} até hoje',
  's2.eraBounds.s1':
    'Do ZonePlayer 100 (janeiro de 2005) ao Play:5 ger. 1 (novembro de '
    + '2015). Nada desses anos roda o S2.',
  's2.eraBounds.s20':
    'Do Play:3 (julho de 2011) à luminária de mesa Symfonisk ger. 1 '
    + '(janeiro de 2022). Roda o S2, fora dos novos recursos desde 2025.',
  's2.eraBounds.s21':
    'Do Sonos One (outubro de 2017) em diante. Tudo o que a Sonos vende '
    + 'hoje.',
  's2.mark.s2app': 'Aplicativo S2, junho de 2020',
  's2.mark.freeze': 'S2.0 congelado, 2025',
  's2.linksIntro': 'Nas palavras da Sonos:',
  's2.linkS2Launch': 'A apresentação do S2, junho de 2020',
  's2.linkS21Launch': 'A atualização dos produtos legados de 2025',
  's2.allReady':
    'Todos os dispositivos S1 daqui rodam o S2. Este sistema pode migrar '
    + 'sem comprar nada.',
  's2.allS21':
    'Todos os seus dispositivos estão na plataforma Sonos S2.1. Você não '
    + 'tem nada a atualizar. Ou é muito novo na Sonos ou é muito rico. De '
    + 'todo modo, parabéns!',

  // --- the network map ---
  'net.mapTitle': 'Todos os dispositivos da rede',
  'net.mapBlurb': 'Um cartão por alto-falante. Cada um diz se a conexão está saudável e por quê, pela rapidez e confiabilidade das respostas. Abra Detalhes para ver o resto.',
  'net.mapEmpty': 'Nenhum dispositivo respondeu.',
  'net.wired': 'Com fio',
  'net.onSonosnet': 'SonosNet',
  'net.onWifi': 'Wi-Fi',
  'net.channel': 'Canal {n}',
  'net.unreachable': 'Não respondeu',
  'net.notMeasurable': 'Sem vizinhos para medir',
  'net.drop.title': 'Quedas na reprodução',
  'net.drop.blurb': 'As vezes nos últimos sete dias em que a música de um ambiente cortou.',
  'net.drop.none': 'Nenhuma queda nos últimos sete dias.',
  'net.drop.buffering': 'Pausou {seconds} s para carregar',
  'net.drop.skipped': 'Pulou algo que não conseguia reproduzir',
  'net.drop.failed': 'Parou: não foi possível reproduzir',
  'net.drop.more': 'E mais {count} anteriores.',
  'net.fix.no_answer': 'Verifique se está ligado e ainda na sua rede.',
  'net.fix.lost': 'Geralmente cobertura fraca onde está ou um canal congestionado. Tente-o mais perto do roteador.',
  'net.fix.slow': 'Muitas vezes um sinal fraco do roteador. Aproximar o alto-falante ou o roteador costuma ajudar.',
  'net.fix.slow_often': 'Geralmente outro tráfego Wi-Fi ou interferência no canal: micro-ondas, babás eletrônicas e redes dos vizinhos são causas comuns.',
  'net.fix.uneven': 'Geralmente outro tráfego Wi-Fi ou interferência no canal: micro-ondas, babás eletrônicas e redes dos vizinhos são causas comuns.',
  'net.fix.stall': 'Uma única pausa longa costuma ser um pico de outro tráfego Wi-Fi. Se continuar neste cômodo, procure interferência por perto.',
  'net.fix.dropping': 'A própria conexão Wi-Fi dele está perdendo pacotes. Sinal fraco ou interferência por perto são as causas comuns.',
  'net.fix.extender': 'Repetidores adicionam atraso. Conecte-o ao roteador principal, se ele alcançar.',
  'net.summary.clear': 'Nada digno de nota. Todos os alto-falantes respondem rápido.',
  'net.summary.issues': '{parts}. O cartão de cada alto-falante abaixo explica o motivo.',
  'net.summary.and': ' e ',
  'net.probing': 'Verificando os alto-falantes. Aguarde...',
  'net.health.good': 'Bom',
  'net.health.watch': 'Vale acompanhar',
  'net.health.problem': 'Problema',
  'net.health.unmeasured': 'Não medido',
  'net.why.ok': 'Responde em {median} ms',
  'net.why.no_answer': 'Sem resposta em nenhuma de {attempts} tentativas',
  'net.why.lost': 'Faltaram {failed} de {attempts} respostas',
  'net.why.slow': 'Costuma responder em {median} ms',
  'net.why.slow_often': '1 resposta em 20 leva mais de {p95} ms',
  'net.why.uneven': '1 resposta em 20 leva mais de {p95} ms',
  'net.why.stall': 'Uma resposta levou {worst} ms',
  'net.why.dropping': 'Perde {rate} pacotes por minuto',
  'net.why.extender': 'Conectado por um repetidor Wi-Fi',
  'net.details': 'Detalhes',
  'net.replies': 'Respostas',
  'net.repliesLine': 'em geral {median} ms · 1 em 20 acima de {p95} ms · a mais lenta {worst} ms · faltaram {failed} de {attempts}',
  'net.dropped': 'Pacotes perdidos',
  'net.perMinute': '{n} por minuto',
  'net.notReported': 'Não informado',
  'net.hears': 'Ouve outros alto-falantes Sonos',
  'net.hearsHint': 'Com que intensidade este alto-falante ouve os outros alto-falantes do seu sistema. Indica onde ele está, não a conexão Wi-Fi: nenhum alto-falante Sonos informa como ouve o seu roteador.',
  'net.noiseLabel': 'Ruído de rádio',
  'net.count.problem.one': '{count} problema',
  'net.count.problem.other': '{count} problemas',
  'net.count.watch.one': '{count} para acompanhar',
  'net.count.watch.other': '{count} para acompanhar',
  'net.margin': 'margem de {n} dB',
  'net.alone': 'Nenhum alto-falante ao alcance',
  's2.tier.s21': 'S2.1',
  's2.tier.s20': 'S2.0',
  's2.tier.unknown': 'Desconhecido',
  's2.s21Title': 'Quanto custaria ter o S2.1 em todos os cômodos',
  's2.s21Blurb': 'Todos os dispositivos da casa e o que cada um precisa para chegar ao S2.1. Uma unidade que não roda S2, ou que só chegaria ao S2.0, é substituída pelo produto atual que ocupa seu lugar. Este total inclui o custo de passar para o S2.',
  's2.colWhy': 'Motivo',
  's2.why.legacy': 'Não roda o S2',
  's2.why.lower': 'Só S2.0',
  's2.why.upgradable': 'Atualizável',
  's2.why.runningS2': 'Executando S2',
  's2.why.runningS21': 'Executando S2.1',
  's2.totalS21': 'Total para chegar ao S2.1 em todos os cômodos',
  's2.s21AllReady':
    'Todos os cômodos daqui já seriam S2.1. Não há nada a comprar.',
  's2.tierUnknownNote.one':
    'Um dispositivo não pôde ser classificado: a Sonos lista só algumas '
    + 'gerações desse produto, e a caixa de som não informa qual delas é.',
  's2.tierUnknownNote.other':
    '{count} dispositivos não puderam ser classificados: a Sonos lista só '
    + 'algumas gerações desses produtos, e as caixas de som não informam '
    + 'quais delas são.',
  's2.choiceTitle': 'O que você quer fazer?',
  's2.choiceKeepBoth': 'Manter sistemas S1 e S2 separados',
  's2.choiceKeepBothNote':
    'Manter dois sistemas Sonos separados: S1 e S2, como agora. (Alguns '
    + 'dispositivos S1 podem ser atualizados por software para o S2.)',
  's2.choiceStayS1': 'Continuar usando seu sistema S1',
  's2.choiceStayS1Note': 'Continue usando seu sistema S1 como agora. Nenhuma ação é necessária.',
  's2.choiceStayS2': 'Continuar usando seu sistema S2',
  's2.choiceStayS2Note': 'Continue usando seu sistema S2 como agora. Nenhuma ação é necessária.',
  's2.choiceS2': 'Migrar para o S2',
  's2.choiceS2Note':
    'Atualizar por software todas as caixas de som S1 elegíveis para o S2 e '
    + 'comprar substitutos para os aparelhos S1 que não conseguem fazer a '
    + 'viagem.',
  's2.choiceS21': 'Migrar para o S2.1',
  's2.choiceS21Note':
    'Comprar substitutos para todos os dispositivos Sonos que não são '
    + 'compatíveis com o S2.1. A opção sem olhar o preço, à prova de futuro.',
  's2.choiceFree': 'Nada a comprar',
  's2.colBuy': 'Ação',
  's2.buyNow': 'Comprar',
  's2.updateNow': 'Atualizar agora',
}
