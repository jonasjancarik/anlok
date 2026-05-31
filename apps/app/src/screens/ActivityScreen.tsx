import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Chip, PageScroll, Screen, SectionCard, palette, styles as uiStyles } from '../components/common/ui';
import { useAuth } from '../contexts/AuthContext';
import { api, apiErrorMessage, authHeaders } from '../lib/api';
import { toLocalDateTime } from '../lib/time';
import { AccessEvent } from '../types/entities';

const methodLabel = (event: AccessEvent) => {
  if (event.method === 'remote_unlock') {
    return 'Remote unlock';
  }
  if (event.method === 'rfid') {
    const lastFour = event.metadata?.last_four_digits;
    const suffix = typeof lastFour === 'string' ? ` ...${lastFour}` : '';
    return event.credential_label || `RFID tag${suffix}`;
  }
  if (event.method === 'pin') {
    return event.credential_label || 'PIN';
  }
  return 'Unknown credential';
};

const reasonLabel = (reason?: string) => reason?.replace(/_/g, ' ') ?? 'No reason recorded';

const eventIcon = (method: AccessEvent['method']) => {
  if (method === 'remote_unlock') {
    return 'smartphone';
  }
  if (method === 'rfid') {
    return 'credit-card';
  }
  if (method === 'pin') {
    return 'hash';
  }
  return 'help-circle';
};

export const ActivityScreen = () => {
  const { token } = useAuth();
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchEvents = useCallback(async (isRefresh = false) => {
    if (!token) {
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await api.get<AccessEvent[]>('/access-events', {
        headers: authHeaders(token),
        params: { limit: 75 },
      });
      setEvents(response.data);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to load activity.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  if (!token) {
    return null;
  }

  return (
    <Screen>
      <PageScroll>
        <SectionCard>
          <View style={screenStyles.header}>
            <View style={screenStyles.headerCopy}>
              <Text style={screenStyles.eyebrow}>Door</Text>
              <Text style={screenStyles.title}>Activity</Text>
            </View>
            <Button
              title="Refresh"
              variant="secondary"
              size="small"
              loading={refreshing}
              icon={<Feather name="refresh-cw" size={15} color={palette.text} />}
              onPress={() => void fetchEvents(true)}
            />
          </View>
          <Text style={uiStyles.subtleText}>Recent PIN, RFID, and remote unlock events.</Text>
        </SectionCard>

        {error ? <Banner type="error" text={error} /> : null}

        {loading ? (
          <View style={screenStyles.loadingPanel}>
            <ActivityIndicator color={palette.primary} />
            <Text style={screenStyles.loadingText}>Loading activity...</Text>
          </View>
        ) : events.length === 0 ? (
          <SectionCard>
            <View style={screenStyles.emptyState}>
              <Feather name="clock" size={26} color={palette.muted} />
              <Text style={screenStyles.emptyTitle}>No activity yet</Text>
            </View>
          </SectionCard>
        ) : (
          <View style={screenStyles.list}>
            {events.map((event) => {
              const granted = event.outcome === 'granted';
              return (
                <View key={event.id} style={screenStyles.eventRow}>
                  <View style={[screenStyles.iconFrame, granted ? screenStyles.iconGranted : screenStyles.iconDenied]}>
                    <Feather name={eventIcon(event.method)} size={18} color={granted ? palette.primary : palette.danger} />
                  </View>
                  <View style={screenStyles.eventContent}>
                    <View style={screenStyles.eventHeader}>
                      <Text style={screenStyles.eventTitle}>{methodLabel(event)}</Text>
                      <Chip text={granted ? 'Granted' : 'Denied'} tone={granted ? 'success' : 'danger'} />
                    </View>
                    <Text style={screenStyles.eventMeta}>
                      {toLocalDateTime(event.created_at)}
                      {event.user_name ? ` · ${event.user_name}` : ''}
                      {event.apartment_number ? ` · Apt ${event.apartment_number}` : ''}
                    </Text>
                    {!granted ? (
                      <Text style={screenStyles.reason}>{reasonLabel(event.reason)}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </PageScroll>
    </Screen>
  );
};

const screenStyles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 24,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  list: {
    gap: 10,
  },
  eventRow: {
    alignItems: 'flex-start',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  iconFrame: {
    alignItems: 'center',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconGranted: {
    backgroundColor: palette.primarySoft,
  },
  iconDenied: {
    backgroundColor: '#F8E8E4',
  },
  eventContent: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  eventHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  eventTitle: {
    color: palette.text,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  eventMeta: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  reason: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
