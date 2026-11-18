import AVFoundation
import ExpoModulesCore

public class OutputLatencyModule: Module {
  private var routeObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("OutputLatency")

    Events("onOutputChange")

    Function("outputLatencyMs") { () -> Double in
      let session = AVAudioSession.sharedInstance()
      return (session.outputLatency + session.ioBufferDuration) * 1000
    }

    Function("currentOutput") { () -> [String: String] in
      guard let port = AVAudioSession.sharedInstance().currentRoute.outputs.first else { return [:] }
      return ["id": port.uid, "name": port.portName, "type": port.portType.rawValue]
    }

    OnStartObserving("onOutputChange") {
      self.observeRoute(true)
    }

    OnStopObserving("onOutputChange") {
      self.observeRoute(false)
    }

    OnDestroy {
      self.observeRoute(false)
    }
  }

  private func observeRoute(_ enabled: Bool) {
    if let observer = routeObserver {
      NotificationCenter.default.removeObserver(observer)
      routeObserver = nil
    }
    guard enabled else { return }
    routeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.sendEvent("onOutputChange")
    }
  }
}
