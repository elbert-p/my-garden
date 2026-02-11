const fs = require('fs');

const INPUT_FILE = 'plants.json';
const OUTPUT_FILE = 'plants_dynamic.csv';

// Define your categories
const MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const SUN = ["Full", "Part", "Shade"];
const MOIST = ["Wet", "Medium", "Dry"];

const raw = fs.readFileSync(INPUT_FILE);
const plants = JSON.parse(raw);

// --- BUILD ROW 1 (Categories) & ROW 2 (Specifics) ---
// We use empty strings "" to indicate that the previous header spans across
const row1 = ["", "", "", ""]; // Latin, Common, Height, plantType (no group)
const row2 = ["Latin name", "Common name", "Height", "plantType"]; // The specific keys

// Add Extra Text Columns
const extras = ["Ecoregion", "Native Range"];
extras.forEach(e => { row1.push(""); row2.push(e); });

// Add Sunlight (Grouped)
SUN.forEach((s, i) => {
  row1.push(i === 0 ? "Sunlight" : ""); // Only first column gets the group name
  row2.push(s);
});

// Add Moisture (Grouped)
MOIST.forEach((m, i) => {
  row1.push(i === 0 ? "Moisture" : "");
  row2.push(m);
});

// Add Bloom Time (Grouped)
MONTHS.forEach((m, i) => {
  row1.push(i === 0 ? "Bloom Time" : "");
  row2.push(m);
});

// Escape for CSV
const esc = (t) => {
  const s = String(t || "");
  return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csvRows = [
  row1.map(esc).join(','),
  row2.map(esc).join(',')
];

// --- PROCESS DATA ---
Object.values(plants).forEach(p => {
  const row = [];

  // 1. Text Fields
  row.push(esc(p["Latin name"]));
  row.push(esc(p["Common name"]));
  row.push(esc(p["Height"]));
  // Handle plantType array -> string
  row.push(esc(Array.isArray(p.plantType) ? p.plantType.join(', ') : p.plantType));
  row.push(esc(p["Ecoregion"]));
  row.push(esc(p["Native Range"]));

  // 2. Sunlight
  SUN.forEach(s => row.push(p["Sunlight"]?.includes(s) ? "1" : ""));

  // 3. Moisture
  // Note: JSON might have "Med", sheet needs "Medium". 
  // Map this if your JSON still has old abbreviations, otherwise exact match:
  MOIST.forEach(m => row.push(p["Moisture"]?.includes(m) ? "1" : ""));

  // 4. Bloom
  MONTHS.forEach(m => row.push(p["Bloom time"]?.includes(m) ? "1" : ""));

  csvRows.push(row.join(','));
});

fs.writeFileSync(OUTPUT_FILE, csvRows.join('\n'));
console.log(`✅ Created ${OUTPUT_FILE}`);