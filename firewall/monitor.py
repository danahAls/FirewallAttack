import ctypes
import json
import os
import socket
import struct
import subprocess
import threading
from collections import deque
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

NFLOG_GROUP = 10 # Group used for firewall packet logging
MAX_EVENTS = 500 # Maximum number of stored events

events = deque(maxlen=MAX_EVENTS) # Store recent firewall events
events_lock = threading.Lock() # Protect shared event data
monitor_status = "starting" # Track NFLOG receiver availability

lib = ctypes.CDLL("libnetfilter_log.so.1", use_errno=True) # Load the NFLOG library

lib.nflog_open.restype = ctypes.c_void_p
lib.nflog_close.argtypes = [ctypes.c_void_p]
lib.nflog_close.restype = ctypes.c_int

lib.nflog_bind_group.argtypes = [ctypes.c_void_p, ctypes.c_uint16]
lib.nflog_bind_group.restype = ctypes.c_void_p

lib.nflog_unbind_group.argtypes = [ctypes.c_void_p]
lib.nflog_unbind_group.restype = ctypes.c_int

lib.nflog_set_mode.argtypes = [ctypes.c_void_p, ctypes.c_uint8, ctypes.c_uint32]
lib.nflog_set_mode.restype = ctypes.c_int

lib.nflog_fd.argtypes = [ctypes.c_void_p]
lib.nflog_fd.restype = ctypes.c_int

lib.nflog_get_payload.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p)]
lib.nflog_get_payload.restype = ctypes.c_int

lib.nflog_get_prefix.argtypes = [ctypes.c_void_p]
lib.nflog_get_prefix.restype = ctypes.c_char_p

lib.nflog_handle_packet.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int]
lib.nflog_handle_packet.restype = ctypes.c_int

CALLBACK = ctypes.CFUNCTYPE(
    ctypes.c_int,
    ctypes.c_void_p,
    ctypes.c_void_p,
    ctypes.c_void_p,
    ctypes.c_void_p
)

lib.nflog_callback_register.argtypes = [ctypes.c_void_p, CALLBACK, ctypes.c_void_p]
lib.nflog_callback_register.restype = ctypes.c_int


def get_firewall_metrics(): # Read real firewall packet counters
    result = subprocess.run(
        ["iptables", "-L", "FORWARD", "-n", "-v", "-x"],
        capture_output=True,
        text=True,
        check=True,
        timeout=3
    )

    accepted = 0
    dropped = 0
    rejected = 0

    for line in result.stdout.splitlines():
        columns = line.split()

        if line.startswith("Chain FORWARD") and "policy DROP" in line:
            dropped += int(columns[4])
            continue

        if len(columns) < 3 or not columns[0].isdigit():
            continue

        packets = int(columns[0])
        action = columns[2]

        if action == "ACCEPT":
            accepted += packets
        elif action == "DROP":
            dropped += packets
        elif action == "REJECT":
            rejected += packets

    return {
        "status": "online",
        "accepted": accepted,
        "dropped": dropped,
        "rejected": rejected,
        "total": accepted + dropped + rejected
    }


def parse_packet(packet): # Extract packet details from IPv4 headers
    if len(packet) < 20 or packet[0] >> 4 != 4:
        return None

    header_length = (packet[0] & 15) * 4

    if header_length < 20 or len(packet) < header_length:
        return None

    protocol_number = packet[9]

    protocols = {
        1: "ICMP",
        6: "TCP",
        17: "UDP"
    }

    protocol = protocols.get(protocol_number, str(protocol_number))
    source_ip = socket.inet_ntoa(packet[12:16])
    destination_ip = socket.inet_ntoa(packet[16:20])
    destination_port = None

    fragment_offset = struct.unpack("!H", packet[6:8])[0] & 0x1FFF

    if fragment_offset == 0 and protocol_number in (6, 17) and len(packet) >= header_length + 4:
        destination_port = struct.unpack(
            "!H",
            packet[header_length + 2:header_length + 4]
        )[0]

    return {
        "source_ip": source_ip,
        "destination_ip": destination_ip,
        "protocol": protocol,
        "port": destination_port
    }


