import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Banner, Button, Chip, Screen, SectionCard, palette, styles as uiStyles } from '../components/common/ui';
import { useAuth } from '../contexts/AuthContext';
import { api, apiErrorMessage, authHeaders } from '../lib/api';
import { toLocalDateTime } from '../lib/time';
import { AccessEvent } from '../types/entities';

type ActivityFilter = 'all' | 'granted' | 'denied';

const methodLabel = (event: AccessEvent) => {
  if (event.method === 'remote_unlock') {
    return 'Remote unlock requested';
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

const reasonLabel = (reason?: string) => reason?.replace(/_/g, ' ') ?? 'No reason recorded';

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
  return `Updated at ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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

  const renderEvent = useCallback(({ item: event }: ListRenderItemInfo<AccessEvent>) => {
    const granted = event.outcome === 'granted';
    const method = methodLabel(event);
    const meta = [
      toLocalDateTime(event.created_at),
      event.user_name,
      event.apartment_number ? `Apartment ${event.apartment_number}` : null,
    ].filter(Boolean).join(', ');

    return (
      <View
        accessible
        accessibilityLabel={`${method}. ${granted ? 'Granted' : `Denied, ${reasonLabel(event.reason)}`}. ${meta}`}
        style={screenStyles.eventRow}
      >
        <View style={[screenStyles.iconFrame, granted ? screenStyles.iconGranted : screenStyles.iconDenied]}>
          <Feather name={eventIcon(event.method)} size={18} color={granted ? palette.primary : palette.danger} />
        </View>
        <View style={screenStyles.eventContent}>
          <View style={screenStyles.eventHeader}>
            <Text numberOfLines={2} style={screenStyles.eventTitle}>{method}</Text>
            <Chip text={granted ? 'Granted' : 'Denied'} tone={granted ? 'success' : 'danger'} />
          </View>
          <Text style={screenStyles.eventMeta}>{meta}</Text>
          {!granted ? <Text style={screenStyles.reason}>{reasonLabel(event.reason)}</Text> : null}
        </View>
      </View>
    );
  }, []);

  if (!token) return null;

  const header = (
    <View style={screenStyles.headerStack}>
      <SectionCard>
        <View style={screenStyles.header}>
          <View style={screenStyles.headerCopy}>
            <Text style={screenStyles.eyebrow}>Main entrance</Text>
            <Text style={screenStyles.title}>Door activity</Text>
          </View>
          <Button
            title="Refresh"
            accessibilityHint="Loads the latest door activity"
            variant="secondary"
            size="small"
            loading={refreshing}
            icon={<Feather name="refresh-cw" size={15} color={palette.text} />}
            onPress={() => void fetchEvents(true)}
          />
        </View>
        <Text style={uiStyles.subtleText}>Review recent unlock requests, PIN entries, and RFID scans.</Text>
        <Text accessibilityLiveRegion="polite" style={screenStyles.updatedText}>{updatedLabel(updatedAt)}</Text>
      </SectionCard>

      <View accessibilityRole="tablist" style={screenStyles.filters}>
        {(['all', 'granted', 'denied'] as ActivityFilter[]).map((value) => {
          const selected = filter === value;
          const label = value === 'all' ? 'All' : value === 'granted' ? 'Granted' : 'Denied';
          return (
            <Pressable
              key={value}
              accessibilityLabel={`${label}, ${filterCounts[value]} events`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setFilter(value)}
              style={({ pressed }) => [
                screenStyles.filterButton,
                selected ? screenStyles.filterButtonSelected : null,
                pressed ? screenStyles.filterButtonPressed : null,
              ]}
            >
              <Text style={[screenStyles.filterText, selected ? screenStyles.filterTextSelected : null]}>{label}</Text>
              <Text style={[screenStyles.filterCount, selected ? screenStyles.filterTextSelected : null]}>{filterCounts[value]}</Text>
            </Pressable>
          );
        })}
      </View>

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
      <FlatList
        data={visibleEvents}
        renderItem={renderEvent}
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
              {events.length === 0 ? 'No door activity yet' : `No ${filter} activity`}
            </Text>
            <Text style={screenStyles.emptyCopy}>
              {events.length === 0
                ? 'New door events will appear here as they happen.'
                : 'Choose another filter to see the rest of the activity.'}
            </Text>
          </View>
        ) : null}
        ItemSeparatorComponent={() => <View style={screenStyles.separator} />}
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
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
      />
    </Screen>
  );
};

const screenStyles = StyleSheet.create({
  listContent: {
    alignSelf: 'center',
    maxWidth: 1120,
    padding: 20,
    paddingBottom: 60,
    width: '100%',
  },
  headerStack: {
    gap: 14,
    marginBottom: 14,
  },
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
  updatedText: {
    color: palette.subtle,
    fontSize: 12,
    fontWeight: '600',
  },
  filters: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  filterButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  filterButtonSelected: {
    backgroundColor: palette.primarySoft,
  },
  filterButtonPressed: {
    opacity: 0.72,
  },
  filterText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextSelected: {
    color: palette.primary,
  },
  filterCount: {
    color: palette.subtle,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  errorStack: {
    gap: 8,
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
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
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    marginBottom: 4,
    width: 48,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '800',
  },
  emptyCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
    textAlign: 'center',
  },
  separator: {
    height: 10,
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
  eventContent: {
    flex: 1,
    gap: 6,
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
