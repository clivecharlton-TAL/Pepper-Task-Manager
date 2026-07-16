import Foundation
import ScreenCaptureKit
import AVFoundation

// pepper-audio-capture start --output <path.wav>
//
// Captures system audio output (ScreenCaptureKit, audio-only) mixed with
// microphone input (AVAudioEngine) into a single 16kHz mono WAV file.
// Stops cleanly on SIGTERM, finalizing the WAV header on exit.

let SAMPLE_RATE: Double = 16000
let CHANNELS: AVAudioChannelCount = 1

func statusLine(_ obj: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: obj),
       let str = String(data: data, encoding: .utf8) {
        print(str)
        fflush(stdout)
    }
}

func fail(_ code: Int32, _ message: String) -> Never {
    statusLine(["status": "error", "code": code, "message": message])
    exit(code)
}

guard CommandLine.arguments.count >= 2, CommandLine.arguments[1] == "start" else {
    fail(1, "usage: pepper-audio-capture start --output <path.wav>")
}

var outputPath: String? = nil
var i = 2
while i < CommandLine.arguments.count {
    if CommandLine.arguments[i] == "--output", i + 1 < CommandLine.arguments.count {
        outputPath = CommandLine.arguments[i + 1]
        i += 2
    } else {
        i += 1
    }
}

guard let outputPath else {
    fail(1, "missing --output <path.wav>")
}

let outputURL = URL(fileURLWithPath: outputPath)

let outputFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: SAMPLE_RATE, channels: CHANNELS, interleaved: true)!

// Mixes two independently-arriving mono Int16 streams (mic, system audio)
// by accumulating each into its own ring-style queue of samples and, on a
// timer, summing whatever samples are available from both, clamping to
// Int16 range. Writing each source straight to the output file as it
// arrives (rather than summing) would just interleave/serialize the two
// streams instead of mixing them, corrupting playback and transcription.
final class MixWriter {
    var file: AVAudioFile?
    let queue = DispatchQueue(label: "pepper.audio.write")
    var micSamples: [Int16] = []
    var systemSamples: [Int16] = []
    var flushTimer: DispatchSourceTimer?

    init(file: AVAudioFile) {
        self.file = file
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now() + 0.1, repeating: 0.1)
        timer.setEventHandler { [weak self] in self?.flush() }
        timer.resume()
        self.flushTimer = timer
    }

    func appendMic(_ samples: [Int16]) {
        queue.async { self.micSamples.append(contentsOf: samples) }
    }

    func appendSystem(_ samples: [Int16]) {
        queue.async { self.systemSamples.append(contentsOf: samples) }
    }

    // Must run on `queue`.
    private func flush() {
        let count = min(micSamples.count, systemSamples.count)
        guard count > 0 else { return }

        var mixed = [Int16](repeating: 0, count: count)
        for i in 0..<count {
            let sum = Int32(micSamples[i]) + Int32(systemSamples[i])
            mixed[i] = Int16(max(Int32(Int16.min), min(Int32(Int16.max), sum)))
        }
        micSamples.removeFirst(count)
        systemSamples.removeFirst(count)

        guard let buffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: AVAudioFrameCount(count)) else { return }
        buffer.frameLength = AVAudioFrameCount(count)
        mixed.withUnsafeBufferPointer { ptr in
            buffer.int16ChannelData![0].update(from: ptr.baseAddress!, count: count)
        }
        try? file?.write(from: buffer)
    }

    // AVAudioFile only finalizes its header (correct data-chunk size) on
    // deinit — there is no explicit close(). Drop the reference on the
    // write queue so it deallocates before the process exits.
    func close() {
        queue.sync {
            flushTimer?.cancel()
            flushTimer = nil
            // Flush any tail samples from whichever source still has some,
            // treating the shorter/missing source as silence, so the last
            // fraction of a second isn't silently dropped.
            let count = max(micSamples.count, systemSamples.count)
            if count > 0 {
                while micSamples.count < count { micSamples.append(0) }
                while systemSamples.count < count { systemSamples.append(0) }
                flush()
            }
            self.file = nil
        }
    }
}

