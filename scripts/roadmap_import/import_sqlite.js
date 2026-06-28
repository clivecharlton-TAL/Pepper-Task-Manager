import fs from "fs";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

const tasks = JSON.parse(fs.readFileSync("tasks_to_import.json", "utf8"));
const db = new Database("/Users/clive.charlton/Documents/Development/Pepper-Task-Manager/pepper.db");

console.log(`Starting DB import of ${tasks.length} tasks...`);

// We've already done index 0 via MCP
let imported = 1;

try {
    const insertTask = db.prepare(`
        INSERT INTO tasks (
            id, title, notes, status, priority, due_date, 
            labels, linked_email_id, linked_email_subject,
            created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, 
            ?, ?, ?,
            ?, ?
        )
    `);

    const insertLabel = db.prepare(`
        INSERT OR IGNORE INTO labels (name) VALUES (?)
    `);

    // Ensure all labels exist
    const uniqueLabels = [...new Set(tasks.flatMap(t => t.labels))];
    for (const label of uniqueLabels) {
        insertLabel.run(label);
    }

    db.transaction(() => {
        // Skip index 0 because we just added it manually
        for (let i = 1; i < tasks.length; i++) {
            const task = tasks[i];
            const now = new Date().toISOString();
            
            insertTask.run(
                uuidv4(),
                task.title,
                task.notes,
                task.status,
                task.priority,
                task.due_date || null,
                JSON.stringify(task.labels),
                null,
                null,
                now,
                now
            );
            imported++;
        }
    })();

    console.log(`Successfully imported ${imported-1} new tasks directly into SQLite.`);
} catch (error) {
    console.error("Failed to import:", error);
} finally {
    db.close();
}
