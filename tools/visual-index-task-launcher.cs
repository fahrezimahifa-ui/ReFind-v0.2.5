using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

// Build as a Windows GUI executable. Start the CLI suspended so the job owns it before it can run.
internal static class VisualIndexTaskLauncher
{
    private const uint CreateSuspended = 0x00000004;
    private const uint CreateNoWindow = 0x08000000;
    private const uint UseStdHandles = 0x00000100;
    private const uint KillOnJobClose = 0x00002000;
    private const uint WaitObject = 0;
    private const uint WaitTimeout = 258;

    [StructLayout(LayoutKind.Sequential)]
    private struct SecurityAttributes
    {
        public int Length;
        public IntPtr Descriptor;
        [MarshalAs(UnmanagedType.Bool)] public bool Inherit;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfo
    {
        public int Size;
        public IntPtr Reserved, Desktop, Title;
        public uint X, Y, XSize, YSize, XChars, YChars, Fill, Flags;
        public ushort Show, ReservedLength;
        public IntPtr ReservedData, Input, Output, Error;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInfo
    {
        public IntPtr Process, Thread;
        public uint ProcessId, ThreadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimits
    {
        public long ProcessTime, JobTime;
        public uint Flags;
        public UIntPtr MinWorkingSet, MaxWorkingSet;
        public uint ProcessLimit;
        public UIntPtr Affinity;
        public uint Priority, Scheduling;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ExtendedLimits
    {
        public BasicLimits Basic;
        public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll")]
    private static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits value, int length);
    [DllImport("kernel32.dll")]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern SafeFileHandle CreateFile(string path, uint access, uint sharing,
        ref SecurityAttributes attributes, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern bool CreateProcess(string executable, StringBuilder command, IntPtr processAttributes,
        IntPtr threadAttributes, bool inherit, uint flags, IntPtr environment, string directory,
        ref StartupInfo startup, out ProcessInfo process);
    [DllImport("kernel32.dll")]
    private static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll")]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll")]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll")]
    private static extern bool TerminateProcess(IntPtr process, uint code);
    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    private static int Main()
    {
        try
        {
            string setup = AppDomain.CurrentDomain.BaseDirectory;
            string root = Path.GetFullPath(Path.Combine(setup, "..", ".."));
            string worker = Path.Combine(root, "tools", "index-visual-photos.php");
            const string php = @"C:\xampp\php\php.exe";
            if (!string.Equals(Path.GetFileName(root), "ReFind_0.2.0_Test", StringComparison.OrdinalIgnoreCase) ||
                !File.Exists(Path.Combine(root, ".refind-b02-test.json")) || !File.Exists(worker) || !File.Exists(php)) return 2;

            string capture = Path.Combine(setup, "visual-index-task-" + Guid.NewGuid().ToString("N") + ".tmp");
            try
            {
                var attributes = new SecurityAttributes { Length = Marshal.SizeOf(typeof(SecurityAttributes)), Inherit = true };
                using (var input = CreateFile("NUL", 0x80000000, 3, ref attributes, 3, 0, IntPtr.Zero))
                using (var output = CreateFile(capture, 0x40000000, 7, ref attributes, 1, 0x80, IntPtr.Zero))
                {
                    if (input.IsInvalid) return 31;
                    if (output.IsInvalid) return 32;
                    return Run(root, php, worker, input, output);
                }
            }
            finally
            {
                PublishOutput(capture, Path.Combine(setup, "visual-index-task-output.txt"));
            }
        }
        catch (Exception) { return 70; }
    }

    private static void PublishOutput(string capture, string latest)
    {
        if (!File.Exists(capture)) return;
        try
        {
            if (File.Exists(latest)) File.Replace(capture, latest, null);
            else File.Move(capture, latest);
        }
        catch (IOException) { /* Retain the completed capture if the latest log is in use. */ }
        catch (UnauthorizedAccessException) { /* Preserve the worker exit code. */ }
    }

    private static int Run(string root, string php, string worker, SafeFileHandle input, SafeFileHandle output)
    {
        var job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) return 4;
        var process = new ProcessInfo();
        try
        {
            var limits = new ExtendedLimits();
            limits.Basic.Flags = KillOnJobClose;
            if (!SetInformationJobObject(job, 9, ref limits, Marshal.SizeOf(typeof(ExtendedLimits)))) return 4;
            var startup = new StartupInfo
            {
                Size = Marshal.SizeOf(typeof(StartupInfo)),
                Flags = UseStdHandles,
                Input = input.DangerousGetHandle(),
                Output = output.DangerousGetHandle(),
                Error = output.DangerousGetHandle()
            };
            var command = new StringBuilder("\"" + php + "\" \"" + worker + "\" --drain");
            if (!CreateProcess(php, command, IntPtr.Zero, IntPtr.Zero, true, CreateSuspended | CreateNoWindow,
                IntPtr.Zero, root, ref startup, out process)) return 5;
            if (!AssignProcessToJobObject(job, process.Process) || ResumeThread(process.Thread) == uint.MaxValue) return 6;
            uint code;
            return WaitForSingleObject(process.Process, 50000) == WaitObject && GetExitCodeProcess(process.Process, out code)
                ? unchecked((int)code) : 124;
        }
        finally
        {
            if (process.Process != IntPtr.Zero)
            {
                if (WaitForSingleObject(process.Process, 0) == WaitTimeout)
                {
                    TerminateProcess(process.Process, 124);
                    WaitForSingleObject(process.Process, 2000);
                }
                CloseHandle(process.Process);
            }
            if (process.Thread != IntPtr.Zero) CloseHandle(process.Thread);
            CloseHandle(job);
        }
    }
}
