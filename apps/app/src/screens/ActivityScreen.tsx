import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  SectionListRenderItemInfo,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Banner, Button, ScreenHeader, Screen, SegmentedControl, palette } from '../components/common/ui';
import { useAuth } from '../contexts/AuthContext';
import { api, apiErrorMessage, authHeaders } from '../lib/api';
import { parseServerDate, relativeDayLabel, toLocalTime } from '../lib/time';
import { AccessEvent } from '../types/entities';

type ActivityFilter = 'all' | 'granted' | 'denied';

const methodLabel = (event: AccessEvent) => {
  if (event.method === 'remote_unlock') {
    return 'Unlock from the app';
  }
  if (event.method === 'rfid') {
    const lastFour = event.metadata?.last_four_digits;
    const suffix = typeof lastFour === 'string' ? ` ...${lastFour}` : '';
    return event.credential_label || `RFID tag${suffix}`;
  }
  if (event.method === 'pin') {
    return event.credential_label || 'PIN entry';
  }
  return 'Unknown credential';
};

const reasonCopy: Record<string, string> = {
  unknown_credential: 'Unknown PIN or card',
  outside_allowed_schedule: 'Outside the allowed schedule',
  inactive_user: 'Person is disabled',
  ambiguous_scheduled_pin: 'PIN matches more than one guest',
};

