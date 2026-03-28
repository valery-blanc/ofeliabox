#!/usr/bin/env python3
"""
EduBox Healthcheck Dashboard
API JSON + mini dashboard HTML
"""
import os
import subprocess
import time
from flask import Flask, jsonify, render_template

app = Flask(__name__)

SERVICES = [
    {"name": "mariadb",   "container": "edubox-mariadb",      "label": "MariaDB"},
    {"name": "moodle",    "container": "edubox-moodle",        "label": "Moodle"},
    {"name": "kolibri",   "container": "edubox-kolibri",       "label": "Kolibri"},
    {"name": "koha",      "container": "edubox-koha",          "label": "Koha"},
    {"name": "kiwix",    "container": "edubox-kiwix",         "label": "Wikipedia (Kiwix)"},
    {"name": "nginx",     "container": "edubox-nginx",         "label": "Nginx"},
    {"name": "portainer", "container": "edubox-portainer",     "label": "Portainer"},
]


def get_container_status(container_name):
    try:
        import docker
        client = docker.from_env()
        container = client.containers.get(container_name)
        return container.status  # "running", "exited", etc.
    except Exception:
        return "unknown"


def get_system_stats():
    stats = {}

    # CPU (load average)
    try:
        with open("/proc/loadavg") as f:
            load = f.read().split()
            stats["load_1m"] = float(load[0])
            stats["load_5m"] = float(load[1])
    except Exception:
        stats["load_1m"] = 0
        stats["load_5m"] = 0

    # RAM
    try:
        with open("/proc/meminfo") as f:
            lines = f.readlines()
            mem = {}
            for line in lines:
                parts = line.split()
                if parts[0] in ("MemTotal:", "MemAvailable:"):
                    mem[parts[0]] = int(parts[1])
            total = mem.get("MemTotal:", 0)
            avail = mem.get("MemAvailable:", 0)
            used = total - avail
            stats["ram_total_mb"] = total // 1024
            stats["ram_used_mb"] = used // 1024
            stats["ram_pct"] = round(used / total * 100, 1) if total else 0
    except Exception:
        stats["ram_total_mb"] = 0
        stats["ram_used_mb"] = 0
        stats["ram_pct"] = 0

    # Température Pi
    try:
        with open("/sys/class/thermal/thermal_zone0/temp") as f:
            stats["temp_c"] = round(int(f.read().strip()) / 1000, 1)
    except Exception:
        stats["temp_c"] = None

    # Disque
    try:
        result = subprocess.run(
            ["df", "-h", "/"], capture_output=True, text=True
        )
        lines = result.stdout.strip().split("\n")
        if len(lines) > 1:
            parts = lines[1].split()
            stats["disk_total"] = parts[1]
            stats["disk_used"] = parts[2]
            stats["disk_pct"] = parts[4]
    except Exception:
        stats["disk_total"] = "?"
        stats["disk_used"] = "?"
        stats["disk_pct"] = "?"

    return stats


@app.route("/api/status")
def api_status():
    services = []
    for svc in SERVICES:
        status = get_container_status(svc["container"])
        services.append({
            "name": svc["name"],
            "label": svc["label"],
            "container": svc["container"],
            "status": status,
            "ok": status == "running",
        })

    return jsonify({
        "timestamp": int(time.time()),
        "services": services,
        "system": get_system_stats(),
    })


@app.route("/")
def dashboard():
    return render_template("dashboard.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8090, debug=False)
