import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const projectRoot = process.cwd();
const publicRoot = join(projectRoot, "public");
const fighterRoot = join(publicRoot, "assets", "Character sprites", "Fighters");
const output = {};

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { visit(path); continue; }
    if (!entry.name.endsWith(".json")) continue;
    const data = JSON.parse(readFileSync(path, "utf8"));
    const meta = data.meta;
    const key = `${meta.species}:${meta.rarity}:${meta.personality}`;
    output[key] = {
      src: `/${relative(publicRoot, path.slice(0, -5) + ".png").split(sep).join("/")}`,
      sheetWidth: meta.size.w,
      sheetHeight: meta.size.h,
      frameWidth: meta.frameWidth,
      frameHeight: meta.frameHeight,
      facing: meta.facing,
      accessory: meta.accessory ?? null,
      animations: Object.fromEntries(meta.animations.map((animation) => [animation.name, {
        loop: animation.loop,
        frames: data.frames.slice(animation.from, animation.to + 1).map((frame, index) => ({
          x: frame.frame.x,
          y: frame.frame.y,
          width: frame.frame.w,
          height: frame.frame.h,
          duration: animation.durations[index] ?? frame.duration,
        })),
      }])),
    };
  }
}

visit(fighterRoot);
writeFileSync(join(projectRoot, "lib", "fighter-sprite-manifest.json"), `${JSON.stringify(output)}\n`);
console.log(`Generated ${Object.keys(output).length} fighter sprite definitions.`);
