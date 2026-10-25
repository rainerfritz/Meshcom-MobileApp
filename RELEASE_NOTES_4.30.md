# MeshCom App 4.30 – Release Notes (English)

Changes since 4.29 (01.10.2026). Deutsche Fassung weiter unten.

## Highlights

### Auto Reconnect
- The app reconnects automatically when the Bluetooth connection to the node is lost (switch "Auto reconnect" on the Connect tab).
- A banner shows the progress ("Searching for the node...") and has a Cancel button.
- No reconnect after an expected disconnect, e.g. Deep Sleep or OTA update.
- After a cold start of the app the last node is reconnected as well, if the connection was up when the app ended.

### Auto Scan / Connect tab
- Live scanning: nodes in range show up as cards with signal bars, one tap connects.
- Node names are read directly from the Bluetooth advertisement and the MeshCom manufacturer data, so nodes are found more reliably.
- "MeshCom only" filter for the list.
- Scan diagnostics for troubleshooting.
- The config sync after the connect is watched; missing config data is requested again automatically.

### New design
- Info, Settings, Heard Nodes and Connect tab rebuilt with grouped cards and collapsible sections.
- Follows the system theme (light / dark); the light theme has tinted cards with a subtle gradient.
- Signal colours for RSSI and SNR use real LoRa thresholds. RSSI: good up to -90 dBm, ok up to -100 dBm, weak up to -115 dBm.
- Android: status bar and navigation bar icons follow the theme.

## Chat
- Favourite callsigns for Direct Messages: star next to "To Callsign", add and delete in the favourites window, "Add Favourite" in the long-press menu.
- iOS: swipe from the left edge and Android: back button inside a chat lead back to the chat list.
- The message input grows with the text reliably (iOS autocorrect no longer leaves it one line high).
- The "via" text starts directly behind the time and wraps naturally.

## Info tab
- GPS: "OFF" when GPS is switched off (satellites and HDOP are hidden then), next position as "5m 20s", date and time in two rows.
- Sensors: values the node does not deliver are hidden.
- Firmware card: "Version" and "Build".
- Faster refresh (4 s per request).
- Log window opens with the first tap.

## Heard Nodes
- New fields from the firmware: "Hears me" (HM, how the station hears the node) and "Gateway".
- Values the node does not send are hidden (RSSI, SNR, distance).

## Settings
- **Time zone**: automatic summer / winter time with presets (Europe - Vienna and more) or an own POSIX rule; fixed UTC offset as before.
- **Manual Command**: send any node command (must start with two hyphens, hint if the keyboard replaced them with a long dash).
- **Sensor Settings**: sensor buttons, Scan I2C, Sensor Info, Temperature Offset and INA226 (shunt, max. current, samples).
- **Max Hop**, **Max. Battery Voltage** (3.7 - 4.5 V), **Battery Display** (voltage or percent) and **IP MTU**.
- **Remote Netconsole** (switch and password, port 2323) and **KISS Interface** buttons (KISS, TX, RxMeta, Auth).
- **Gateway servers**: Germany Hamnet (HC), Switzerland (HB) and Poland (SP) added.
- Countries: EA added, "906" corrected to "915" (906.875 MHz).
- APRS Symbol, Comment and Name in one collapsible "APRS Settings" card; the APRS comment is only shown when set.

## Firmware
- Nodes with firmware older than 4.40 a get an update hint after the connect.
- Several settings (Max Hop, IP MTU, Battery Display, Netconsole, KISS, INA226) only appear when the node firmware reports them.

## Other
- Updated Ionic (9.0.9) and Capacitor (8.5.3).
- License file added.

---

# MeshCom App 4.30 – Release Notes (Deutsch)

Änderungen seit 4.29 (01.10.2026).

## Highlights

### Auto Reconnect
- Die App verbindet sich automatisch wieder, wenn die Bluetooth-Verbindung zum Node verloren geht (Schalter "Auto reconnect" im Connect-Tab).
- Ein Banner zeigt den Fortschritt ("Searching for the node...") und hat einen Cancel-Button.
- Kein Wiederverbinden nach einer erwarteten Trennung, zum Beispiel bei Deep Sleep oder OTA-Update.
- Nach einem Kaltstart der App wird auch der zuletzt verbundene Node wieder verbunden, wenn die Verbindung beim Beenden der App bestand.

### Auto Scan / Connect-Tab
- Live-Scan: Nodes in Reichweite erscheinen als Karten mit Signalbalken, ein Tipp verbindet.
- Die Node-Namen werden direkt aus dem Bluetooth-Advertisement und den MeshCom-Herstellerdaten gelesen, dadurch werden Nodes zuverlässiger gefunden.
- Filter "MeshCom only" für die Liste.
- Scan-Diagnose zur Fehlersuche.
- Die Config-Synchronisation nach dem Verbinden wird überwacht, fehlende Config-Daten werden automatisch neu angefordert.

### Neues Design
- Info-, Settings-, Heard-Nodes- und Connect-Tab neu aufgebaut, mit gruppierten Karten und ausklappbaren Bereichen.
- Folgt dem System-Theme (Hell / Dunkel). Das helle Theme hat getönte Karten mit dezentem Farbverlauf.
- Die Signalfarben für RSSI und SNR nutzen echte LoRa-Schwellen. RSSI: gut bis -90 dBm, ok bis -100 dBm, schwach bis -115 dBm.
- Android: Symbole der Status- und Navigationsleiste folgen dem Theme.

