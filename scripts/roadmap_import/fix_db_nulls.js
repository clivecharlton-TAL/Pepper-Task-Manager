import Database from "better-sqlite3";
const db = new Database("/Users/clive.charlton/Library/Application Support/pepper-task-manager/tasks.db");

try {
    // When we did the bash INSERT INTO we didn't specify an ID for the +Roadmap label, so it might be null
    const nullIds = db.prepare("SELECT * FROM labels WHERE id IS NULL OR id = ''").all();
    console.log("Labels with null/empty IDs:", nullIds);
    
    // Check if +Roadmap actually has a valid ID
    const rm = db.prepare("SELECT * FROM labels WHERE name = '+Roadmap'").all();
    console.log("+Roadmap records:", rm);
    
} catch (e) {
    console.error(e);
}
