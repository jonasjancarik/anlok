const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// iOS/iPadOS 27 terminates apps that still use the app-delegate-only window
// setup (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`).
// Expo SDK 54's template has no scene support, so this plugin declares a
// single window scene in Info.plist and moves the React Native window from
// AppDelegate into a SceneDelegate.
const MARKER = '// anlok: scene lifecycle';

const WINDOW_SETUP = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n/;

const SCENE_DELEGATE = `
${MARKER}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else { return }

    // With scenes, a launch URL arrives here instead of in launchOptions.
    // React Native's Linking.getInitialURL() reads it from launchOptions.
    var launchOptions = appDelegate.launchOptions ?? [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)

    if let userActivity = connectionOptions.userActivities.first {
      self.scene(scene, continue: userActivity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }
}
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (plistConfig) => {
    plistConfig.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return plistConfig;
  });
}

function withSceneDelegate(config) {
  return withAppDelegate(config, (delegateConfig) => {
    const appDelegate = delegateConfig.modResults;
    if (appDelegate.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
    }
    if (appDelegate.contents.includes(MARKER)) {
      return delegateConfig;
    }

    let contents = appDelegate.contents;
    if (!WINDOW_SETUP.test(contents)) {
      throw new Error('withSceneLifecycle: window setup not found in AppDelegate.swift');
    }
    contents = contents.replace(WINDOW_SETUP, '\n    self.launchOptions = launchOptions\n');

    const factoryProperty = '  var reactNativeFactory: RCTReactNativeFactory?\n';
    if (!contents.includes(factoryProperty)) {
      throw new Error('withSceneLifecycle: reactNativeFactory property not found in AppDelegate.swift');
    }
    contents = contents.replace(
      factoryProperty,
      `${factoryProperty}  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n`
    );

    appDelegate.contents = `${contents.trimEnd()}\n${SCENE_DELEGATE}`;
    return delegateConfig;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneDelegate(withSceneManifest(config));
};
