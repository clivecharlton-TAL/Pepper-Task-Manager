import Database from "better-sqlite3";
const db = new Database("/Users/clive.charlton/Library/Application Support/pepper-task-manager/tasks.db");

try {
    // When we deleted the label and re-inserted it, the tasks still point to the label string "10.Strategy-Roadmap/80.StoreFront/27Q2"
    // Let's verify what the tasks actually have vs what the label ID is
    const tasks = db.prepare("SELECT id, title, labels FROM tasks WHERE labels LIKE '%StoreFront%'").all();
    console.log("Found", tasks.length, "tasks");
    
    // We changed the ID of the label! 
    // In our manual bash insert, the ID was NULL or auto-generated.
    // Let's fix ALL tasks that have the roadmap tag to ensure their JSON array exactly matches the label IDs
    
    // Check our label IDs
    const sf = db.prepare("SELECT * FROM labels WHERE name LIKE '%StoreFront%'").all();
    console.log("Labels:");
    console.log(sf);
    
} catch (e) {
    console.error(e);
}
