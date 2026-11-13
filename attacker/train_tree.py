#reads the packets log and reconstructs the firewall's rules


import json
from sklearn.tree import DecisionTreeClassifier, export_text, plot_tree
import matplotlib
matplotlib.use("Agg")          
import matplotlib.pyplot as plt

LOG = "/results/probes.jsonl"

# TCP flag letters we turn into yes/no columns the tree can split on.
FLAG_LETTERS = ["S", "A", "F", "R", "P", "U"]


def load(path):
    """Turn each probe into a row of numbers (X) and a label (y)."""
    X, y = [], []
    for line in open(path):
        r = json.loads(line)
        t = r["template"]
        proto = t["proto"]
        features = [
            1 if proto == "tcp" else 0,
            1 if proto == "udp" else 0,
            1 if proto == "icmp" else 0,
            t["dport"],
            1 if t["src"] == "self" else 0,     
            t["count"],
        ]
        # one yes/no column per TCP flag
        for letter in FLAG_LETTERS:
            features.append(1 if letter in t.get("flags", "") else 0)
        X.append(features)
        # label: did anything come back?
        y.append(1 if r["reward"] == 1 else 0)
    return X, y


FEATURE_NAMES = ["is_tcp", "is_udp", "is_icmp", "dport", "src_is_self", "count"] \
    + [f"flag_{c}" for c in FLAG_LETTERS]


def main():
    X, y = load(LOG)
    print(f"loaded {len(X)} probes, {sum(y)} with a reply")

    # A shallow tree stays readable and avoids memorising noise.
    tree = DecisionTreeClassifier(max_depth=4, min_samples_leaf=3)
    tree.fit(X, y)

    # 1) Text version — the rules as if/else, printed and saved.
    rules = export_text(tree, feature_names=FEATURE_NAMES)
    print("\n=== Rules the attacker reconstructed ===\n")
    print(rules)
    with open("/results/tree_rules.txt", "w") as f:
        f.write(rules)

    # 2) Picture — saved to results/ for the report.
    plt.figure(figsize=(16, 9))
    plot_tree(tree, feature_names=FEATURE_NAMES,
              class_names=["blocked", "got_through"],
              filled=True, rounded=True, fontsize=9)
    plt.savefig("/results/tree.png", dpi=120, bbox_inches="tight")
    print("saved: /results/tree_rules.txt and /results/tree.png")


if __name__ == "__main__":
    main()