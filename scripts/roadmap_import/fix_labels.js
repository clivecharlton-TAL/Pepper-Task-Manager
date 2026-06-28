import Database from "better-sqlite3";
const db = new Database("/Users/clive.charlton/Documents/Development/Pepper-Task-Manager/pepper.db");

try {
    const labels = db.prepare("SELECT * FROM labels ORDER BY name").all();
    console.log("All labels in DB:");
    labels.forEach(l => console.log(l.name));
    
    // Check what the actual hierarchy under 10.Strategy-Roadmap looks like
    console.log("\nStrategy Roadmap labels:");
    labels.filter(l => l.name.startsWith("10.Strategy")).forEach(l => console.log(l.name));
} catch (e) {
    console.error(e);
}
