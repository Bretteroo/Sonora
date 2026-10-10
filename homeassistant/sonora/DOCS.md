# Sonora

Sonora is a web controller for Sonos S1 and S2 systems. This app runs it
on your Home Assistant machine and puts it in the sidebar.

## Installing

1. In Home Assistant, go to **Settings > Apps** and choose **Install App**.
2. Open the menu at the top right, choose **Repositories**, and add
   `https://github.com/Bretteroo/Sonora`.
3. Find **Sonora** in the store, install it, and start it.
4. Turn on **Show in sidebar**, or use **Open Web UI**.

Sonora finds your speakers by itself. Home Assistant has to be on the same
network as the speakers, which it already is if Home Assistant's own Sonos
integration works.

## Using it from a phone or another computer

Sonora also answers on port 50205 of your Home Assistant machine, so any
browser in the house can use it without signing in to Home Assistant:
`http://homeassistant.local:50205`, or the machine's address in place of
`homeassistant.local`.

Sonora has no login of its own. Anyone who can reach that address on your
home network can control your speakers, just as anyone there can with the
Sonos app.

## Ports

The app uses the host's network, so these ports have to be free on the
Home Assistant machine:

- **50205** for the page, inside and outside Home Assistant.
- **50206** for the speakers to report changes back to Sonora.

## Your data

Sonora keeps its sign-ins to Sonos and to music services, and any themes you
upload, in the app's data folder. Home Assistant backups include it.

## Support

Please report any issues you find with Sonora on [GitHub](https://github.com/Bretteroo/Sonora/issues).