const reasonLabel = (reason?: string) => {
  if (!reason) return 'No reason recorded';
  const text = reasonCopy[reason] ?? reason.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

type EventSection = { title: string; data: AccessEvent[] };

const eventIcon = (method: AccessEvent['method']) => {
  if (method === 'remote_unlock') return 'smartphone';
  if (method === 'rfid') return 'credit-card';
  if (method === 'pin') return 'hash';
  return 'help-circle';
};

const updatedLabel = (updatedAt: Date | null) => {
  if (!updatedAt) return 'Not updated yet';
  const seconds = Math.max(0, Math.round((Date.now() - updatedAt.getTime()) / 1000));
  if (seconds < 10) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds} seconds ago`;
  return `Updated at ${toLocalTime(updatedAt)}`;
};

export const ActivityScreen = () => {
  const { token } = useAuth();
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchEvents = useCallback(async (isRefresh = false) => {
    if (!token) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await api.get<AccessEvent[]>('/access-events', {
        headers: authHeaders(token),
        params: { limit: 100 },
      });
      setEvents(response.data);
      setUpdatedAt(new Date());
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Couldn’t load door activity. Check your connection and try again.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void fetchEvents(hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [fetchEvents]),
  );

  const visibleEvents = useMemo(
    () => filter === 'all' ? events : events.filter((event) => event.outcome === filter),
    [events, filter],
  );

  const filterCounts = useMemo(() => ({
    all: events.length,
    granted: events.filter((event) => event.outcome === 'granted').length,
    denied: events.filter((event) => event.outcome === 'denied').length,
  }), [events]);

  const sections = useMemo<EventSection[]>(() => {
    const now = new Date();
    const result: EventSection[] = [];
    visibleEvents.forEach((event) => {
      const date = parseServerDate(event.created_at);
      const title = Number.isNaN(date.getTime()) ? 'Earlier' : relativeDayLabel(date, now);
      const last = result[result.length - 1];
      if (last && last.title === title) {
        last.data.push(event);
      } else {
        result.push({ title, data: [event] });
      }
    });
    return result;
  }, [visibleEvents]);

  const renderEvent = useCallback(({ item: event, index, section }: SectionListRenderItemInfo<AccessEvent, EventSection>) => {
    const granted = event.outcome === 'granted';
    const method = methodLabel(event);
    const date = parseServerDate(event.created_at);
    const time = Number.isNaN(date.getTime()) ? event.created_at : toLocalTime(date);
    const who = [
      event.user_name,
      event.apartment_number ? `Apartment ${event.apartment_number}` : null,
    ].filter(Boolean).join(' · ');
    const isFirst = index === 0;
    const isLast = index === section.data.length - 1;

    return (
      <View
        accessible
        accessibilityLabel={`${method}. ${granted ? 'Granted' : `Denied, ${reasonLabel(event.reason)}`}. ${section.title} ${time}. ${who}`}
        style={[
          screenStyles.eventRow,
          isFirst ? screenStyles.eventRowFirst : null,
          isLast ? screenStyles.eventRowLast : screenStyles.eventRowDivider,
        ]}
      >
        <View style={[screenStyles.iconFrame, granted ? screenStyles.iconGranted : screenStyles.iconDenied]}>
          <Feather name={eventIcon(event.method)} size={18} color={granted ? palette.primary : palette.danger} />
          <View style={[screenStyles.outcomeDot, { backgroundColor: granted ? palette.success : palette.danger }]} />
        </View>
        <View style={screenStyles.eventContent}>
          <View style={screenStyles.eventHeader}>
            <Text numberOfLines={1} style={screenStyles.eventTitle}>{method}</Text>
            <Text style={screenStyles.eventTime}>{time}</Text>
          </View>
          {who ? <Text numberOfLines={1} style={screenStyles.eventMeta}>{who}</Text> : null}
          {granted ? (
            <Text style={screenStyles.granted}>Access granted</Text>
          ) : (
            <Text style={screenStyles.reason}>Denied · {reasonLabel(event.reason)}</Text>
          )}
        </View>
      </View>
    );
  }, []);

  if (!token) return null;

  const header = (
    <View style={screenStyles.headerStack}>
      <ScreenHeader
        eyebrow="Main entrance"
        title="Activity"
        subtitle={updatedLabel(updatedAt)}
        action={(
          <Button
            title=""
            accessibilityLabel="Refresh"
            accessibilityHint="Loads the latest door activity"
            variant="secondary"
            size="icon"
            loading={refreshing}
            icon={<Feather name="refresh-cw" size={18} color={palette.text} />}
            onPress={() => void fetchEvents(true)}
          />
        )}
      />

      <SegmentedControl
        options={[
          { key: 'all', label: 'All', count: filterCounts.all },
          { key: 'granted', label: 'Granted', count: filterCounts.granted },
          { key: 'denied', label: 'Denied', count: filterCounts.denied },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {error ? (
        <View style={screenStyles.errorStack}>
          <Banner type="error" text={error} />
          <Button title="Try again" variant="secondary" onPress={() => void fetchEvents()} />
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <SectionList
        sections={sections}
        renderItem={renderEvent}
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={screenStyles.sectionTitle}>{section.title}</Text>
        )}
        keyExtractor={(event) => String(event.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? (
          <View style={screenStyles.loadingPanel} accessibilityLiveRegion="polite">
            <ActivityIndicator color={palette.primary} />
            <Text style={screenStyles.loadingText}>Loading door activity…</Text>
          </View>
        ) : !error ? (
          <View style={screenStyles.emptyState}>
            <View style={screenStyles.emptyIcon}>
              <Feather name={filter === 'denied' ? 'check-circle' : 'clock'} size={24} color={palette.primary} />
            </View>
            <Text style={screenStyles.emptyTitle}>
              {events.length === 0
                ? 'No door activity yet'
                : filter === 'denied'
                  ? 'No denied attempts'
                  : 'No granted entries'}
            </Text>
            <Text style={screenStyles.emptyCopy}>
              {events.length === 0
                ? 'Unlocks, PIN entries, and card scans will appear here as they happen.'
                : 'Choose another filter to see the rest of the activity.'}
            </Text>
          </View>
        ) : null}
        contentContainerStyle={screenStyles.listContent}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void fetchEvents(true)}
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        )}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        initialNumToRender={14}
        maxToRenderPerBatch={14}
        windowSize={7}
      />
    </Screen>
  );
};

const screenStyles = StyleSheet.create({
  listContent: {
    alignSelf: 'center',
    maxWidth: 720,
    padding: 20,
    paddingBottom: 60,
    width: '100%',
  },
  headerStack: {
    gap: 16,
    marginBottom: 4,
  },
  sectionTitle: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  errorStack: {
    gap: 8,
  },
  loadingPanel: {
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    padding: 28,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginBottom: 4,
    width: 48,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
    textAlign: 'center',
  },
  eventRow: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  eventRowFirst: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderTopWidth: 1,
  },
  eventRowLast: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomWidth: 1,
  },
  eventRowDivider: {
    borderBottomColor: '#ECE4D8',
    borderBottomWidth: 1,
  },
  iconFrame: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconGranted: {
    backgroundColor: palette.primarySoft,
  },
  iconDenied: {
    backgroundColor: '#F8E8E4',
  },
  outcomeDot: {
    borderColor: palette.card,
    borderRadius: 6,
    borderWidth: 2,
    bottom: 0,
    height: 12,
    position: 'absolute',
    right: 0,
    width: 12,
  },
  eventContent: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  eventHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  eventTitle: {
    color: palette.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  eventTime: {
    color: palette.muted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  eventMeta: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  granted: {
    color: palette.success,
    fontSize: 13,
    fontWeight: '700',
  },
  reason: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
