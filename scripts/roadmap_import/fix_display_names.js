import Database from "better-sqlite3";
const db = new Database("/Users/clive.charlton/Library/Application Support/pepper-task-manager/tasks.db");

try {
    // I see the problem. The "name" field in the database should just be the visible display name 
    // e.g. "80.StoreFront", but I made the name "10.Strategy-Roadmap/80.StoreFront"
    // Let's check how the others are structured
    
    const sibling = db.prepare("SELECT * FROM labels WHERE name LIKE '%Warehouse%'").get();
    console.log("Good sibling:", sibling);
    
    const badLabel1 = db.prepare("SELECT * FROM labels WHERE id = '10.Strategy-Roadmap/80.StoreFront'").get();
    console.log("Bad label 1:", badLabel1);
    
    const badLabel2 = db.prepare("SELECT * FROM labels WHERE id = '10.Strategy-Roadmap/80.StoreFront/27Q2'").get();
    console.log("Bad label 2:", badLabel2);
    
    // Fix them
    db.prepare("UPDATE labels SET name = '80.StoreFront' WHERE id = '10.Strategy-Roadmap/80.StoreFront'").run();
    db.prepare("UPDATE labels SET name = '27Q2' WHERE id = '10.Strategy-Roadmap/80.StoreFront/27Q2'").run();
    
    console.log("Fixed display names.");
    
} catch (e) {
    console.error(e);
}
