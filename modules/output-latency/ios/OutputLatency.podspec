Pod::Spec.new do |s|
  s.name           = 'OutputLatency'
  s.version        = '1.0.0'
  s.summary        = 'Reports how long iOS takes to play scheduled audio'
  s.description    = 'Reads the audio session output latency and IO buffer duration so scheduled sound can start early by that much'
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
