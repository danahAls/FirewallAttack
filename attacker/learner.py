
import json
import random
import os

import contract
import packeter
from templates import ACTIONS

RESULTS = "/results/probes.jsonl"


class Bandit:
    def __init__(self, n_actions, epsilon=0.2):
        self.epsilon = epsilon
        self.counts = [0] * n_actions      # times each arm was tried
        self.values = [0.0] * n_actions    # average reward per arm

    def choose(self):
        # Explore: a random arm. Exploit: the best-average arm so far.
        if random.random() < self.epsilon:
            return random.randrange(len(self.counts))
        best = max(self.values)
        # break ties randomly among the best arms
        return random.choice([i for i, v in enumerate(self.values) if v == best])

    def update(self, arm, reward):
        # Running average: new_avg = old_avg + (reward - old_avg) / count
        self.counts[arm] += 1
        n = self.counts[arm]
        self.values[arm] += (reward - self.values[arm]) / n


def run(steps=400, epsilon=0.2, seed=0, out=RESULTS):
    random.seed(seed)
    bandit = Bandit(len(ACTIONS), epsilon)

    # fresh log each run
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w").close()

    bypasses = 0
    first_door_step = None

    for step in range(1, steps + 1):
        arm = bandit.choose()
        template = ACTIONS[arm]

        result = packeter.probe(template, probe_id=step)
        reply = result["reply"]
        reward = contract.observed_reward(reply)   # reply-only, blind

        bandit.update(arm, reward)

        # log one line per probe
        with open(out, "a") as f:
            f.write(json.dumps({
                "step": step, "arm": arm, "template": template,
                "reply": reply, "reward": reward,
            }) + "\n")

        # progress note (for us watching; not used by the learner's logic)
        if reward == 1:
            bypasses += 1
            if (template["proto"] == "tcp" and template["dport"] == 8081
                    and template["src"] == "self" and first_door_step is None):
                first_door_step = step
                print(f"  step {step}: reached the hidden door (8081) — SYN-ACK")

    print(f"done: {steps} probes, {bypasses} replies received")
    if first_door_step:
        print(f"first hit on the open door at step {first_door_step}")
    else:
        print("did not hit the open door this run")
    return bandit


if __name__ == "__main__":
    run(steps=400, epsilon=0.2, seed=0)