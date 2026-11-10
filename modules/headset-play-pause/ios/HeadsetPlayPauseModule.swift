import ExpoModulesCore
import MediaPlayer

public class HeadsetPlayPauseModule: Module {
  private var target: Any?

  public func definition() -> ModuleDefinition {
    Name("HeadsetPlayPause")

    Events("onTogglePlayPause")

    Function("setEnabled") { (enabled: Bool) in
      DispatchQueue.main.async {
        self.listen(enabled)
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.listen(false)
      }
    }
  }

  private func listen(_ enabled: Bool) {
    let command = MPRemoteCommandCenter.shared().togglePlayPauseCommand
    if let target = target {
      command.removeTarget(target)
      self.target = nil
    }
    command.isEnabled = enabled
    guard enabled else { return }
    target = command.addTarget { [weak self] _ in
      self?.sendEvent("onTogglePlayPause")
      return .success
    }
  }
}
