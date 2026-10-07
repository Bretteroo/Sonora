# Security

Let's be safe!

## On Logins

**Sonora has no login of its own. Anyone who can reach it on the network in a browser can control your speakers.**

That's a decision, not an oversight.  This is how Sonos' official apps behave (a huge convenience for the user), so Sonora does the same.

## Environments

Sonora is intended to be run on your own trusted local network.  Putting it out on the public internet is not recommended.

If you'd like to control your Sonos speakers with Sonora while away from home, please do so over a VPN.

## Other websites

No login doesn't mean any website can drive Sonora through your browser. Sonora refuses a change that another site asks your browser to make, and it answers only to its own names: addresses, `localhost`, local names like `sonora.local`, and the machine's own name. That stops a page from pointing a domain of its own at your Sonora (DNS rebinding).

If you reach Sonora by some other name, through a reverse proxy or a tunnel, add that name to `SONORA_ALLOWED_HOSTS`.

Installed themes are style and data only. A theme can't run code, and it can't load anything from elsewhere: its stylesheet may only use `data:` URLs.

## What the Network check shows

The Network check reads four status pages from each speaker (its radio, its network interfaces, its bridge and its Ethernet ports) and shows only numbers worked out from them: channel, signal, errors, response times. The pages themselves are never shown, logged or saved. Everything else it lists, like room names and speaker addresses, is already visible to anyone who can open Sonora.

## Reporting a vulnerability

Use GitHub's private reporting: open the repository's **Security** tab and choose **Report a vulnerability**, or go straight to
<https://github.com/Bretteroo/Sonora/security/advisories/new>. Your report will be hidden from public view.

I want Sonora to be a safe and trusted part of your homelab.  Thanks for reporting!
