import Database from "better-sqlite3";
const db = new Database("/Users/clive.charlton/Library/Application Support/pepper-task-manager/tasks.db");

try {
    // The frontend code probably crashes trying to build the label tree because of a bad parent_id reference!
    const labels = db.prepare("SELECT * FROM labels").all();
    
    // Simulate what getLabelTree does in db.ts
    const map = new Map();
    const roots = [];
    
    // Put all in map
    for (const l of labels) map.set(l.id, { ...l, children: [] });
    
    // Link them
    let errorFound = false;
    for (const node of map.values()) {
        if (node.parent_id) {
            const parent = map.get(node.parent_id);
            if (!parent) {
                console.error(`CRASH CAUSE: Label '${node.id}' points to parent_id '${node.parent_id}' which DOES NOT EXIST in the map!`);
                errorFound = true;
            } else {
                parent.children.push(node);
            }
        } else {
            roots.push(node);
        }
    }
    
    if (!errorFound) console.log("No missing parents found.");
    
} catch (e) {
    console.error(e);
}