## Chat
- Favoriten für Direct Messages: Stern neben "To Callsign", Hinzufügen und Löschen im Favoriten-Fenster, "Add Favourite" im Long-Press-Menü.
- iOS: Wischen vom linken Rand, Android: Zurück-Taste innerhalb eines Chats führen zurück zur Chat-Übersicht.
- Das Nachrichtenfeld wächst zuverlässig mit dem Text (die iOS-Autokorrektur lässt es nicht mehr eine Zeile hoch).
- Der "via"-Text beginnt direkt hinter der Uhrzeit und bricht natürlich um.

## Info-Tab
- GPS: "OFF" wenn GPS ausgeschaltet ist (Satelliten und HDOP werden dann ausgeblendet), nächste Position als "5m 20s", Datum und Uhrzeit in zwei Zeilen.
- Sensoren: Werte, die der Node nicht liefert, werden ausgeblendet.
- Firmware-Karte: "Version" und "Build".
- Schnellere Aktualisierung (4 s pro Abfrage).
- Das Log-Fenster öffnet sich mit dem ersten Tipp.

## Heard Nodes
- Neue Felder aus der Firmware: "Hears me" (HM, wie die Station den Node hört) und "Gateway".
- Werte, die der Node nicht sendet, werden ausgeblendet (RSSI, SNR, Entfernung).

## Settings
- **Zeitzone**: automatische Sommer-/Winterzeit mit Voreinstellungen (Europe - Vienna und weitere) oder eigener POSIX-Regel; fester UTC-Offset wie bisher.
- **Manual Command**: beliebigen Node-Befehl senden (muss mit zwei Bindestrichen beginnen, Hinweis wenn die Tastatur sie durch einen langen Strich ersetzt hat).
- **Sensor Settings**: Sensor-Buttons, Scan I2C, Sensor Info, Temperature Offset und INA226 (Shunt, max. Strom, Samples).
- **Max Hop**, **Max. Battery Voltage** (3,7 - 4,5 V), **Battery Display** (Spannung oder Prozent) und **IP MTU**.
- **Remote Netconsole** (Schalter und Passwort, Port 2323) und **KISS Interface** Buttons (KISS, TX, RxMeta, Auth).
- **Gateway-Server**: Germany Hamnet (HC), Schweiz (HB) und Polen (SP) ergänzt.
- Länder: EA ergänzt, "906" auf "915" (906,875 MHz) korrigiert.
- APRS Symbol, Comment und Name in einer ausklappbaren Karte "APRS Settings". Der APRS-Kommentar wird nur angezeigt, wenn er gesetzt ist.

## Firmware
- Nodes mit Firmware älter als 4.40 a bekommen nach dem Verbinden einen Update-Hinweis.
- Einige Einstellungen (Max Hop, IP MTU, Battery Display, Netconsole, KISS, INA226) erscheinen nur, wenn die Node-Firmware sie meldet.

## Sonstiges
- Ionic (9.0.9) und Capacitor (8.5.3) aktualisiert.
- Lizenzdatei hinzugefügt.

---

# Kurzfassung 4.30

## Deutsch
- Auto Reconnect bei verlorener Bluetooth-Verbindung (auch nach App-Neustart, nicht nach Deep Sleep oder OTA)
- Neues Connect-Tab mit Live-Scan und Tippen zum Verbinden
- Neues Design für Info, Settings, Heard Nodes und Connect (Hell/Dunkel nach System)
- Favoriten für Direct Messages
- Zurück-Wisch (iOS) und Zurück-Taste (Android) im Chat führen zur Chat-Übersicht
- Zeitzone mit automatischer Sommer-/Winterzeit
- Manual Command für beliebige Node-Befehle
- Sensor Settings mit INA226, Scan I2C und Sensor Info
- Max Hop, Max. Batteriespannung, Battery Display und IP MTU
- Remote Netconsole mit Passwort und KISS Interface
- Neue Gateway-Server: Germany Hamnet (HC), Schweiz (HB), Polen (SP)
- Heard Nodes mit "Hears me" und "Gateway", ausgeblendete leere Werte
- Info-Tab: GPS-Status OFF, Next POS in Minuten und Sekunden, schnellere Aktualisierung
- Hinweis auf Firmware-Update für Nodes älter als 4.40 a

## English
- Auto reconnect when the Bluetooth connection is lost (also after an app restart, not after Deep Sleep or OTA)
- New Connect tab with live scan and tap to connect
- New design for Info, Settings, Heard Nodes and Connect (light / dark by system)
- Favourite callsigns for Direct Messages
- iOS swipe back and Android back button inside a chat lead to the chat list
- Time zone with automatic summer / winter time
- Manual Command for any node command
- Sensor Settings with INA226, Scan I2C and Sensor Info
- Max Hop, max. battery voltage, battery display and IP MTU
- Remote Netconsole with password and KISS interface
- New gateway servers: Germany Hamnet (HC), Switzerland (HB), Poland (SP)
- Heard Nodes with "Hears me" and "Gateway", empty values hidden
- Info tab: GPS status OFF, next POS in minutes and seconds, faster refresh
- Update hint for nodes with firmware older than 4.40 a
