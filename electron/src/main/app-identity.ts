import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AboutPanelOptionsOptions, MenuItemConstructorOptions } from 'electron';
import { PRODUCT_NAME } from '../../../config/app-config.mjs';

export const DESKTOP_APP_NAME = PRODUCT_NAME;

/** Set before Electron creates the native application menu. */
export interface AppPathConfigurable {
  setName(name: string): void;
  setPath?(name: string, path: string): void;
}

export function resolveWindowsAppDataRoot(
  env: NodeJS.ProcessEnv = process.env,
  pathExists: (path: string) => boolean = existsSync,
): string {
  const override = env.VOICESTUDIO_APPDATA_ROOT?.trim();
  if (override) return override;

  const username = env.USERNAME || env.USER || '';
  if (username) {
    const userAppData = join('D:', 'Users', username, 'AppData');
    if (pathExists(userAppData)) return userAppData;
  }
  if (pathExists('D:\\AppData')) return 'D:\\AppData';
  if (username) return join('D:', 'Users', username, 'AppData');
  return 'D:\\AppData';
}

export const DEFAULT_WINDOWS_APPDATA_ROOT = resolveWindowsAppDataRoot();

export function configureWindowsAppData(
  application: Pick<AppPathConfigurable, 'setPath'>,
  options: {
    platform?: NodeJS.Platform;
    env?: NodeJS.ProcessEnv;
    appDataRoot?: string;
    pathExists?: (path: string) => boolean;
    ensureDir?: (path: string) => void;
  } = {},
): void {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  if (platform !== 'win32' || env.VITEST) return;

  const pathExists = options.pathExists ?? existsSync;
  const root =
    env.VOICESTUDIO_APPDATA_ROOT?.trim() || options.appDataRoot || resolveWindowsAppDataRoot(env, pathExists);
  const ensureDir = options.ensureDir ?? ((dir: string) => mkdirSync(dir, { recursive: true }));

  if (!pathExists(root)) {
    try {
      ensureDir(root);
    } catch {
      return;
    }
  }

  const roaming = join(root, 'Roaming');
  const local = join(root, 'Local');
  const temp = join(local, 'Temp');
  const userData = join(roaming, DESKTOP_APP_NAME);
  const sessionData = join(local, DESKTOP_APP_NAME, 'SessionData');
  const cache = join(local, DESKTOP_APP_NAME, 'Cache');
  const logs = join(local, DESKTOP_APP_NAME, 'Logs');
  const crashDumps = join(local, DESKTOP_APP_NAME, 'Crashpad');
  const hfCache = join(local, 'OmniVoice', 'hf_cache');
  const dataDir = join(roaming, 'OmniVoice');
  const envFile = join(roaming, '.config', 'omnivoice', 'env');

  for (const dir of [
    roaming,
    local,
    temp,
    userData,
    sessionData,
    cache,
    logs,
    crashDumps,
    hfCache,
    dataDir,
  ]) {
    try {
      ensureDir(dir);
    } catch {
      // Directory creation errors will be surfaced by downstream IO checks if fatal.
    }
  }

  env.APPDATA = roaming;
  env.LOCALAPPDATA = local;
  env.TEMP = temp;
  env.TMP = temp;
  env.TMPDIR = temp;
  if (env.OMNIVOICE_DATA_DIR && /^c:[\\/]/i.test(env.OMNIVOICE_DATA_DIR)) {
    env.OMNIVOICE_DATA_DIR = dataDir;
  }
  if (env.OMNIVOICE_CACHE_DIR && /^c:[\\/]/i.test(env.OMNIVOICE_CACHE_DIR)) {
    env.OMNIVOICE_CACHE_DIR = hfCache;
  }
  if (env.HF_HOME && /^c:[\\/]/i.test(env.HF_HOME)) {
    env.HF_HOME = hfCache;
  }
  if (env.HF_HUB_CACHE && /^c:[\\/]/i.test(env.HF_HUB_CACHE)) {
    env.HF_HUB_CACHE = hfCache;
  }
  if (env.TORCH_HOME && /^c:[\\/]/i.test(env.TORCH_HOME)) {
    env.TORCH_HOME = join(hfCache, 'torch');
  }
  if (!env.OMNIVOICE_ENV_FILE || /^c:[\\/]/i.test(env.OMNIVOICE_ENV_FILE)) {
    env.OMNIVOICE_ENV_FILE = envFile;
  }

  if (typeof application.setPath === 'function') {
    application.setPath('appData', roaming);
    application.setPath('userData', userData);
    application.setPath('sessionData', sessionData);
    application.setPath('cache', cache);
    application.setPath('logs', logs);
    application.setPath('temp', temp);
    application.setPath('crashDumps', crashDumps);
  }
}

export function installAppIdentity(application: AppPathConfigurable): void {
  configureWindowsAppData(application);
  application.setName(DESKTOP_APP_NAME);
}

export function createMacApplicationMenuTemplate(): MenuItemConstructorOptions[] {
  return [
    {
      label: DESKTOP_APP_NAME,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
}

interface AboutApplication {
  setAboutPanelOptions(options: AboutPanelOptionsOptions): void;
}

interface ApplicationMenuInstaller<TMenu> {
  buildFromTemplate(template: MenuItemConstructorOptions[]): TMenu;
  setApplicationMenu(menu: TMenu): void;
}

export function installMacApplicationMenu<TMenu>(
  application: AboutApplication,
  menu: ApplicationMenuInstaller<TMenu>,
  version: string,
): void {
  application.setAboutPanelOptions({
    applicationName: DESKTOP_APP_NAME,
    applicationVersion: version,
    version,
  });
  menu.setApplicationMenu(menu.buildFromTemplate(createMacApplicationMenuTemplate()));
}
