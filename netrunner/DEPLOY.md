# NETRUNNER — Deployment Guide

## Voraussetzungen

- Ubuntu VPS (22.04+) mit Root-Zugang
- Domain, die auf die Server-IP zeigt (A-Record)
- Port 80 und 443 offen in der Firewall

## Quick Deploy

```bash
# 1. Projekt auf den Server kopieren
scp -r netrunner/ root@DEIN_SERVER:/tmp/netrunner

# 2. SSH auf den Server
ssh root@DEIN_SERVER

# 3. Deploy-Script ausführen
cd /tmp/netrunner/deploy
sudo bash deploy.sh DEINE_DOMAIN DEIN_PASSWORT
#  Beispiel: sudo bash deploy.sh netrunner.example.de mein-geheimes-pw

# 4. SSL-Zertifikat einrichten
sudo certbot --nginx -d DEINE_DOMAIN
```

Fertig. Öffne `https://DEINE_DOMAIN` im Browser.

## Was das Script macht

| Schritt | Aktion |
|---------|--------|
| 1 | Installiert Python 3, nginx, certbot |
| 2 | Erstellt System-User `netrunner` |
| 3 | Kopiert Backend + Frontend nach `/opt/netrunner/` |
| 4 | Erstellt Python venv, installiert Dependencies |
| 5 | Richtet systemd Service ein (auto-start, auto-restart) |
| 6 | Konfiguriert nginx (HTTP→HTTPS redirect, SPA routing, API proxy) |
| 7 | Gibt Anleitung für certbot aus |

## Dateistruktur auf dem Server

```
/opt/netrunner/
├── backend/          # Python FastAPI Backend
│   ├── main.py
│   ├── content/
│   │   └── story.json
│   └── ...
├── frontend/
│   └── dist/         # Gebautes React Frontend
│       ├── index.html
│       └── assets/
├── venv/             # Python Virtual Environment
```

## Nützliche Befehle

```bash
# Backend-Logs anzeigen (live)
journalctl -u netrunner -f

# Backend neustarten
sudo systemctl restart netrunner

# Backend-Status prüfen
sudo systemctl status netrunner

# Nginx-Config testen + neu laden
sudo nginx -t && sudo systemctl reload nginx

# Passwort ändern (in Service-Datei editieren, dann restart)
sudo systemctl edit netrunner --force
# → Environment=NETRUNNER_PASSWORD=neues-passwort
sudo systemctl restart netrunner
```

## Update-Deployment

Nach Code-Änderungen lokal:

```bash
# 1. Frontend neu bauen
cd netrunner/frontend && npm run build

# 2. Dateien auf Server kopieren
scp -r netrunner/backend/ root@SERVER:/opt/netrunner/backend/
scp -r netrunner/frontend/dist/ root@SERVER:/opt/netrunner/frontend/dist/

# 3. Backend neustarten (Frontend braucht keinen Restart)
ssh root@SERVER "chown -R netrunner:netrunner /opt/netrunner && systemctl restart netrunner"
```

## Fehlerbehebung

**Backend startet nicht:**
```bash
journalctl -u netrunner --no-pager -n 50
```

**502 Bad Gateway:**
Backend läuft nicht. Prüfe `systemctl status netrunner`.

**CORS-Fehler im Browser:**
Backend hat `allow_origins=["*"]` — sollte kein Problem sein. Prüfe ob die API unter `/api/` erreichbar ist.

**SSL-Zertifikat erneuern:**
Certbot richtet automatisch einen Cronjob ein. Manuell: `sudo certbot renew`.