def record_packet(prefix, packet): # Store events received from firewall logging rules
    packet_data = parse_packet(packet)

    if packet_data is None:
        return

    decisions = {
        "FW_ACCEPT": "ACCEPT",
        "FW_DROP": "DROP",
        "FW_REJECT": "REJECT"
    }

    decision = decisions.get(prefix)

    if decision is None:
        return

    event = {
        "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source_ip": packet_data["source_ip"],
        "destination_ip": packet_data["destination_ip"],
        "protocol": packet_data["protocol"],
        "port": packet_data["port"],
        "decision": decision
    }

    with events_lock:
        events.appendleft(event)


def packet_callback(group, nfmsg, nfa, data): # Process packets received through NFLOG
    try:
        payload_pointer = ctypes.c_void_p()

        payload_length = lib.nflog_get_payload(
            nfa,
            ctypes.byref(payload_pointer)
        )

        if payload_length <= 0 or not payload_pointer.value:
            return 0

        prefix_bytes = lib.nflog_get_prefix(nfa)
        prefix = prefix_bytes.decode("utf-8", errors="replace") if prefix_bytes else ""

        packet = ctypes.string_at(payload_pointer, payload_length)

        record_packet(prefix, packet)

    except Exception as error:
        print(f"[NFLOG] Packet processing error: {error}", flush=True)

    return 0


callback_reference = CALLBACK(packet_callback) # Prevent Python from releasing the callback


def start_nflog(): # Receive logged packets from the Linux kernel
    global monitor_status

    handle = None
    group = None

    try:
        handle = lib.nflog_open()

        if not handle:
            raise RuntimeError("Unable to open NFLOG")

        group = lib.nflog_bind_group(handle, NFLOG_GROUP)

        if not group:
            raise RuntimeError("Unable to bind NFLOG group")

        if lib.nflog_set_mode(group, 2, 65535) < 0:
            raise RuntimeError("Unable to configure packet copying")

        if lib.nflog_callback_register(group, callback_reference, None) < 0:
            raise RuntimeError("Unable to register NFLOG callback")

        fd = lib.nflog_fd(handle)

        if fd < 0:
            raise RuntimeError("Invalid NFLOG socket")

        monitor_status = "online"
        print("[NFLOG] Receiver started successfully", flush=True)

        while True:
            packet = os.read(fd, 65535)

            if not packet:
                continue

            buffer = ctypes.create_string_buffer(packet)

            if lib.nflog_handle_packet(handle, buffer, len(packet)) < 0:
                print("[NFLOG] Failed to process a message", flush=True)

    except Exception as error:
        monitor_status = "offline"
        print(f"[NFLOG] Receiver error: {error}", flush=True)

    finally:
        if group:
            lib.nflog_unbind_group(group)

        if handle:
            lib.nflog_close(handle)


class MonitoringHandler(BaseHTTPRequestHandler): # Provide firewall monitoring endpoints

    def send_json(self, data, status_code=200):
        response = json.dumps(data).encode("utf-8")

        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def do_GET(self):
        if self.path == "/metrics":
            try:
                self.send_json(get_firewall_metrics())

            except (subprocess.SubprocessError, OSError, ValueError):
                self.send_json({"status": "error"}, 503)

        elif self.path == "/events":
            with events_lock:
                recent_events = list(events)

            self.send_json({
                "status": monitor_status,
                "events": recent_events,
                "total": len(recent_events)
            })

        elif self.path == "/alerts":
            with events_lock:
                alerts = [
                    event for event in events
                    if event["decision"] in ("DROP", "REJECT")
                ]

            self.send_json({
                "status": monitor_status,
                "alerts": alerts,
                "total": len(alerts)
            })

        else:
            self.send_error(404)


if __name__ == "__main__":
    threading.Thread(target=start_nflog, daemon=True).start() # Start NFLOG receiver
    print("[Firewall] Monitoring API listening on port 8080", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 8080), MonitoringHandler).serve_forever()