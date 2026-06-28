import Database from "better-sqlite3";
const db = new Database("/Users/clive.charlton/Library/Application Support/pepper-task-manager/tasks.db");

try {
    // Delete the label that has a null ID
    db.prepare("DELETE FROM labels WHERE id IS NULL").run();
    console.log("Deleted labels with null IDs.");
    
    // Let's verify we only have one +Roadmap now and it has a valid ID
    const rm = db.prepare("SELECT * FROM labels WHERE name = '+Roadmap'").all();
    console.log("+Roadmap records left:", rm);
    
} catch (e) {
    console.error(e);
}
