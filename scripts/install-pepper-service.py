#!/usr/bin/env python3
"""
Installs "Create Pepper Task" as a macOS Service.

The Service appears in the right-click Services menu when text is selected
in any app (e.g. Superhuman). It URL-encodes the selected text and opens
pepper://task?title=<text>, which Pepper Tasks handles to open Quick Add
pre-filled with that text as the task title.

Usage:
    python3 scripts/install-pepper-service.py

After install:
    - Pepper Tasks must be running
    - Select text in any app → right-click → Services → Create Pepper Task
    - If not visible: System Settings → Keyboard → Keyboard Shortcuts →
      Services → Text → tick "Create Pepper Task"
"""

import os
import sys
import uuid
import plistlib
import subprocess
from pathlib import Path

WORKFLOW_NAME = "Create Pepper Task"
SERVICES_DIR = Path.home() / "Library" / "Services"
WORKFLOW_DIR = SERVICES_DIR / f"{WORKFLOW_NAME}.workflow"
CONTENTS_DIR = WORKFLOW_DIR / "Contents"

SHELL_SCRIPT = """\
python3 -c "
import sys, urllib.parse, subprocess
text = sys.stdin.read().strip()
if text:
    url = 'pepper://task?title=' + urllib.parse.quote(text[:300])
    subprocess.run(['open', url])
"
"""

def build_document_wflow() -> dict:
    action_uuid  = str(uuid.uuid4()).upper()
    input_uuid   = str(uuid.uuid4()).upper()
    output_uuid  = str(uuid.uuid4()).upper()

    return {
        "AMApplicationBuild":   "521.1",
        "AMApplicationVersion": "2.10",
        "AMDocumentVersion":    "2",
        "actions": [
            {
                "action": {
                    "AMAccepts": {
                        "Container": "List",
                        "Optional":  True,
                        "Types":     ["com.apple.cocoa.string"],
                    },
                    "AMActionVersion":  "2.0.3",
                    "AMApplication":    ["Automator"],
                    "AMParameterProperties": {
                        "COMMAND_STRING":          {},
                        "CheckedForUserDefaultShell": {},
                        "inputMethod":             {},
                        "shell":                   {},
                        "source":                  {},
                    },
                    "AMProvides": {
                        "Container": "List",
                        "Types":     ["com.apple.cocoa.string"],
                    },
                    "ActionBundlePath": "/System/Library/Automator/Run Shell Script.action",
                    "ActionName":       "Run Shell Script",
                    "ActionParameters": {
                        "COMMAND_STRING":             SHELL_SCRIPT,
                        "CheckedForUserDefaultShell": True,
                        "inputMethod":                0,
                        "shell":                      "/bin/bash",
                        "source":                     "",
                    },
                    "BundleIdentifier":          "com.apple.automator.runShellScript",
                    "CFBundleVersion":           "2.0.3",
                    "CanShowSelectedItemsWhenRun": False,
                    "CanShowWhenRun":             True,
                    "Category":                  ["AMCategoryUtilities"],
                    "Class Name":                "RunShellScriptAction",
                    "InputUUID":                 input_uuid,
                    "Keywords":                  ["Shell", "Script", "Command", "Run", "Unix"],
                    "OutputUUID":                output_uuid,
                    "UUID":                      action_uuid,
                    "UnlockdWithoutPrompt":      False,
                    "arguments": {
                        "0": {"default value": 0,         "name": "inputMethod",               "required": "0", "type": "0", "uuid": "0"},
                        "1": {"default value": False,      "name": "CheckedForUserDefaultShell","required": "0", "type": "0", "uuid": "1"},
                        "2": {"default value": "",         "name": "source",                    "required": "0", "type": "0", "uuid": "2"},
                        "3": {"default value": "/bin/sh",  "name": "shell",                     "required": "0", "type": "0", "uuid": "3"},
                        "4": {"default value": "",         "name": "COMMAND_STRING",            "required": "0", "type": "0", "uuid": "4"},
                    },
                    "isViewVisible": True,
                    "location":      "309.000000:253.000000",
                    "nibPath":       "/System/Library/Automator/Run Shell Script.action/Contents/Resources/English.lproj/main.nib",
                },
                "isViewVisible": True,
            }
        ],
        "connectors": {},
        "workflowMetaData": {
            "serviceApplicationBundleID": "com.apple.finder",
            "serviceApplicationPath":     "/System/Library/CoreServices/Finder.app",
            "serviceInputTypeIdentifier": "com.apple.Automator.text",
            "serviceOutputTypeIdentifier":"com.apple.Automator.nothing",
            "serviceProcessesInput":      0,
            "workflowTypeIdentifier":     "com.apple.Automator.servicesMenu",
        },
    }


def build_info_plist() -> dict:
    return {
        "NSServices": [
            {
                "NSMenuItem":  {"default": WORKFLOW_NAME},
                "NSMessage":   "runWorkflowAsService",
                "NSPortName":  WORKFLOW_NAME,
                "NSSendTypes": ["public.utf8-plain-text"],
            }
        ]
    }


def main():
    CONTENTS_DIR.mkdir(parents=True, exist_ok=True)

    with open(CONTENTS_DIR / "document.wflow", "wb") as f:
        plistlib.dump(build_document_wflow(), f)

    with open(CONTENTS_DIR / "Info.plist", "wb") as f:
        plistlib.dump(build_info_plist(), f)

    # Reload the macOS Services database
    result = subprocess.run(
        ["/System/Library/CoreServices/pbs", "-update"],
        capture_output=True
    )
    if result.returncode != 0:
        print(f"Warning: pbs -update returned {result.returncode} — you may need to log out and back in")

    print(f"✓ Installed '{WORKFLOW_NAME}' → {WORKFLOW_DIR}")
    print()
    print("Next steps:")
    print("  1. Make sure Pepper Tasks is running")
    print("  2. Select text in Superhuman (e.g. an email subject)")
    print("  3. Right-click → Services → Create Pepper Task")
    print()
    print("Not showing? System Settings → Keyboard → Keyboard Shortcuts")
    print("  → Services → Text → tick 'Create Pepper Task'")


if __name__ == "__main__":
    main()
