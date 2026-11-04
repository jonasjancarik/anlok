import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { SubtleText, palette } from '../common/ui';

type GuideKey = 'iphone' | 'android' | 'home-assistant';

interface UnlockShortcutGuideProps {
  serverUrl: string;
  apiKey?: string | null;
}

const KEY_PLACEHOLDER = 'YOUR_API_KEY';

const GUIDES: { key: GuideKey; label: string }[] = [
  { key: 'iphone', label: 'iPhone' },
  { key: 'android', label: 'Android' },
  { key: 'home-assistant', label: 'Home Assistant' },
];

const Step = ({ index, children }: { index: number; children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', gap: 10 }}>
    <Text style={{ fontWeight: '700', color: palette.primary, width: 18 }}>{index}.</Text>
    <Text style={{ flex: 1, color: palette.text, lineHeight: 20 }}>{children}</Text>
  </View>
);

const Code = ({ children }: { children: string }) => (
  <Text
    selectable
    style={{
      fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
      fontSize: 12,
      color: palette.text,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      padding: 10,
      lineHeight: 18,
    }}
  >
    {children}
  </Text>
);

const Strong = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontWeight: '700' }}>{children}</Text>
);

export const UnlockShortcutGuide = ({ serverUrl, apiKey }: UnlockShortcutGuideProps) => {
  const [guide, setGuide] = useState<GuideKey>('iphone');
  const unlockUrl = `${serverUrl || 'https://your-anlok-server'}/doors/unlock`;
  const key = apiKey || KEY_PLACEHOLDER;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontWeight: '700', fontSize: 15, color: palette.text }}>
          Open the door with one tap
        </Text>
        <SubtleText>
          Use a key that can only open the door. If the phone or device is lost, delete the key here and
          nothing else is affected.
        </SubtleText>
      </View>

      <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {GUIDES.map((option) => {
          const selected = option.key === guide;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setGuide(option.key)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selected ? palette.primary : palette.border,
                backgroundColor: selected ? palette.primary : 'transparent',
              }}
            >
              <Text style={{ fontWeight: '600', fontSize: 14, color: selected ? '#fff' : palette.text }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {guide === 'iphone' ? (
        <View style={{ gap: 8 }}>
          <Step index={1}>
            Open the <Strong>Shortcuts</Strong> app, tap <Strong>+</Strong> and add the{' '}
            <Strong>Get Contents of URL</Strong> action.
          </Step>
          <Step index={2}>Set the URL to:</Step>
          <Code>{unlockUrl}</Code>
          <Step index={3}>
            Tap the arrow next to the URL. Change <Strong>Method</Strong> to <Strong>POST</Strong>, then add a
            header named <Strong>X-API-Key</Strong> with your key as the value:
          </Step>
          <Code>{key}</Code>
          <Step index={4}>
            Name the shortcut, for example “Open the door”. Now you can say “Hey Siri, open the door”, add it
            to your Home Screen, or put it on the Action Button or in Control Center.
          </Step>
        </View>
      ) : null}

      {guide === 'android' ? (
        <View style={{ gap: 8 }}>
          <Step index={1}>
            Install the free <Strong>HTTP Shortcuts</Strong> app from Google Play and create a new regular
            shortcut.
          </Step>
          <Step index={2}>
            Set <Strong>Method</Strong> to <Strong>POST</Strong> and the URL to:
          </Step>
          <Code>{unlockUrl}</Code>
          <Step index={3}>
            Under <Strong>Request Headers</Strong>, add <Strong>X-API-Key</Strong> with your key as the value:
          </Step>
          <Code>{key}</Code>
          <Step index={4}>
            Save it, then place it on your home screen as an icon or widget. One tap opens the door.
          </Step>
        </View>
      ) : null}

      {guide === 'home-assistant' ? (
        <View style={{ gap: 8 }}>
          <Step index={1}>
            Add the key to <Strong>secrets.yaml</Strong>:
          </Step>
          <Code>{`anlok_api_key: "${key}"`}</Code>
          <Step index={2}>
            Add this to <Strong>configuration.yaml</Strong> and restart Home Assistant:
          </Step>
          <Code>
            {`rest_command:\n  anlok_unlock:\n    url: "${unlockUrl}"\n    method: post\n    headers:\n      X-API-Key: !secret anlok_api_key`}
          </Code>
          <Step index={3}>
            Use the <Strong>rest_command.anlok_unlock</Strong> action in a script, automation or dashboard
            button. If you share that script with Google Home, Alexa or Apple Home, you can open the door
            from there too.
          </Step>
        </View>
      ) : null}
    </View>
  );
};
