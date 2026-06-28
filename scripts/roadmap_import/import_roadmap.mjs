import fs from "fs";

// Read the previously fetched roadmap data
const data = fs.readFileSync("/Users/clive.charlton/.claude/projects/-Users-clive-charlton-Documents-Development-Pepper-Task-Manager/40923b4d-e9c6-4f2d-a794-3be2204204b4/tool-results/b99letkgs.txt", "utf8");

const startIdx = data.indexOf('"values": [');
if (startIdx === -1) {
    console.error("Could not find values array");
    process.exit(1);
}

// Very basic extraction of the values array
const jsonStr = "{" + data.substring(startIdx, data.lastIndexOf(']') + 1) + "}";
const parsed = JSON.parse(jsonStr);

// Headers are at index 2
const headers = parsed.values[2];
const rows = parsed.values.slice(4); // Start at row index 4 (Priority 1 Group Strategic)

// Create an array of tasks to create
const tasks = [];

for (const row of rows) {
    // Skip empty rows or section headers
    if (!row || row.length < 5 || !row[3] || row[3].trim() === "") continue;
    
    // Stop at "Carry over from last quarter" to keep this batch manageable and high priority
    if (row[1] === "Carry over from last quarter") break;
    
    const priorityCode = row[0];
    const okr = row[2] ? row[2].replace(/\n/g, " ").trim() : "";
    const feature = row[3] ? row[3].replace(/\n/g, " ").trim() : "";
    const problem = row[4] ? row[4].trim() : "";
    const stage = row[5] ? row[5].trim() : "";
    const teams = row[7] ? row[7].trim() : "";
    const owner = row[10] ? row[10].replace(/\n/g, " ").trim() : "";
    
    // Only import Priority 1 and 2 for now to avoid flooding
    if (priorityCode !== "1" && priorityCode !== "2") continue;
    
    let priority = "medium";
    if (priorityCode === "1") priority = "high";
    
    // Map stage to status
    let status = "todo";
    const stageLower = stage.toLowerCase();
    if (stageLower.includes("ui in progress") || stageLower.includes("development") || stageLower.includes("dev")) {
        status = "in_progress";
    } else if (stageLower.includes("ui - pending") || stageLower.includes("brs - wip") || stageLower.includes("poc")) {
        status = "backlog";
    }
    
    // Format Title
    let title = feature;
    if (okr) title = `[${okr}] ${title}`;
    
    // Format Notes
    let notes = `**Owner:** ${owner || "Unassigned"}
**Stage:** ${stage || "Unknown"}
**Teams:** ${teams || "TBC"}

**Problem / Context:**
${problem}`;

    // Extract any specific due dates from the stage field if present
    let dueDate = undefined;
    if (stageLower.includes("sept") || stageLower.includes("september")) {
        dueDate = "2026-09-30";
    } else if (stageLower.includes("june")) {
        dueDate = "2026-06-30";
    } else if (stageLower.includes("july")) {
        dueDate = "2026-07-31";
    } else if (stageLower.includes("q2")) {
        dueDate = "2026-08-31"; // End of typical Q2 financial
    }

    tasks.push({
        title,
        priority,
        status,
        notes,
        due_date: dueDate,
        labels: [
            "10.Strategy-Roadmap/80.StoreFront/27Q2",
            "20.Subsidiary-Directives/20.1.Takealot"
        ]
    });
}

console.log(JSON.stringify(tasks, null, 2));