// Build MixWriter inside a function, not at top-level scope. Top-level
// `let`/`guard let` bindings in a Swift script live for the whole process,
// so if the AVAudioFile were bound there it would stay retained even
// after MixWriter.close() drops its own reference — preventing deinit
// (and the WAV header finalization that happens there) from ever running.
func makeMixWriter() -> MixWriter {
    guard let file = try? AVAudioFile(forWriting: outputURL, settings: outputFormat.settings, commonFormat: .pcmFormatInt16, interleaved: true) else {
        fail(1, "could not create output file at \(outputPath)")
    }
    return MixWriter(file: file)
}

let mixWriter = makeMixWriter()

func samples(from buffer: AVAudioPCMBuffer) -> [Int16] {
    guard let data = buffer.int16ChannelData else { return [] }
    return Array(UnsafeBufferPointer(start: data[0], count: Int(buffer.frameLength)))
}

// ── Microphone capture (AVAudioEngine) ──────────────────────────────────────

let micEngine = AVAudioEngine()
var micConverter: AVAudioConverter?

func startMic() throws {
    let input = micEngine.inputNode
    let inputFormat = input.outputFormat(forBus: 0)
    micConverter = AVAudioConverter(from: inputFormat, to: outputFormat)

    input.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { buffer, _ in
        guard let converter = micConverter else { return }
        let ratio = outputFormat.sampleRate / inputFormat.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 16
        guard let converted = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: capacity) else { return }
        var error: NSError?
        converter.convert(to: converted, error: &error) { _, outStatus in
            outStatus.pointee = .haveData
            return buffer
        }
        if error == nil {
            mixWriter.appendMic(samples(from: converted))
        }
    }

    try micEngine.start()
}

// ── System audio capture (ScreenCaptureKit) ─────────────────────────────────

final class SystemAudioCapture: NSObject, SCStreamOutput, SCStreamDelegate {
    var stream: SCStream?

    func start() async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard let display = content.displays.first else {
            throw NSError(domain: "pepper", code: 1, userInfo: [NSLocalizedDescriptionKey: "no display found"])
        }

        let filter = SCContentFilter(display: display, excludingApplications: [], exceptingWindows: [])
        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.sampleRate = Int(SAMPLE_RATE)
        config.channelCount = Int(CHANNELS)
        config.width = 2
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)

        let s = SCStream(filter: filter, configuration: config, delegate: self)
        try s.addStreamOutput(self, type: .audio, sampleHandlerQueue: DispatchQueue(label: "pepper.audio.sck"))
        try await s.startCapture()
        self.stream = s
    }

    func stop() async {
        try? await stream?.stopCapture()
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio, sampleBuffer.isValid else { return }
        guard let pcmBuffer = sampleBuffer.asPCMBuffer(format: outputFormat) else { return }
        mixWriter.appendSystem(samples(from: pcmBuffer))
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        statusLine(["status": "error", "code": 1, "message": "system audio stream stopped: \(error.localizedDescription)"])
    }
}

extension CMSampleBuffer {
    // ScreenCaptureKit delivers audio as 32-bit float PCM (confirmed via
    // CMAudioFormatDescriptionGetStreamBasicDescription: formatID 'lpcm',
    // 32 bits/channel, kAudioFormatFlagIsFloat), not Int16 — reinterpreting
    // those bytes directly as Int16 (the original approach here) silently
    // produced garbage/noise instead of an error, since the byte count
    // still lined up superficially. Read the buffer with AVAudioPCMBuffer's
    // native float format, then convert to the target Int16 format
    // properly via AVAudioConverter, same as the mic path already does.
    func asPCMBuffer(format: AVAudioFormat) -> AVAudioPCMBuffer? {
        guard let fmtDesc = CMSampleBufferGetFormatDescription(self),
              var asbd = CMAudioFormatDescriptionGetStreamBasicDescription(fmtDesc)?.pointee else { return nil }
        guard let sourceFormat = withUnsafeMutablePointer(to: &asbd, { AVAudioFormat(streamDescription: $0) }) else { return nil }

        var blockBuffer: CMBlockBuffer?
        var audioBufferList = AudioBufferList()
        let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            self,
            bufferListSizeNeededOut: nil,
            bufferListOut: &audioBufferList,
            bufferListSize: MemoryLayout<AudioBufferList>.size,
            blockBufferAllocator: nil,
            blockBufferMemoryAllocator: nil,
            flags: 0,
            blockBufferOut: &blockBuffer
        )
        guard status == noErr else { return nil }

