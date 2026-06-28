import Database from "better-sqlite3";
const db = new Database("/Users/clive.charlton/Library/Application Support/pepper-task-manager/tasks.db");

try {
    const parent = db.prepare("SELECT * FROM labels WHERE name = '10.Strategy-Roadmap'").get();
    console.log("Parent:", parent);
    
    // We didn't set parent_id when we inserted manually via bash! That's why it's not nesting correctly.
    const children = db.prepare("SELECT * FROM labels WHERE name LIKE '10.Strategy-Roadmap/%'").all();
    console.log("\nChildren:", children);
} catch (e) {
    console.error(e);
}
