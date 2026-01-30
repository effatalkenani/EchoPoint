const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "data", "cleaned", "cardiff_listed_buildings.geojson");
const outputPath = path.join(__dirname, "data", "cleaned", "cardiff_castle.geojson");

const rawData = JSON.parse(fs.readFileSync(inputPath, "utf8"));

// فلترة: القلعة فقط
const castleFeatures = rawData.features.filter(f => {
  const name = f.properties?.Name || "";
  return name.toLowerCase().includes("cardiff castle");
});

const castleGeoJSON = {
  type: "FeatureCollection",
  crs: rawData.crs,
  features: castleFeatures
};

fs.writeFileSync(outputPath, JSON.stringify(castleGeoJSON, null, 2));

console.log(`🏰 Done! Extracted ${castleFeatures.length} Cardiff Castle feature(s)`);
