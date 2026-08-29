import { homedir, platform } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export interface AppArgumentsEnvironment {
  AppDomainDirectory: string;
  ApplicationExecutablePath: string;
  EnvironmentLocalAppData: string;
  EnvironmentAppData: string;
  ProcessId: number;
}

export interface AppArgumentsOptions {
  AppName: string;
  Version?: string;
  Profile?: string;
  Environment?: AppArgumentsEnvironment;
}

export interface IAppConfig {
  readonly AppName: string;
  readonly Version: string;
  readonly AppDomainDirectory: string;
  readonly AppDataDirectory: string;
  readonly TempDirectory: string;
  readonly RoamingAppDataDirectory: string;
  readonly LocalAppDataDirectory: string;
  readonly EnvironmentLocalAppData: string;
  readonly EnvironmentAppData: string;
  readonly ProcessId: number;
  readonly ApplicationExecutableName: string;
  readonly ApplicationExecutablePath: string;
}

export interface IAppArguments extends IAppConfig {
  readonly Profile: string;
  readonly DataFolder: undefined;
  readonly IsWindows: boolean;
  readonly IsLinux: boolean;
  LogDirectory(): string;
  WithProfile(Profile: string): IAppArguments;
}

const pathSegmentPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function assertPathSegment(value: string, label: string): void {
  if (!pathSegmentPattern.test(value)) {
    throw new Error(
      `${label} must start with a letter or number and contain only letters, numbers, dots, dashes, or underscores.`,
    );
  }
  if (label === "Profile" && value.toLowerCase() === "profiles.json") {
    throw new Error("Profile name 'profiles.json' is reserved for the application profile index.");
  }
}

function currentExecutablePath(): string {
  return resolve(process.argv[1] ?? process.execPath);
}

function linuxDataHome(): string {
  const configured = process.env.XDG_DATA_HOME;
  return configured && isAbsolute(configured)
    ? configured
    : join(homedir(), ".local", "share");
}

export class AppArguments implements IAppArguments {
  public readonly AppName: string;
  public readonly Version: string;
  public readonly Profile: string;
  public readonly DataFolder = undefined;
  public readonly IsWindows: boolean;
  public readonly IsLinux: boolean;
  public readonly AppDomainDirectory: string;
  public readonly AppDataDirectory: string;
  public readonly TempDirectory: string;
  public readonly RoamingAppDataDirectory: string;
  public readonly LocalAppDataDirectory: string;
  public readonly EnvironmentLocalAppData: string;
  public readonly EnvironmentAppData: string;
  public readonly ProcessId: number;
  public readonly ApplicationExecutableName: string;
  public readonly ApplicationExecutablePath: string;

  readonly #environment: AppArgumentsEnvironment;

  public constructor(options: AppArgumentsOptions) {
    const Profile = options.Profile ?? "default";
    assertPathSegment(options.AppName, "AppName");
    assertPathSegment(Profile, "Profile");

    const environment = options.Environment ?? AppArguments.CurrentEnvironment();
    this.#environment = { ...environment };
    this.AppName = options.AppName;
    this.Version = options.Version ?? "0.0.0";
    this.Profile = Profile;
    this.IsWindows = platform() === "win32";
    this.IsLinux = platform() === "linux";
    this.AppDomainDirectory = environment.AppDomainDirectory;
    this.ApplicationExecutablePath = environment.ApplicationExecutablePath;
    this.ApplicationExecutableName = basename(environment.ApplicationExecutablePath);
    this.EnvironmentLocalAppData = environment.EnvironmentLocalAppData;
    this.EnvironmentAppData = environment.EnvironmentAppData;
    this.ProcessId = environment.ProcessId;
    this.LocalAppDataDirectory = join(environment.EnvironmentLocalAppData, this.AppName);
    this.RoamingAppDataDirectory = join(environment.EnvironmentAppData, this.AppName);
    this.AppDataDirectory = join(this.RoamingAppDataDirectory, this.Profile);
    this.TempDirectory = join(this.AppDataDirectory, "temp");
  }

  public static CurrentEnvironment(): AppArgumentsEnvironment {
    const executablePath = currentExecutablePath();
    const currentPlatform = platform();
    let EnvironmentLocalAppData: string;
    let EnvironmentAppData: string;

    if (currentPlatform === "win32") {
      EnvironmentLocalAppData =
        process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
      EnvironmentAppData =
        process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    } else if (currentPlatform === "darwin") {
      const applicationSupport = join(homedir(), "Library", "Application Support");
      EnvironmentLocalAppData = applicationSupport;
      EnvironmentAppData = applicationSupport;
    } else {
      const dataHome = linuxDataHome();
      EnvironmentLocalAppData = dataHome;
      EnvironmentAppData = dataHome;
    }

    return {
      AppDomainDirectory: dirname(executablePath),
      ApplicationExecutablePath: executablePath,
      EnvironmentLocalAppData,
      EnvironmentAppData,
      ProcessId: process.pid,
    };
  }

  public LogDirectory(): string {
    return join(this.AppDataDirectory, "log");
  }

  public WithProfile(Profile: string): AppArguments {
    return new AppArguments({
      AppName: this.AppName,
      Version: this.Version,
      Profile,
      Environment: this.#environment,
    });
  }
}
