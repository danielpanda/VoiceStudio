import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { repairSourceNativeLibraries } from "../electron/scripts/native-compat.mjs";
import { selectTorchVariant, torchSyncArgs } from "../electron/scripts/torch-variant.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function setupApi({
  env = process.env,
  platform = process.platform,
  arch = process.arch,
  run = spawnSync,
  selectVariant = selectTorchVariant,
  log = console.log,
  repairNativeLibraries = repairSourceNativeLibraries,
} = {}) {
  const variant = await selectVariant({ env, platform, arch });
  // The matched torch stack has no native Windows ARM64 torchaudio wheel.
  const pythonArgs =
    platform === "win32" && arch === "arm64" ? ["--python", "cpython-3.11-windows-x86_64"] : [];
  log(
    `[setup] PyTorch: ${variant}${variant === "cpu" ? " (GPU acceleration unavailable or disabled; inference will be slower)" : ""}`,
  );
  for (const args of [
    ["sync", "--locked", ...torchSyncArgs(variant), ...pythonArgs],
    ["run", "--no-sync", "python", "scripts/setup.py"],
  ]) {
    const result = run("uv", args, { cwd: root, env, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
    if (args[0] === "sync") await repairNativeLibraries(root, platform, { env });
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.platform === "win32") {
    const appDataRoot = process.env.VOICESTUDIO_APPDATA_ROOT || "D:\\Users\\DANIELPANDA\\AppData";
    process.env.APPDATA ||= resolve(appDataRoot, "Roaming");
    process.env.LOCALAPPDATA ||= resolve(appDataRoot, "Local");
    process.env.TEMP ||= resolve(appDataRoot, "Local", "Temp");
    process.env.TMP ||= resolve(appDataRoot, "Local", "Temp");
    process.env.UV_CACHE_DIR ||= resolve(appDataRoot, "Local", "uv-cache");
    process.env.UV_PYTHON_INSTALL_DIR ||= resolve(appDataRoot, "Local", "uv-python");
    process.env.OMNIVOICE_DATA_DIR ||= resolve(appDataRoot, "Roaming", "OmniVoice");
    process.env.OMNIVOICE_CACHE_DIR ||= resolve(appDataRoot, "Local", "OmniVoice", "hf_cache");
    process.env.HF_HOME ||= process.env.OMNIVOICE_CACHE_DIR;
    process.env.HF_HUB_CACHE ||= process.env.OMNIVOICE_CACHE_DIR;
    process.env.TORCH_HOME ||= resolve(process.env.OMNIVOICE_CACHE_DIR, "torch");
    process.env.OMNIVOICE_ENV_FILE ||= resolve(appDataRoot, "Roaming", ".config", "omnivoice", "env");
  }
  setupApi()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`[setup] ${error.message}`);
      process.exitCode = 1;
    });
}
