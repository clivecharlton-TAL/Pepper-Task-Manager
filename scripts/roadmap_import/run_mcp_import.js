import fs from "fs";
import { spawn } from "child_process";

const tasks = JSON.parse(fs.readFileSync("tasks_to_import.json", "utf8"));
console.log(`Starting slow MCP import of ${tasks.length - 1} tasks...`);

// We are going to generate a script that uses the existing Python setup or we can just 
// use a sequence of mcp__pepper-tasks__create_task commands via claude code
