import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import {
  AppArguments,
  type AppArgumentsEnvironment,
} from "../src/index.js";

const environment: AppArgumentsEnvironment = {
  AppDomainDirectory: join("root", "app"),
  ApplicationExecutablePath: join("root", "app", "teamcity-cli.js"),
  EnvironmentLocalAppData: join("root", "local"),
  EnvironmentAppData: join("root", "roaming"),
  ProcessId: 42,
};

test("AppArguments preserves the PoeShared current-user profile path contract", () => {
  const arguments_ = new AppArguments({
    AppName: "teamcity-cli",
    Version: "1.2.3",
    Profile: "default",
    Environment: environment,
  });

  assert.equal(arguments_.AppName, "teamcity-cli");
  assert.equal(arguments_.Version, "1.2.3");
  assert.equal(arguments_.Profile, "default");
  assert.equal(arguments_.DataFolder, undefined);
  assert.equal(
    arguments_.LocalAppDataDirectory,
    join("root", "local", "teamcity-cli"),
  );
  assert.equal(
    arguments_.RoamingAppDataDirectory,
    join("root", "roaming", "teamcity-cli"),
  );
  assert.equal(
    arguments_.AppDataDirectory,
    join("root", "roaming", "teamcity-cli", "default"),
  );
  assert.equal(arguments_.TempDirectory, join(arguments_.AppDataDirectory, "temp"));
  assert.equal(arguments_.LogDirectory(), join(arguments_.AppDataDirectory, "log"));
  assert.equal(arguments_.ApplicationExecutableName, "teamcity-cli.js");
  assert.equal(arguments_.ProcessId, 42);
});

test("WithProfile isolates all profile-owned paths without changing application roots", () => {
  const defaultArguments = new AppArguments({
    AppName: "teamcity-cli",
    Profile: "default",
    Environment: environment,
  });
  const productionArguments = defaultArguments.WithProfile("production");

  assert.equal(productionArguments.Profile, "production");
  assert.equal(
    productionArguments.RoamingAppDataDirectory,
    defaultArguments.RoamingAppDataDirectory,
  );
  assert.equal(
    productionArguments.LocalAppDataDirectory,
    defaultArguments.LocalAppDataDirectory,
  );
  assert.equal(
    productionArguments.AppDataDirectory,
    join("root", "roaming", "teamcity-cli", "production"),
  );
  assert.notEqual(
    productionArguments.AppDataDirectory,
    defaultArguments.AppDataDirectory,
  );
});

test("AppArguments rejects names that could escape the application data root", () => {
  assert.throws(
    () =>
      new AppArguments({
        AppName: "teamcity-cli",
        Profile: "../production",
        Environment: environment,
      }),
    /Profile must start/,
  );
});
