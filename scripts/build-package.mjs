import { spawn } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const distDir = resolve(projectRoot, "package");
const stylesSource = resolve(projectRoot, "src/editor/styles.css");

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`${command} exited with code ${code ?? "null"}`));
      }
    });
  });
}

async function main() {
  const tscBinary =
    process.platform === "win32"
      ? "node_modules/.bin/tsc.cmd"
      : "node_modules/.bin/tsc";

  await rm(distDir, { recursive: true, force: true });
  await run(tscBinary, ["-p", "tsconfig.package.json"]);

  await mkdir(distDir, { recursive: true });
  await cp(stylesSource, resolve(distDir, "styles.css"));
}

main().catch((error) => {
  console.error("Failed to build package assets:", error);
  process.exitCode = 1;
});
