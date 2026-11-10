import AVFoundation
import ExpoModulesCore

public class OutputLatencyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OutputLatency")

    Function("outputLatencyMs") { () -> Double in
      let session = AVAudioSession.sharedInstance()
      return (session.outputLatency + session.ioBufferDuration) * 1000
    }
  }
}
