import React, { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../frontend/src/i18n/index.jsx'
import { api } from '../../frontend/src/lib/api.js'
import Wizard91 from './Wizard91.jsx'
import { IconCombo, ROOM_NAMES } from './Classic.jsx'

const ICON_PREFIX = 'x-rincon-roomicon:'
const POLL = 1000

// Manage > Add a Speaker or Sub... and Add a Boost or Bridge..., in 9.1's
// wizard window. The order of pages is the app's setup wizard's
// (SCSetupPlayerTypeState, SCSetupPrepState, SCSetupIdentifyScanningState,
// SCSetupConnectingState, SCSetupNameDeviceState, SCSetupDeviceAddedState,
// and for a Boost or Bridge SCSetupAddBridgeState in place of naming). The
// backend does the talking to the new device (see backend/sonos/setup.py);
// this file only follows its state.
//
// `kind` is 'player' for a speaker or sub, 'bridge' for a Boost or Bridge.
export default function AddDevice91({ kind = 'player', household, zones = [], onClose }) {
  const { t } = useI18n()
  const bridge = kind === 'bridge'
  const [step, setStep] = useState(bridge ? 'prep' : 'type')
  const [what, setWhat] = useState('speaker')
  const [found, setFound] = useState(null)
  const [error, setError] = useState('')
  const [room, setRoom] = useState({ text: '', icon: '' })
  const [subRoom, setSubRoom] = useState('')
  const session = useRef(null)
  const title = bridge ? t('w91.add.bridgeTitle') : t('w91.add.playerTitle')

  // Stop listening for a button press whenever the window goes.
  useEffect(() => () => { if (session.current) api.setupCancel(session.current).catch(() => {}) }, [])

  // The app's own words first; a reason the backend gives goes under them.
  // A request that never reached Sonora says nothing worth showing.
  const [unsupported, setUnsupported] = useState(false)
  const fail = (reason, notHere = false) => { setError(typeof reason === 'string' ? reason : ''); setUnsupported(notHere); setStep('error') }

  const scan = async () => {
    setStep('scan')
    try {
      const started = await api.setupStart({ household, kind: bridge ? 'bridge' : what })
      session.current = started.session
    } catch (exc) { fail(exc?.status ? exc.message : undefined, exc?.status === 501); return }
  }

  // While a session is open, follow it: waiting for the button, connecting,
  // then the device is in the household.
  useEffect(() => {
    if (!['scan', 'connect', 'finish'].includes(step) || !session.current) return undefined
    let live = true
    const tick = async () => {
      try {
        const s = await api.setupStatus(session.current)
        if (!live) return
        if (s.state === 'found' && step === 'scan') { setFound(s.device); setStep('connect'); await api.setupJoin(session.current) }
        else if (s.state === 'joined' && step === 'connect') setStep(bridge ? 'done' : (what === 'sub' ? 'subroom' : 'name'))
        else if (s.state === 'named' && step === 'finish') setStep('done')
        else if (s.state === 'failed') fail(s.error)
      } catch (exc) { if (live) fail(exc?.status ? exc.message : undefined) }
    }
    const timer = setInterval(tick, POLL)
    tick()
    return () => { live = false; clearInterval(timer) }
  }, [step, bridge, what]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = async () => {
    setStep('finish')
    try {
      if (what === 'sub') await api.setupFinish(session.current, { sub_room: subRoom })
      else await api.setupFinish(session.current, { name: room.text.trim(), icon: room.icon })
    } catch (exc) { fail(exc?.status ? exc.message : undefined) }
  }

  const rooms = ROOM_NAMES.map(([key, label]) => ({ key, text: t(label), icon: ICON_PREFIX + key }))
  const cancel = onClose
  let page
  let foot = { cancel }
  switch (step) {
    case 'type':
      page = [
        { kind: 'title', text: t('w91.add.typeTitle') },
        { kind: 'choice', value: what, onChange: setWhat,
          items: [{ id: 'speaker', label: t('w91.add.typeSpeaker') }, { id: 'sub', label: t('w91.add.typeSub') }] },
      ]
      foot = { next: () => setStep('prep'), cancel }
      break
    case 'prep':
      page = [
        { kind: 'title', text: bridge ? t('w91.add.bridgePrepTitle') : t('w91.add.prepTitle') },
        { kind: 'body', text: bridge ? t('w91.add.bridgePrepBody') : (what === 'sub' ? t('w91.add.subPrepBody') : t('w91.add.prepBody')) },
        { kind: 'body', text: t('w91.add.prepWait') },
      ]
      foot = { back: bridge ? undefined : () => setStep('type'), next: scan, cancel }
      break
    case 'scan':
      page = [
        { kind: 'title', text: t('w91.add.pressTitle') },
        { kind: 'body', text: bridge ? t('w91.add.bridgePressBody') : (what === 'sub' ? t('w91.add.subPressBody') : t('w91.add.pressBody')) },
        { kind: 'spinner' },
        { kind: 'body', text: t('w91.add.looking') },
      ]
      foot = { cancel }
      break
    case 'connect':
      page = [
        { kind: 'title', text: t('w91.add.connectTitle', { model: found?.model || '' }) },
        { kind: 'spinner' },
        { kind: 'body', text: t('w91.add.connectBody') },
      ]
      foot = {}
      break
    case 'name':
      page = [
        { kind: 'title', text: t('w91.add.nameTitle') },
        { kind: 'body', text: t('w91.add.nameBody') },
        { kind: 'node', node: (
          <IconCombo key="room" items={rooms} text={room.text} icon={room.icon} editable label={t('desk.prefs.roomName')}
                     onPick={(item) => setRoom({ text: item.text, icon: item.icon })}
                     onType={(text) => setRoom((r) => ({ ...r, text }))} className="w91-wizard-room" />
        ) },
      ]
      foot = { next: room.text.trim() ? finish : undefined }
      break
    case 'subroom':
      page = [
        { kind: 'title', text: t('w91.add.subRoomTitle') },
        { kind: 'choice', value: subRoom, onChange: setSubRoom,
          items: zones.filter((z) => !z.local).map((z) => ({ id: z.uuid, label: z.name })) },
      ]
      foot = { next: subRoom ? finish : undefined }
      break
    case 'finish':
      page = [{ kind: 'spinner' }, { kind: 'body', text: t('w91.add.finishing') }]
      foot = {}
      break
    case 'done':
      page = [
        { kind: 'title', text: t('w91.add.doneTitle') },
        { kind: 'body', text: bridge ? t('w91.add.bridgeDoneBody') : t('w91.add.doneBody') },
        { kind: 'buttons', items: [
          { label: t('w91.add.another'), onClick: () => { session.current = null; setFound(null); setRoom({ text: '', icon: '' }); setStep(bridge ? 'prep' : 'type') } },
        ] },
      ]
      foot = { next: onClose, nextLabel: t('common.done') }
      break
    case 'error':
    default:
      page = [
        { kind: 'alert' },
        { kind: 'title', text: unsupported ? t('w91.add.unsupportedTitle') : t('w91.add.failTitle') },
        ...(unsupported ? [] : [{ kind: 'body', text: t('w91.add.failBody') }]),
        ...(error ? [{ kind: 'body', text: error }] : []),
        { kind: 'buttons', items: unsupported ? [{ label: t('common.close'), onClick: onClose }] : [
          { label: t('w91.add.tryAgain'), onClick: () => { session.current = null; setError(''); setStep('prep') } },
          { label: t('common.cancel'), onClick: onClose },
        ] },
      ]
      foot = {}
      break
  }
  return <Wizard91 title={title} page={page} foot={foot} onClose={onClose} />
}
