import fs from "fs";
import { execSync } from "child_process";

const tasks = JSON.parse(fs.readFileSync("tasks_to_import.json", "utf8"));
console.log(`Ready to import ${tasks.length} tasks...`);
