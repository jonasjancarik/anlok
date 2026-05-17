import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { api, apiErrorMessage, authHeaders } from '../lib/api';
import { APP_SUBTITLE } from '../lib/config';
import { PageScroll, Screen, palette, shadows } from '../components/common/ui';

const COOLDOWN_SECONDS = 10;

export const UnlockScreen = () => {
  const { token } = useAuth();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState('Ready to unlock');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [handledAutoUnlockUrl, setHandledAutoUnlockUrl] = useState<string | null>(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isWide = width >= 820;

  const cooldownLeft = useMemo(() => {
    if (!cooldownUntil) {
      return 0;
    }
    return Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  }, [cooldownUntil, now]);

  useEffect(() => {
    if (!cooldownUntil) {
      return;
    }
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const unlockDoor = useCallback(async () => {
    if (!token || loading) {
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Unlocking...');

    try {
      await api.post('/doors/unlock', null, { headers: authHeaders(token) });
      setStatus('Door unlocked successfully.');
      setCooldownUntil(Date.now() + COOLDOWN_SECONDS * 1000);
      setTimeout(() => {
        setCooldownUntil(null);
        setStatus('Ready to unlock');
      }, COOLDOWN_SECONDS * 1000);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to unlock door.'));
      setStatus('Ready to unlock');
    } finally {
      setLoading(false);
    }
  }, [loading, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const maybeAutoUnlock = (url: string | null) => {
      if (!url || url === handledAutoUnlockUrl) {
        return;
      }
      const { queryParams } = Linking.parse(url);
      if (queryParams?.['unlock-now'] === undefined) {
        return;
      }
      setHandledAutoUnlockUrl(url);
      void unlockDoor();
    };

    void Linking.getInitialURL().then((url) => {
      maybeAutoUnlock(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }: { url: string }) => {
      maybeAutoUnlock(url);
    });

    return () => subscription.remove();
  }, [handledAutoUnlockUrl, token, unlockDoor]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const unlockDisabled = !token || cooldownLeft > 0 || loading;
  const unlockLabel = loading ? 'Unlocking...' : cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : 'Unlock';
  const statusTone = error ? 'Needs attention' : cooldownLeft > 0 ? 'Cooling down' : 'Ready';

  const tools: Array<{ label: string; icon: keyof typeof Feather.glyphMap; detail: string }> = [
    { label: 'Guests', icon: 'calendar', detail: 'Schedules' },
    { label: 'PIN', icon: 'hash', detail: 'Keypad' },
    { label: 'RFID', icon: 'credit-card', detail: 'Tokens' },
    { label: 'Settings', icon: 'sliders', detail: 'Profile' },
  ];

  return (
    <Screen>
      <PageScroll>
        <View style={[screenStyles.header, isWide ? screenStyles.headerWide : null]}>
          <View>
            <Text style={screenStyles.brand}>Anlok</Text>
            <Text style={screenStyles.subtitle}>{APP_SUBTITLE}</Text>
          </View>
          <View style={screenStyles.statusPill}>
            <View style={[screenStyles.statusDot, error ? screenStyles.statusDotDanger : null]} />
            <Text style={screenStyles.statusPillText}>{statusTone}</Text>
          </View>
        </View>

        <View style={[screenStyles.dashboard, isWide ? screenStyles.dashboardWide : null]}>
          <View style={[screenStyles.unlockCard, shadows, isWide ? screenStyles.unlockCardWide : null]}>
            <View style={screenStyles.cardHeader}>
              <View>
                <Text style={screenStyles.eyebrow}>Primary access</Text>
                <Text style={screenStyles.doorTitle}>Front door</Text>
              </View>
              <View style={screenStyles.doorIcon}>
                <Feather name="home" size={20} color={palette.primary} />
              </View>
            </View>

            <View style={screenStyles.statusBlock}>
              <Text style={screenStyles.statusLabel}>{status}</Text>
              <Text style={screenStyles.statusHint}>
                {cooldownLeft > 0
                  ? 'The door relay is cooling down before another unlock request.'
                  : 'Tap once when you are near the entrance.'}
              </Text>
            </View>

            <Animated.View style={[screenStyles.unlockButtonWrap, { transform: [{ scale: scaleAnim }] }]}>
              <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={unlockDoor}
                disabled={unlockDisabled}
                style={({ pressed }) => [
                  screenStyles.unlockButton,
                  unlockDisabled ? screenStyles.unlockButtonDisabled : null,
                  pressed ? screenStyles.unlockButtonPressed : null,
                ]}
              >
                <Feather name={loading ? 'loader' : cooldownLeft > 0 ? 'clock' : 'unlock'} size={44} color="#fff" />
                <Text style={screenStyles.unlockButtonText}>{unlockLabel}</Text>
              </Pressable>
            </Animated.View>

            {error ? (
              <View style={screenStyles.errorPanel}>
                <Feather name="alert-triangle" size={16} color={palette.danger} />
                <Text style={screenStyles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={screenStyles.metricsRow}>
              <View style={screenStyles.metric}>
                <Text style={screenStyles.metricValue}>10s</Text>
                <Text style={screenStyles.metricLabel}>Cooldown</Text>
              </View>
              <View style={screenStyles.metricDivider} />
              <View style={screenStyles.metric}>
                <Text style={screenStyles.metricValue}>Magic link</Text>
                <Text style={screenStyles.metricLabel}>Session</Text>
              </View>
            </View>
          </View>

          <View style={screenStyles.sideColumn}>
            <View style={screenStyles.panel}>
              <Text style={screenStyles.panelTitle}>Access tools</Text>
              <View style={screenStyles.toolsGrid}>
                {tools.map((tool) => (
                  <Pressable
                    key={tool.label}
                    onPress={() => navigation.navigate('Settings')}
                    style={({ pressed }) => [screenStyles.toolTile, pressed ? { opacity: 0.72 } : null]}
                  >
                    <View style={screenStyles.toolIcon}>
                      <Feather name={tool.icon} size={18} color={palette.primary} />
                    </View>
                    <Text style={screenStyles.toolLabel}>{tool.label}</Text>
                    <Text style={screenStyles.toolDetail}>{tool.detail}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={screenStyles.panel}>
              <Text style={screenStyles.panelTitle}>Recent activity</Text>
              <View style={screenStyles.activityItem}>
                <View style={screenStyles.activityMarker} />
                <View style={{ flex: 1 }}>
                  <Text style={screenStyles.activityTitle}>{status}</Text>
                  <Text style={screenStyles.activityMeta}>This session</Text>
                </View>
              </View>
              <View style={screenStyles.activityItem}>
                <View style={[screenStyles.activityMarker, screenStyles.activityMarkerWarm]} />
                <View style={{ flex: 1 }}>
                  <Text style={screenStyles.activityTitle}>Guest access managed in Settings</Text>
                  <Text style={screenStyles.activityMeta}>PIN, RFID, schedules</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </PageScroll>
    </Screen>
  );
};

const screenStyles = StyleSheet.create({
  header: {
    gap: 14,
    paddingTop: 10,
  },
  headerWide: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brand: {
    color: palette.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginTop: 2,
  },
  statusPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusDot: {
    backgroundColor: palette.success,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusDotDanger: {
    backgroundColor: palette.danger,
  },
  statusPillText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  dashboard: {
    gap: 16,
  },
  dashboardWide: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  unlockCard: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 24,
    padding: 22,
  },
  unlockCardWide: {
    flex: 1.35,
    minHeight: 620,
    padding: 28,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  doorTitle: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 6,
  },
  doorIcon: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  statusBlock: {
    gap: 8,
  },
  statusLabel: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  statusHint: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 460,
  },
  unlockButtonWrap: {
    alignItems: 'center',
    marginVertical: 10,
  },
  unlockButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderColor: '#BFD7CA',
    borderRadius: 96,
    borderWidth: 10,
    height: 192,
    justifyContent: 'center',
    width: 192,
  },
  unlockButtonPressed: {
    backgroundColor: palette.primaryActive,
  },
  unlockButtonDisabled: {
    backgroundColor: palette.subtle,
    borderColor: '#D6CEC2',
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
  },
  errorPanel: {
    alignItems: 'center',
    backgroundColor: '#F8E8E4',
    borderColor: '#E5B7AF',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  errorText: {
    color: palette.danger,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  metricsRow: {
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
  },
  metric: {
    flex: 1,
    gap: 4,
    padding: 14,
  },
  metricDivider: {
    backgroundColor: palette.border,
    width: 1,
  },
  metricValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sideColumn: {
    flex: 1,
    gap: 16,
  },
  panel: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  panelTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toolTile: {
    backgroundColor: palette.field,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 7,
    minWidth: 132,
    padding: 14,
  },
  toolIcon: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  toolLabel: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  toolDetail: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  activityItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 6,
  },
  activityMarker: {
    backgroundColor: palette.success,
    borderRadius: 5,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  activityMarkerWarm: {
    backgroundColor: palette.warning,
  },
  activityTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  activityMeta: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
