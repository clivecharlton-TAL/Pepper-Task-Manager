import fs from "fs";
import { execSync } from "child_process";

// We'll use SQLite directly since the user said they couldn't see them
// which implies the app might need a restart OR the label strings are somehow mismatched