        let frameCount = AVAudioFrameCount(CMSampleBufferGetNumSamples(self))
        guard let sourceBuffer = AVAudioPCMBuffer(pcmFormat: sourceFormat, frameCapacity: frameCount) else { return nil }
        sourceBuffer.frameLength = frameCount

        withUnsafeMutablePointer(to: &audioBufferList) { ablPtr in
            let buffers = UnsafeMutableAudioBufferListPointer(ablPtr)
            for i in 0..<buffers.count {
                if let src = buffers[i].mData, let dst = sourceBuffer.audioBufferList.pointee.mBuffers.mData {
                    memcpy(dst, src, Int(buffers[i].mDataByteSize))
                }
            }
        }

        guard let converter = AVAudioConverter(from: sourceFormat, to: format),
              let converted = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount + 16) else { return nil }
        var convError: NSError?
        converter.convert(to: converted, error: &convError) { _, outStatus in
            outStatus.pointee = .haveData
            return sourceBuffer
        }
        return convError == nil ? converted : nil
    }
}

// ── Permission preflight ─────────────────────────────────────────────────────

let micStatus = AVCaptureDevice.authorizationStatus(for: .audio)
switch micStatus {
case .denied, .restricted:
    fail(3, "microphone permission denied")
case .notDetermined:
    let sem = DispatchSemaphore(value: 0)
    AVCaptureDevice.requestAccess(for: .audio) { _ in sem.signal() }
    sem.wait()
    if AVCaptureDevice.authorizationStatus(for: .audio) != .authorized {
        fail(3, "microphone permission denied")
    }
default:
    break
}

// ── Run ──────────────────────────────────────────────────────────────────────

let systemCapture = SystemAudioCapture()
var shouldExit = false

// Use DispatchSourceSignal rather than the raw signal() handler: a plain
// C signal handler runs on an async-signal-unsafe context and must not
// touch Swift runtime state. Ignore the default disposition first so the
// process doesn't get killed outright before the dispatch source fires.
signal(SIGTERM, SIG_IGN)
signal(SIGINT, SIG_IGN)

// Scheduled on a background queue, not .main — the main thread blocks on
// semaphore.wait() below, which would starve the main dispatch queue and
// prevent a source scheduled there from ever firing its handler.
let signalQueue = DispatchQueue(label: "pepper.audio.signals")

let sigtermSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: signalQueue)
sigtermSource.setEventHandler { shouldExit = true }
sigtermSource.resume()

let sigintSource = DispatchSource.makeSignalSource(signal: SIGINT, queue: signalQueue)
sigintSource.setEventHandler { shouldExit = true }
sigintSource.resume()

let semaphore = DispatchSemaphore(value: 0)

Task {
    do {
        // SCShareableContent.excludingDesktopWindows triggers the Screen
        // Recording TCC prompt as a side effect on first use.
        try await systemCapture.start()
    } catch {
        fail(2, "screen recording permission denied or capture failed: \(error.localizedDescription)")
    }

    do {
        try startMic()
    } catch {
        fail(3, "microphone capture failed to start: \(error.localizedDescription)")
    }

    statusLine(["status": "recording", "path": outputPath])

    while !shouldExit {
        try? await Task.sleep(nanoseconds: 200_000_000)
    }

    statusLine(["status": "stopping"])
    micEngine.inputNode.removeTap(onBus: 0)
    micEngine.stop()
    await systemCapture.stop()
    statusLine(["status": "closing-file"])
    mixWriter.close()
    statusLine(["status": "closed"])

    semaphore.signal()
}

semaphore.wait()
exit(0)
