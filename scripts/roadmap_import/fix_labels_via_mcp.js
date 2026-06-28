import { execSync } from "child_process";

// We're going to generate bash script that does simple SQL insert into the production database
// because sql.js doesn't auto-create labels if they don't exist when we just dump them into a JSON array string in the task row
