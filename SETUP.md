# Fortune House POS — Raspberry Pi Setup

Plain-English guide to get the thermal printer working. The tablet app sends
orders to your website (Netlify); the Raspberry Pi checks that website every
couple of seconds and prints any new orders.

```
 Tablet app  ──►  Netlify website (job queue)  ──►  Raspberry Pi  ──►  USB printer
```

---

## 1. What you need

| Item | Notes |
|------|-------|
| Raspberry Pi Zero 2 W | Any Pi with USB works; these steps assume the Zero 2 W |
| microSD card (8 GB+) | Holds the Pi's operating system |
| **microSD card reader for your Mac** | Most Macs have no SD slot — get a microSD→USB reader (USB‑C if your Mac only has USB‑C ports) |
| Micro‑USB power supply | A normal phone charger + micro‑USB cable powers the Pi |
| USB thermal printer | ESC/POS compatible (EPSON TM‑T20, Star TSP100, XPrinter, etc.) |
| **Micro‑USB → USB‑A "OTG" adapter** | Plugs into the Pi's data port so the printer can connect |

### About your Mac and the micro‑USB cable
- You **do not** connect the Pi to your Mac to set it up. Setup is done by writing
  the microSD card on your Mac, then the Pi runs on its own over Wi‑Fi.
- The micro‑USB cable is only for **power** (plug it into any USB charger).
- The Pi Zero has **two** micro‑USB ports: the one marked **PWR** is power, the
  inner one marked **USB** is for the printer (via the OTG adapter).

---

## 2. Write the OS to the microSD card (on your Mac)

1. Download **Raspberry Pi Imager**: https://www.raspberrypi.com/software/
2. Put the microSD card into your reader and plug it into the Mac.
3. Open Imager:
   - **Choose Device:** Raspberry Pi Zero 2 W
   - **Choose OS:** Raspberry Pi OS Lite (64‑bit) — no desktop needed
   - **Choose Storage:** your microSD card
4. Click **Next → Edit Settings** (the gear) and set:
   - **Hostname:** `fortune-pi`
   - **Enable SSH** ✓ (use password authentication)
   - **Username / password:** e.g. `pi` / *(a password you'll remember)*
   - **Configure Wi‑Fi:** your network name + password (and country `GB`)
5. **Save**, then **Write**. Wait for it to finish, then eject the card.
6. Put the card into the Pi, connect the printer (via the OTG adapter), and plug
   in power. Wait ~60 seconds for it to boot.

---

## 3. Connect to the Pi from your Mac

Open the **Terminal** app on your Mac and run:

```bash
ssh pi@fortune-pi.local
```

Type `yes` if asked, then your password. You're now controlling the Pi.

> If `fortune-pi.local` isn't found, find the Pi's IP in your router's device
> list and use `ssh pi@192.168.x.x` instead.

---

## 4. Install Node.js (on the Pi)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
node --version    # should print v20.x.x
```

---

## 5. Get the code onto the Pi

**If the project is on GitHub:**

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git fortune-house
cd fortune-house/pi-printer
npm install
```

**If you don't use GitHub**, copy the `pi-printer` folder onto the Pi (e.g. with
`scp` from your Mac), then `cd` into it and run `npm install`.

---

## 6. Tell the Pi where your website is

Create a settings file:

```bash
nano ~/fortune-house/pi-printer/.env
```

Paste this and edit the first line:

```
API_BASE=https://YOUR-SITE.netlify.app
PRINTER_INTERFACE=/dev/usb/lp0
POLL_MS=2000
USE_GB2312=false
```

- **API_BASE** — your Netlify site address (no slash at the end). This must match
  the **Printer URL** you set in the tablet app's **Settings**.
- **USE_GB2312** — set to `true` only if Chinese prints as garbage (common on
  cheap 58 mm printers). Leave `false` for modern EPSON/Star printers.

Save with **Ctrl+O, Enter**, then exit with **Ctrl+X**.

---

## 7. Test the printer

```bash
ls /dev/usb/                 # you should see: lp0
sudo usermod -a -G lp pi     # give the pi user permission (log out/in after)
echo -e "Hello Fortune House\n\n\n" > /dev/usb/lp0
```

If paper comes out, the printer works. (No `lp0`? Check the cable/OTG adapter and
that the printer is on with paper loaded.)

Now test the bridge itself:

```bash
cd ~/fortune-house/pi-printer
node index.js
```

Place a test order in the tablet app and tap **Print Receipt** — it should print
within ~2 seconds. Press **Ctrl+C** to stop.

---

## 8. Make it start automatically on power‑up

```bash
sudo nano /etc/systemd/system/fortune-printer.service
```

Paste (replace `/home/pi` if your username isn't `pi`):

```ini
[Unit]
Description=Fortune House Thermal Printer Bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/fortune-house/pi-printer
EnvironmentFile=/home/pi/fortune-house/pi-printer/.env
ExecStart=/usr/bin/node /home/pi/fortune-house/pi-printer/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable fortune-printer
sudo systemctl start fortune-printer
sudo systemctl status fortune-printer     # should say "active (running)"
```

The Pi will now print automatically every time it powers on. To watch live logs:

```bash
sudo journalctl -u fortune-printer -f
```

---

## 9. Connect the tablet app

On the tablet, open the app → **Settings** → set **Printer URL** to the same
`https://YOUR-SITE.netlify.app` address you used in step 6. Place an order and
print.

---

## Updating later

When the code changes:

```bash
cd ~/fortune-house
git pull
cd pi-printer
npm install
sudo systemctl restart fortune-printer
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Nothing prints | `sudo systemctl status fortune-printer` — is it running? Check logs with `journalctl -u fortune-printer -f` |
| "Printer not connected" | Check the OTG adapter + USB cable; run `ls /dev/usb/` (need `lp0`) |
| "Permission denied" on `/dev/usb/lp0` | `sudo usermod -a -G lp pi` then reboot, or `sudo chmod 666 /dev/usb/lp0` |
| Chinese prints as boxes/garbage | Set `USE_GB2312=true` in `.env`, then `sudo systemctl restart fortune-printer` |
| Orders never arrive | Check `API_BASE` matches the app's Printer URL; `ping google.com` to confirm internet |
| Can't SSH to `fortune-pi.local` | Use the Pi's IP address from your router instead |
