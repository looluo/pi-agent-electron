#!/usr/bin/env python3
"""Resolve git merge-file conflict hunks in place.
Usage: pick-hunks.py <file> <spec>
Spec: comma-separated hunk decisions in order: o=ours, t=theirs, b=ours+theirs, T=theirs+ours.
Unknown hunks are left untouched (script exits 1 listing them)."""
import sys

path, spec = sys.argv[1], sys.argv[2]
choices = dict(enumerate((c.strip() for c in spec.split(",")), start=1))
text = open(path).read()
lines = text.split("\n")
out, i, hunk, unresolved = [], 0, 0, []
while i < len(lines):
    if lines[i].startswith("<<<<<<<"):
        hunk += 1
        ours, theirs, state = [], [], "ours"
        i += 1
        while i < len(lines) and not lines[i].startswith(">>>>>>>"):
            if lines[i].startswith("======="):
                state = "theirs"
            elif not lines[i].startswith("|||||"):
                (ours if state == "ours" else theirs).append(lines[i])
            i += 1
        i += 1
        c = choices.get(hunk)
        if c == "o":
            out += ours
        elif c == "t":
            out += theirs
        elif c == "b":
            out += ours + theirs
        elif c == "T":
            out += theirs + ours
        else:
            unresolved.append(hunk)
            out += ["<<<<<<< ours #%d" % hunk] + ours + ["======="] + theirs + [">>>>>>>"]
    else:
        out.append(lines[i])
        i += 1
open(path, "w").write("\n".join(out))
if unresolved:
    print("unresolved hunks: %s" % unresolved)
    sys.exit(1)
print("resolved %d hunks in %s" % (hunk, path))
