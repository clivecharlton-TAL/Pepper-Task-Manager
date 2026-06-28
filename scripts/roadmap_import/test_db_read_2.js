import Database from "better-sqlite3";
const db = new Database("/Users/clive.charlton/Library/Application Support/pepper-task-manager/tasks.db");

try {
    // Check if any task has a label in its JSON array that doesn't exist in the labels table
    const tasks = db.prepare("SELECT id, labels FROM tasks").all();
    const labelRows = db.prepare("SELECT id FROM labels").all();
    const validLabelIds = new Set(labelRows.map(l => l.id));
    
    let badLabels = new Set();
    
    for (const task of tasks) {
        const labels = JSON.parse(task.labels);
        for (const l of labels) {
            if (!validLabelIds.has(l)) {
                badLabels.add(l);
            }
        }
    }
    
    console.log("Labels referenced in tasks that don't exist in the labels table:", Array.from(badLabels));
    
} catch (e) {
    console.error(e);
}
