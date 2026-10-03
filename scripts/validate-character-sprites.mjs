import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";

const expectedTags = ["idle", "normal_attack", "defense", "skill"];
const pngSize = (file) => {
  const data = readFileSync(file);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
};
const filesBelow = (directory, extension) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? filesBelow(path, extension) : extname(entry.name).toLowerCase() === extension ? [path] : [];
});

export function validateCharacterSprites(root = join(process.cwd(), "public", "assets", "Character sprites")) {
  const errors = [];
  const warnings = [];
  const avatars = filesBelow(join(root, "New Player Character"), ".png");
  for (const file of avatars) {
    const size = pngSize(file);
    if (size.width !== 64 || size.height !== 64) errors.push(`${relative(root, file)} must be a 64x64 player sheet.`);
  }
  const metadataFiles = filesBelow(join(root, "Fighters"), ".json");
  const combinations = new Set();
  for (const file of metadataFiles) {
    const png = file.slice(0, -5) + ".png";
    if (!existsSync(png)) { errors.push(`${relative(root, file)} has no matching PNG.`); continue; }
    const data = JSON.parse(readFileSync(file, "utf8"));
    const meta = data.meta ?? {};
    const size = pngSize(png);
    if (meta.frameWidth <= 0 || meta.frameHeight <= 0 || meta.columns <= 0 || meta.rows <= 0) errors.push(`${relative(root, file)} has invalid frame dimensions.`);
    if (size.width !== meta.frameWidth * meta.columns || size.height !== meta.frameHeight * meta.rows) errors.push(`${relative(root, png)} dimensions do not match its JSON grid.`);
    const tags = new Map((meta.frameTags ?? []).map((tag) => [tag.name, tag]));
    for (const name of expectedTags) {
      const tag = tags.get(name);
      if (!tag) errors.push(`${relative(root, file)} is missing ${name}.`);
      else if (tag.from < 0 || tag.to < tag.from || tag.to >= meta.columns * meta.rows) errors.push(`${relative(root, file)} has an out-of-range ${name} tag.`);
    }
    const defense = tags.get("defense");
    if (defense && defense.to - defense.from + 1 !== 3) errors.push(`${relative(root, file)} must expose exactly three Defense frames.`);
    const parts = relative(join(root, "Fighters"), file).split(/[\\/]/);
    const pathSpecies = parts[0]?.toLowerCase();
    const pathRarity = parts[1]?.toLowerCase();
    const pathPersonality = basename(parts[2] ?? "", ".json").toLowerCase();
    if (pathSpecies !== meta.species || pathRarity !== meta.rarity || pathPersonality !== meta.personality) warnings.push(`${relative(root, file)} uses metadata identity ${meta.species}/${meta.rarity}/${meta.personality}.`);
    combinations.add(`${meta.species}:${meta.rarity}:${meta.personality}`);
  }
  return { errors, warnings, avatarCount: avatars.length, fighterCount: metadataFiles.length, combinations };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href) {
  const result = validateCharacterSprites();
  for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
  for (const error of result.errors) console.error(`Error: ${error}`);
  if (result.errors.length) process.exitCode = 1;
  else console.log(`Validated ${result.avatarCount} player avatars and ${result.fighterCount} fighter sprite pairs.`);
}
