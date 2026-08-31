import { mkdir, chmod } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
async function windows(script: string): Promise<void> {
  try {
    await execute(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(
          "$ErrorActionPreference='Stop'; " + script,
          "utf16le",
        ).toString("base64"),
      ],
      { windowsHide: true, timeout: 15_000, maxBuffer: 8192 },
    );
  } catch {
    throw new Error(
      "Cannot restrict runtime storage to the current Windows user.",
    );
  }
}

/** Only call for a dedicated application-owned directory, never a user-selected parent. */
export async function privateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    await chmod(path, 0o700);
    return;
  }
  await windows(`
    $taskSid=[Security.Principal.WindowsIdentity]::GetCurrent().User;
    $taskAcl=New-Object Security.AccessControl.DirectorySecurity;
    $taskAcl.SetOwner($taskSid);
    $taskAcl.SetAccessRuleProtection($true,$false);
    $taskRule=New-Object Security.AccessControl.FileSystemAccessRule($taskSid,'FullControl','ContainerInherit,ObjectInherit','None','Allow');
    $taskAcl.AddAccessRule($taskRule);
    [IO.Directory]::SetAccessControl(${quote(path)},$taskAcl);
  `);
}

/** grpc-js owns the pipe; this only restricts the OS object's ACL before readiness. */
export async function privateEndpoint(path: string): Promise<void> {
  if (process.platform !== "win32") {
    await chmod(path, 0o600);
    return;
  }
  await windows(`
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PipePermissions {
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
 static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string s,uint v,out IntPtr sd,out uint n);
 [DllImport("advapi32.dll",SetLastError=true)]
 static extern bool GetSecurityDescriptorDacl(IntPtr sd,out bool present,out IntPtr dacl,out bool defaulted);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)]
 static extern uint SetNamedSecurityInfo(string name,int type,uint flags,IntPtr owner,IntPtr group,IntPtr dacl,IntPtr sacl);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr p);
 public static void Restrict(string path,string sid) {
  IntPtr sd;uint n;if(!ConvertStringSecurityDescriptorToSecurityDescriptor("D:P(A;;GA;;;"+sid+")",1,out sd,out n))throw new Exception("Invalid descriptor");
  try {
   bool present,def;IntPtr dacl;
   if(!GetSecurityDescriptorDacl(sd,out present,out dacl,out def))throw new Exception("Invalid DACL");
   uint result=SetNamedSecurityInfo(path,1,0x80000004,IntPtr.Zero,IntPtr.Zero,dacl,IntPtr.Zero);
   if(result!=0)throw new Exception("Pipe access protection failed: "+result);
  }finally{LocalFree(sd);}
 }
}
'@
    [PipePermissions]::Restrict(${quote(path)},[Security.Principal.WindowsIdentity]::GetCurrent().User.Value);
  `);
}
