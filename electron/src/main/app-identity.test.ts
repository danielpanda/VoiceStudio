import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  configureWindowsAppData,
  createMacApplicationMenuTemplate,
  installAppIdentity,
  installMacApplicationMenu,
} from './app-identity';

describe('installAppIdentity', () => {
  it('names Electron internals consistently', () => {
    const setName = vi.fn();

    installAppIdentity({ setName });

    expect(setName).toHaveBeenCalledOnce();
    expect(setName).toHaveBeenCalledWith('VoiceStudio');
  });

  it('defines the complete native macOS menu with VoiceStudio app labels', () => {
    const template = createMacApplicationMenuTemplate();

    expect(template[0]).toMatchObject({ label: 'VoiceStudio' });
    expect(template[0]?.submenu).toEqual(
      expect.arrayContaining([{ role: 'about' }, { role: 'hide' }, { role: 'quit' }]),
    );
    expect(template.slice(1)).toEqual([
      { role: 'fileMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]);
  });

  it('installs the identity before Electron begins ready initialization', () => {
    const entrypoint = readFileSync(resolve(process.cwd(), 'src/main/index.ts'), 'utf8');
    const identityInstall = entrypoint.indexOf('installAppIdentity(app);');
    const readyInitialization = entrypoint.indexOf('.whenReady()');

    expect(identityInstall).toBeGreaterThanOrEqual(0);
    expect(readyInitialization).toBeGreaterThan(identityInstall);
  });

  it('brands the About panel and installs the macOS menu', () => {
    const application = {
      setAboutPanelOptions: vi.fn(),
    };
    const nativeMenu = { id: 'native-menu' };
    const menu = {
      buildFromTemplate: vi.fn(() => nativeMenu),
      setApplicationMenu: vi.fn(),
    };

    installMacApplicationMenu(application, menu, '0.5.6');

    expect(application.setAboutPanelOptions).toHaveBeenCalledWith({
      applicationName: 'VoiceStudio',
      applicationVersion: '0.5.6',
      version: '0.5.6',
    });
    expect(menu.setApplicationMenu).toHaveBeenCalledWith(nativeMenu);
  });

  it('redirects Windows Electron paths and environment variables to D:\\Users\\DANIELPANDA\\AppData', () => {
    const setPath = vi.fn();
    const env: NodeJS.ProcessEnv = {};
    const created: string[] = [];

    configureWindowsAppData(
      { setPath },
      {
        platform: 'win32',
        env,
        pathExists: () => true,
        ensureDir: (dir) => created.push(dir),
      },
    );

    expect(env.APPDATA).toBe('D:\\Users\\DANIELPANDA\\AppData\\Roaming');
    expect(env.LOCALAPPDATA).toBe('D:\\Users\\DANIELPANDA\\AppData\\Local');
    expect(env.TEMP).toBe('D:\\Users\\DANIELPANDA\\AppData\\Local\\Temp');
    expect(env.TMP).toBe('D:\\Users\\DANIELPANDA\\AppData\\Local\\Temp');
    expect(env.OMNIVOICE_ENV_FILE).toBe(
      'D:\\Users\\DANIELPANDA\\AppData\\Roaming\\.config\\omnivoice\\env',
    );
    expect(setPath).toHaveBeenCalledWith('appData', 'D:\\Users\\DANIELPANDA\\AppData\\Roaming');
    expect(setPath).toHaveBeenCalledWith(
      'userData',
      'D:\\Users\\DANIELPANDA\\AppData\\Roaming\\VoiceStudio',
    );
    expect(setPath).toHaveBeenCalledWith(
      'cache',
      'D:\\Users\\DANIELPANDA\\AppData\\Local\\VoiceStudio\\Cache',
    );
    expect(setPath).toHaveBeenCalledWith(
      'logs',
      'D:\\Users\\DANIELPANDA\\AppData\\Local\\VoiceStudio\\Logs',
    );
    expect(setPath).toHaveBeenCalledWith(
      'temp',
      'D:\\Users\\DANIELPANDA\\AppData\\Local\\Temp',
    );
    expect(created).toContain('D:\\Users\\DANIELPANDA\\AppData\\Local\\OmniVoice\\hf_cache');
  });
});
