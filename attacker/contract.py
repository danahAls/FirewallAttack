

SERVER = "192.168.20.10"   # Our target

#  how we describe one packet to send
# The learner produces templates for the packeter to make them into real packets
EXAMPLE_TEMPLATE = {
    "proto": "tcp",    # "tcp", "udp", or "icmp" but tcp as defult
    "flags": "S",      # TCP flags 
    "dport": 80,       # destination port
    "src":   "self",   
    "count": 1,        # how many packets to send
    "interval": 0.0,   # seconds between them (for rate tests)
}
# This is just so the packeter and the learner agree on the same termnology 

#   S=SYN  A=ACK  F=FIN  R=RST  P=PSH  U=URG
#   "S" = SYN (normal), "" = NULL scan, "FPU" = Xmas, "FA" = FIN+ACK
TCP_FLAG_LETTERS = set("SAFRPU")

# the outcomes we want the packeter to report
REPLY_SYNACK     = "synack"       # open port reached
REPLY_RST        = "rst"          # closed port reached (still got through)
REPLY_ICMP_REPLY = "icmp_reply"   # ping answered
REPLY_NONE       = "none"         # nothing came back
REPLIES = {REPLY_SYNACK, REPLY_RST, REPLY_ICMP_REPLY, REPLY_NONE}


def is_valid_template(t):
    """Catch malformed templates early, before we try to send them."""
    if t.get("proto") not in {"tcp", "udp", "icmp"}:
        return False
    if t["proto"] == "tcp" and not set(t.get("flags", "")) <= TCP_FLAG_LETTERS:
        return False
    if t.get("count", 1) < 1:
        return False
    return True


# the learner uses this to learn if there was a reply or not It dosen't know anything about the firewall rules
def observed_reward(reply):
    """Did anything come back?"""
    return 1 if reply != REPLY_NONE else 0


# Here is EVALUATION. We use this to know if what the firewall prevented, what was supoosed to be prevented but didn't and what was normal and allowed

PUBLIC_PORT = 80           # the only port outsiders are meant to reach (NORMAL)
SECRET_PORT = 9000         # internal-only (Not suuposed to be reached by an outsider)
TRUSTED_NET = "192.168.20.0/24"   # the subnet the firewall trust


def is_allowed(template):
    """True if the firewall is MEANT to permit this probe.
    A copy of the firewall's intent, so we can tell intended traffic
    from a bypass"""
    if template["proto"] == "tcp" and template["dport"] == PUBLIC_PORT:
        return True
    if template["proto"] == "icmp" and template["count"] <= 3:
        return True
    return False


def label(template, reply):
    """ 'bypass'  : got through but was NOT supposed to
      'allowed' : got through and was is okay 
      'blocked' : nothing came back """
    got_through = reply != REPLY_NONE
    if got_through and not is_allowed(template):
        return "bypass"
    if got_through:
        return "allowed"
    return "blocked"




#Verify logic

if __name__ == "__main__":
    # The learner's reward sees only the reply:
    assert observed_reward(REPLY_SYNACK) == 1
    assert observed_reward(REPLY_NONE) == 0

    # The experimenter's labels classify each outcome:
    assert label({"proto": "tcp", "dport": 80, "count": 1}, REPLY_SYNACK) == "allowed"
    assert label({"proto": "tcp", "dport": 9000, "count": 1}, REPLY_SYNACK) == "bypass"
    assert label({"proto": "tcp", "dport": 9000, "count": 1}, REPLY_NONE) == "blocked"
    assert label({"proto": "icmp", "count": 20}, REPLY_ICMP_REPLY) == "bypass"
    assert label({"proto": "icmp", "count": 1}, REPLY_ICMP_REPLY) == "allowed"

    # Template validation:
    assert is_valid_template({"proto": "tcp", "flags": "S", "count": 1})
    assert not is_valid_template({"proto": "tcp", "flags": "X", "count": 1})

    print("contract.py: all checks passed")