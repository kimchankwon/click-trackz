Pod::Spec.new do |s|
  s.name           = 'HeadsetPlayPause'
  s.version        = '1.0.0'
  s.summary        = 'Forwards the headset play and pause press to JavaScript'
  s.description    = 'Registers the iOS toggle play and pause remote command and sends each press to JavaScript'
  s.license        = 'MIT'
  s.author         = 'kimchankwon'
  s.homepage       = 'https://github.com/kimchankwon/click-trackz'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/kimchankwon/click-trackz.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
