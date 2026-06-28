import Database from "better-sqlite3";
const db = new Database("/Users/clive.charlton/Library/Application Support/pepper-task-manager/tasks.db");

try {
    const oldId = '10.Strategy-Roadmap/80.StoreFront';
    const newId = '10.Strategy-Roadmap/90.StoreFront';
    const oldQ2Id = '10.Strategy-Roadmap/80.StoreFront/27Q2';
    const newQ2Id = '10.Strategy-Roadmap/90.StoreFront/27Q2';
    
    // We have to:
    // 1. Update the parent label ID, name, colour, and sort_order
    // 2. Update the child label ID, parent_id, and colour
    // 3. Update the JSON array in the tasks table!
    
    // Begin transaction for safety
    db.transaction(() => {
        // Step 1: Update labels
        db.prepare("UPDATE labels SET id = ?, name = '90.StoreFront', colour = '#007AFF', sort_order = 90 WHERE id = ?").run(newId, oldId);
        
        db.prepare("UPDATE labels SET id = ?, parent_id = ?, colour = '#007AFF' WHERE id = ?").run(newQ2Id, newId, oldQ2Id);
        
        // Also fix the generic +Roadmap colour just in case
        db.prepare("UPDATE labels SET colour = '#007AFF' WHERE id = '+Roadmap'").run();
        
        // Step 2: Update all tasks that contain the old tags
        const tasks = db.prepare("SELECT id, labels FROM tasks WHERE labels LIKE '%80.StoreFront%'").all();
        console.log(`Updating ${tasks.length} tasks...`);
        
        const updateTask = db.prepare("UPDATE tasks SET labels = ? WHERE id = ?");
        
        for (const task of tasks) {
            let labelsArray = JSON.parse(task.labels);
            
            // Replace the old IDs with the new ones
            labelsArray = labelsArray.map(label => {
                if (label === oldId) return newId;
                if (label === oldQ2Id) return newQ2Id;
                return label;
            });
            
            updateTask.run(JSON.stringify(labelsArray), task.id);
        }
        
    })();
    
    console.log("Successfully migrated 80.StoreFront to 90.StoreFront and updated colors.");
    
} catch (e) {
    console.error(e);
}
