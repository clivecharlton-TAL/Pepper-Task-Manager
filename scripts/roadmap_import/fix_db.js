import Database from "better-sqlite3";
const db = new Database("/Users/clive.charlton/Library/Application Support/pepper-task-manager/tasks.db");

try {
    // Delete the incorrectly inserted rows from earlier
    db.prepare("DELETE FROM labels WHERE name = '10.Strategy-Roadmap/80.StoreFront'").run();
    db.prepare("DELETE FROM labels WHERE name = '10.Strategy-Roadmap/80.StoreFront/27Q2'").run();
    
    // We need to use proper UUIDs and link parent_id correctly so the tree renders
    const parentId = "10.Strategy-Roadmap"; // ID from previous output
    const storeFrontId = "10.Strategy-Roadmap/80.StoreFront"; // Just using the name as ID is standard here
    const q2Id = "10.Strategy-Roadmap/80.StoreFront/27Q2";
    
    db.prepare(`
        INSERT INTO labels (id, name, parent_id, colour, sort_order) 
        VALUES (?, ?, ?, '#8E8E93', 80)
    `).run(storeFrontId, storeFrontId, parentId);
    
    db.prepare(`
        INSERT INTO labels (id, name, parent_id, colour, sort_order) 
        VALUES (?, ?, ?, '#8E8E93', 27)
    `).run(q2Id, q2Id, storeFrontId);
    
    console.log("Fixed labels hierarchy!");
    
    // Also check what other IDs we have for roadmap just to be sure we don't have dupes
    const children = db.prepare("SELECT * FROM labels WHERE name LIKE '10.Strategy-Roadmap/%'").all();
    console.log("\nChildren:", children);

} catch (e) {
    console.error(e);
}
