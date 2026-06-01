# Fortune House — Raspberry Pi Printer Bridge

This script runs on a Raspberry Pi Zero 2W and polls the Netlify print queue every 2 seconds. When a job appears, it converts the order to ESC/POS commands and sends them to a USB thermal printer.

---

## Hardware Required

- Raspberry Pi Zero 2W (or any Pi with a USB port)
- USB thermal printer (ESC/POS compatible — e.g. EPSON TM-T20, Star TSP100, or any generic 58mm/80mm thermal printer)
- USB-A to micro-USB OTG adapter (for Pi Zero)
- Power supply for the Pi

---

## Step 1 — Flash the Pi OS

1. Download **Raspberry Pi Imager**: https://www.raspberrypi.com/software/
2. Insert a microSD card (8GB or larger)
3. Open Raspberry Pi Imager, choose **Raspberry Pi OS Lite (64-bit)** (no desktop needed)
4. Click the gear icon ⚙️ and configure:
   - Hostname: `fortune-pi`
   - Enable SSH ✓
   - Set username/password (e.g. `pi` / `yourpassword`)
   - Configure Wi-Fi with your network name and password
5. Write the image to the SD card
6. Insert the SD card into the Pi and power it on
7. Wait ~60 seconds, then SSH in: `ssh pi@fortune-pi.local`

---

## Step 2 — Install Node.js

```bash
# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version    # should say v20.x.x
npm --version
```

---

## Step 3 — Clone the Repository

If your project is on GitHub:

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git fortune-house
cd fortune-house/pi-printer
```

If you're copying files manually (e.g. via USB or SCP):

```bash
mkdir -p ~/fortune-house/pi-printer
# Copy index.js, package.json, start.sh into that folder
```

---

## Step 4 — Install Dependencies

```bash
cd ~/fortune-house/pi-printer
npm install
```

---

## Step 5 — Configure the Script

Create a `.env` file (or set environment variables in the systemd service):

```bash
nano ~/fortune-house/pi-printer/.env
```

Paste this, editing the values:

```
API_BASE=https://your-site.netlify.app
PRINTER_INTERFACE=/dev/usb/lp0
POLL_MS=2000
USE_GB2312=false
```

**`API_BASE`** — your Netlify site URL (from the Netlify dashboard). No trailing slash.

**`PRINTER_INTERFACE`** — the USB device file for the printer. To find it:
```bash
ls /dev/usb/
# If you see lp0, use /dev/usb/lp0
# Some printers appear as /dev/ttyUSB0
```

**`USE_GB2312`** — set to `true` if your printer's Chinese mode uses GB2312 encoding (most cheap thermal printers). Set `false` to use UTF-8 (for modern printers like EPSON TM-T88VI).

---

## Step 6 — Test the Printer

Connect the USB thermal printer. Make sure it has paper loaded.

```bash
# Check the printer is visible
ls /dev/usb/
# Should show: lp0

# Grant permission to the pi user
sudo usermod -a -G lp pi
# Log out and back in for the group to take effect

# Quick print test (sends a few lines of text)
echo -e "Test Print\n\nHello Fortune House\n\n\n" > /dev/usb/lp0
```

If paper comes out, the printer is working.

---

## Step 7 — Run the Bridge Manually (Test)

```bash
cd ~/fortune-house/pi-printer
node index.js
```

You should see:
```
===========================================
  Fortune House Printer Bridge — Starting
  API:      https://your-site.netlify.app
  Printer:  /dev/usb/lp0
  Encoding: UTF-8
  Poll:     every 2000ms
===========================================
```

Open the POS app on your tablet, place an order, and tap **Print Receipt**. Within 2 seconds the Pi should pick it up and print it.

Press `Ctrl+C` to stop.

---

## Step 8 — Run on Boot with systemd

We want the script to start automatically when the Pi powers on and restart if it crashes.

```bash
# Make start.sh executable
chmod +x ~/fortune-house/pi-printer/start.sh

# Create the systemd service
sudo nano /etc/systemd/system/fortune-printer.service
```

Paste the following (replace `/home/pi` with your actual home directory):

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
ExecStart=/home/pi/fortune-house/pi-printer/start.sh
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable fortune-printer
sudo systemctl start fortune-printer

# Check it's running
sudo systemctl status fortune-printer

# View live logs
sudo journalctl -u fortune-printer -f
```

The bridge will now start automatically every time the Pi boots.

---

## Troubleshooting

### "Printer not connected" error
- Make sure the USB cable is plugged in
- Run `ls /dev/usb/` — if `lp0` is missing, the printer isn't being detected
- Try a different USB port or cable
- Check the printer is powered on and has paper

### "Permission denied" writing to /dev/usb/lp0
```bash
sudo chmod 666 /dev/usb/lp0
# Or permanently fix with a udev rule:
echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="XXXX", MODE="0666"' | sudo tee /etc/udev/rules.d/99-printer.rules
```

### Chinese characters printing as boxes/garbage
- Set `USE_GB2312=true` in your `.env` file and restart
- Most cheap 58mm printers need GB2312 encoding

### Jobs not appearing (polling returns empty)
- Check `API_BASE` is correct and your Netlify site is deployed
- Test manually: `curl https://your-site.netlify.app/api/jobs`
- Make sure the Pi has internet access: `ping google.com`

### Pi not connecting to Wi-Fi
```bash
# Check Wi-Fi status
iwconfig wlan0
# Reconnect
sudo wpa_cli -i wlan0 reconfigure
```

---

## Updating the Script

```bash
cd ~/fortune-house
git pull
cd pi-printer
npm install
sudo systemctl restart fortune-printer
```

---

## Printer Compatibility

Tested and working with:
- EPSON TM-T20 / TM-T88 series
- Star TSP100
- XPrinter XP-58 / XP-80
- Most generic ESC/POS USB thermal printers

For Chinese character support, the printer's code page must support GB2312/GBK (common on Asian-market printers) or have Unicode/UTF-8 mode enabled.
