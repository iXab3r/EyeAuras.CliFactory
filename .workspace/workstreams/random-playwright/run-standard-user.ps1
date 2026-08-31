param([Parameter(Mandatory=$true)][string]$Executable, [Parameter(Mandatory=$true)][string]$Arguments, [Parameter(Mandatory=$true)][string]$WorkingDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
public static class StandardUserProbe {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct SI {
  public int cb; public string reserved, desktop, title; public int x,y,xsize,ysize,xchars,ychars,fill,flags; public short show, cbReserved; public IntPtr reserved2, input, output, error;
 }
 [StructLayout(LayoutKind.Sequential)] public struct PI {public IntPtr process,thread;public int pid,tid;}
 [StructLayout(LayoutKind.Sequential)] public struct SA {public IntPtr sid;public uint attributes;}
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr h);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h,uint ms);
 [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr h,out uint code);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr p,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool ConvertStringSidToSid(string sid,out IntPtr p);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string s,uint version,out IntPtr sd,out uint size);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetSecurityDescriptorDacl(IntPtr sd,out bool present,out IntPtr dacl,out bool def);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool SetTokenInformation(IntPtr token,int kind,IntPtr value,int size);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool CreateRestrictedToken(IntPtr existing,uint flags,uint disable,[In] SA[] disabled,uint deleted,IntPtr privileges,uint restricted,IntPtr sids,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool CreateProcessAsUserW(IntPtr token,string app,StringBuilder cmd,IntPtr pa,IntPtr ta,bool inherit,uint creation,IntPtr env,string dir,ref SI si,out PI pi);
 public static int Run(string executable,string arguments,string directory) {
  IntPtr token,restricted,admin;
  if(!OpenProcessToken(GetCurrentProcess(),0x8B,out token))throw new Win32Exception(Marshal.GetLastWin32Error(),"OpenProcessToken");
  try {
   if(!ConvertStringSidToSid("S-1-5-32-544",out admin))throw new Win32Exception();
   try {
    if(!CreateRestrictedToken(token,1,1,new[]{new SA{sid=admin}},0,IntPtr.Zero,0,IntPtr.Zero,out restricted))
      throw new Win32Exception(Marshal.GetLastWin32Error(),"CreateRestrictedToken");
    try {
     IntPtr sd;uint size;
     if(!ConvertStringSecurityDescriptorToSecurityDescriptor("D:(A;;GA;;;"+WindowsIdentity.GetCurrent().User.Value+")(A;;GA;;;SY)",1,out sd,out size))throw new Win32Exception();
     try {
       bool present,def;IntPtr dacl;
       if(!GetSecurityDescriptorDacl(sd,out present,out dacl,out def))throw new Win32Exception();
       IntPtr info=Marshal.AllocHGlobal(IntPtr.Size);
       try {Marshal.WriteIntPtr(info,dacl);if(!SetTokenInformation(restricted,6,info,IntPtr.Size))throw new Win32Exception(Marshal.GetLastWin32Error(),"TokenDefaultDacl");}
       finally {Marshal.FreeHGlobal(info);}
     }finally{LocalFree(sd);}
     using(var identity=new WindowsIdentity(restricted)) {
      if(new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))throw new Exception("Filtered token is still administrator.");
     }
     var si=new SI{cb=Marshal.SizeOf(typeof(SI)),desktop="winsta0\\default"};PI pi;
     if(!CreateProcessAsUserW(restricted,executable,new StringBuilder("\""+executable+"\" "+arguments),IntPtr.Zero,IntPtr.Zero,false,0x08000000,IntPtr.Zero,directory,ref si,out pi))
       throw new Win32Exception(Marshal.GetLastWin32Error(),"CreateProcessAsUser");
     try {
      if(WaitForSingleObject(pi.process,60000)!=0)throw new Exception("Probe did not finish in 60 seconds.");
      uint code;GetExitCodeProcess(pi.process,out code);return (int)code;
     }finally{CloseHandle(pi.thread);CloseHandle(pi.process);}
    }finally{CloseHandle(restricted);}
   }finally{LocalFree(admin);}
  }finally{CloseHandle(token);}
 }
}
'@
$taskResult = [StandardUserProbe]::Run($Executable,$Arguments,$WorkingDirectory)
@{administratorSidDisabled=$true;privilegesDisabled=$true;exitCode=$taskResult} | ConvertTo-Json -Compress
exit $taskResult
