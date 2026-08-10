import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { dayLabel } from '../../lib/time';
import { GuestSchedulesResponse, OneTimeAccess, RecurringSchedule, User } from '../../types/entities';
import {
  Banner,
  Button,
  Divider,
  FieldLabel,
  Input,
  Row,
  SectionCard,
  SubtleText,
  palette,
} from '../common/ui';

interface ScheduleManagementProps {
  token: string;
  user: User;
}

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
};

const today = formatDate(new Date());
const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const formatTime = (value: string) => value.slice(0, 5);
const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const isForwardTimeRange = (start: string, end: string) => end > start;

const webInputProps = (type: 'date' | 'time') =>
  Platform.OS === 'web' ? ({ type } as any) : {};

const dateShortcuts = [
  { label: 'Today', value: today },
  { label: 'Tomorrow', value: addDays(1) },
  { label: '+7 days', value: addDays(7) },
];

const timePresets = [
  { label: 'Morning', start: '09:00', end: '12:00' },
  { label: 'Workday', start: '09:00', end: '17:00' },
  { label: 'Evening', start: '18:00', end: '22:00' },
  { label: 'All Day', start: '00:00', end: '23:59' },
];

const scheduledPinWarning =
  'Scheduled access needs a unique PIN so time limits can be enforced. PINs for this user will be deleted and new PINs will be automatically generated.';

const FieldColumn = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flex: 1, minWidth: 120, gap: 6 }}>{children}</View>
);

export const ScheduleManagement = ({ token, user }: ScheduleManagementProps) => {
  const [recurring, setRecurring] = useState<RecurringSchedule[]>([]);
  const [oneTime, setOneTime] = useState<OneTimeAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<'recurring' | 'oneTime'>('recurring');

  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [recurringStartTime, setRecurringStartTime] = useState('09:00');
  const [recurringEndTime, setRecurringEndTime] = useState('17:00');

  const [oneStartDate, setOneStartDate] = useState('');
  const [oneEndDate, setOneEndDate] = useState('');
  const [oneStartTime, setOneStartTime] = useState('09:00');
  const [oneEndTime, setOneEndTime] = useState('17:00');
  const endDateManuallySetRef = useRef(false);
  const hasSchedules = recurring.length > 0 || oneTime.length > 0;

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<GuestSchedulesResponse>(`/guests/${user.id}/schedules`, {
        headers: authHeaders(token),
      });
      setRecurring(response.data.recurring_schedules ?? []);
      setOneTime(response.data.one_time_access ?? []);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to fetch schedules.'));
    } finally {
      setLoading(false);
    }
  }, [token, user.id]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const addRecurring = async () => {
    setError('');
    setSuccess('');

    const day = Number(dayOfWeek);
    if (Number.isNaN(day) || day < 0 || day > 6) {
      setError('Choose a day for recurring access.');
      return;
    }

    if (!isValidTime(recurringStartTime) || !isValidTime(recurringEndTime)) {
      setError('Enter each time as HH:mm, for example 09:30.');
      return;
    }

    if (!isForwardTimeRange(recurringStartTime, recurringEndTime)) {
      setError('End time must be later than start time. Overnight access needs two schedules.');
      return;
    }

    try {
      const response = await api.post<{ pin?: string }>(
        `/guests/${user.id}/recurring-schedules`,
        {
          day_of_week: day,
          start_time: recurringStartTime,
          end_time: recurringEndTime,
        },
        { headers: authHeaders(token) }
      );
      setSuccess(
        response.data.pin
          ? `Recurring schedule added. New PIN: ${response.data.pin}`
          : 'Recurring schedule added.'
      );
      setDayOfWeek('0');
      setRecurringStartTime('09:00');
      setRecurringEndTime('17:00');
      await loadSchedules();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to add recurring schedule.'));
    }
  };

  const handleStartDateChange = (value: string) => {
    setOneStartDate(value);
    if (!endDateManuallySetRef.current) {
      setOneEndDate(value);
    }
  };

  const handleEndDateChange = (value: string) => {
    endDateManuallySetRef.current = true;
    setOneEndDate(value);
  };

  const addOneTime = async () => {
    setError('');
    setSuccess('');

    if (!isValidDate(oneStartDate) || !isValidDate(oneEndDate)) {
      setError('Enter each date as YYYY-MM-DD, for example 2026-08-10.');
      return;
    }

    if (oneStartDate > oneEndDate) {
      setError('End date must be on or after start date.');
      return;
    }

    if (!isValidTime(oneStartTime) || !isValidTime(oneEndTime)) {
      setError('Enter each time as HH:mm, for example 09:30.');
      return;
    }

    if (!isForwardTimeRange(oneStartTime, oneEndTime)) {
      setError('End time must be later than start time. Overnight access needs two schedules.');
      return;
    }

    try {
      const response = await api.post<{ pin?: string }>(
        `/guests/${user.id}/one-time-accesses`,
        {
          start_date: oneStartDate,
          end_date: oneEndDate,
          start_time: oneStartTime,
          end_time: oneEndTime,
        },
        { headers: authHeaders(token) }
      );
      setSuccess(
        response.data.pin
          ? `One-time access added. New PIN: ${response.data.pin}`
          : 'One-time access added.'
      );
      setOneStartDate('');
      setOneEndDate('');
      setOneStartTime('09:00');
      setOneEndTime('17:00');
      endDateManuallySetRef.current = false;
      await loadSchedules();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to add one-time access.'));
    }
  };

  const deleteRecurring = (item: RecurringSchedule) => {
    Alert.alert('Remove recurring access?', `${dayLabel(item.day_of_week)}, ${formatTime(item.start_time)} to ${formatTime(item.end_time)} will no longer unlock the door.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/guests/recurring-schedules/${item.id}`, {
              headers: authHeaders(token),
            });
            setSuccess('Recurring schedule deleted.');
            await loadSchedules();
          } catch (nextError) {
            setError(apiErrorMessage(nextError, 'Failed to delete recurring schedule.'));
          }
        },
      },
    ]);
  };

  const deleteOneTime = (item: OneTimeAccess) => {
    Alert.alert('Remove one-time access?', `${item.start_date} to ${item.end_date} will no longer unlock the door.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/guests/one-time-accesses/${item.id}`, {
              headers: authHeaders(token),
            });
            setSuccess('One-time access deleted.');
            await loadSchedules();
          } catch (nextError) {
            setError(apiErrorMessage(nextError, 'Failed to delete one-time access.'));
          }
        },
      },
    ]);
  };

  const applyRecurringPreset = (start: string, end: string) => {
    setRecurringStartTime(start);
    setRecurringEndTime(end);
  };

  const applyOneTimePreset = (start: string, end: string) => {
    setOneStartTime(start);
    setOneEndTime(end);
  };

  const applyOneTimeDate = (date: string) => {
    setOneStartDate(date);
    if (!endDateManuallySetRef.current) {
      setOneEndDate(date);
    }
  };

  return (
    <SectionCard title="Manage Schedules">
      <Row style={{ backgroundColor: palette.canvas, padding: 4, borderRadius: 12 }}>
        <Button
          title="Recurring"
          size="small"
          variant={tab === 'recurring' ? 'primary' : 'ghost'}
          onPress={() => setTab('recurring')}
          style={{ flexGrow: 1 }}
        />
        <Button
          title="One-time"
          size="small"
          variant={tab === 'oneTime' ? 'primary' : 'ghost'}
          onPress={() => setTab('oneTime')}
          style={{ flexGrow: 1 }}
        />
      </Row>

      {error ? <Banner type="error" text={error} /> : null}
      {success ? <Banner type="success" text={success} /> : null}
      {!hasSchedules ? <Banner type="info" text={scheduledPinWarning} /> : null}

      {tab === 'recurring' ? (
        <>
          <View style={{ gap: 6, marginTop: 8 }}>
            <FieldLabel>Day of week</FieldLabel>
            <Row style={{ gap: 6 }}>
              {dayOptions.map((label, index) => (
                <Button
                  key={label}
                  title={label.slice(0, 3)}
                  accessibilityLabel={label}
                  size="small"
                  variant={dayOfWeek === String(index) ? 'primary' : 'secondary'}
                  onPress={() => setDayOfWeek(String(index))}
                  style={{ paddingHorizontal: 10, minHeight: 44 }}
                />
              ))}
            </Row>
            
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <FieldColumn>
                <FieldLabel>Start Time</FieldLabel>
                <Input
                  accessibilityLabel="Recurring access start time"
                  value={recurringStartTime}
                  onChangeText={setRecurringStartTime}
                  placeholder="HH:mm"
                  keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                  maxLength={5}
                  {...webInputProps('time')}
                />
              </FieldColumn>
              <FieldColumn>
                <FieldLabel>End Time</FieldLabel>
                <Input
                  accessibilityLabel="Recurring access end time"
                  value={recurringEndTime}
                  onChangeText={setRecurringEndTime}
                  placeholder="HH:mm"
                  keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                  maxLength={5}
                  {...webInputProps('time')}
                />
              </FieldColumn>
            </View>
            <Row style={{ gap: 6, marginTop: 4 }}>
              {timePresets.map((preset) => (
                <Button
                  key={preset.label}
                  title={preset.label}
                  size="small"
                  variant="secondary"
                  onPress={() => applyRecurringPreset(preset.start, preset.end)}
                  style={{ minHeight: 44, paddingHorizontal: 10 }}
                />
              ))}
            </Row>
            <Button 
              title="Add recurring access"
              size="small"
              icon={<Feather name="plus" size={14} color="#fff" />}
              onPress={addRecurring} 
              style={{ alignSelf: 'flex-start', marginTop: 8 }}
            />
          </View>

          <Divider />
          <FieldLabel style={{ marginTop: 8 }}>Active Schedules</FieldLabel>
          {recurring.length === 0 ? (
            <SubtleText>{loading ? 'Loading...' : 'No recurring schedules configured.'}</SubtleText>
          ) : (
            <View style={{ gap: 0 }}>
              {recurring.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: index === recurring.length - 1 ? 0 : 1,
                    borderBottomColor: palette.canvas,
                  }}
                >
                  <View>
                    <Text style={{ fontWeight: '700', fontSize: 15, color: palette.text, marginBottom: 2 }}>{dayLabel(item.day_of_week)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name="clock" size={12} color={palette.muted} />
                      <SubtleText style={{ fontSize: 13 }}>
                        {formatTime(item.start_time)} to {formatTime(item.end_time)}
                      </SubtleText>
                    </View>
                  </View>
                  <Button
                    size="icon"
                    title=""
                    accessibilityLabel={`Delete ${dayLabel(item.day_of_week)} recurring access`}
                    variant="ghost"
                    icon={<Feather name="trash-2" size={16} color={palette.danger} />}
                    onPress={() => deleteRecurring(item)}
                  />
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <View style={{ gap: 6, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              <FieldColumn>
                <FieldLabel>Start date</FieldLabel>
                <Input
                  accessibilityLabel="One-time access start date"
                  value={oneStartDate}
                  onChangeText={handleStartDateChange}
                  placeholder={today}
                  keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                  maxLength={10}
                  {...webInputProps('date')}
                />
              </FieldColumn>
              <FieldColumn>
                <FieldLabel>End date</FieldLabel>
                <Input
                  accessibilityLabel="One-time access end date"
                  value={oneEndDate}
                  onChangeText={handleEndDateChange}
                  placeholder={today}
                  keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                  maxLength={10}
                  {...webInputProps('date')}
                />
              </FieldColumn>
            </View>
            <Row style={{ gap: 6, marginTop: 4 }}>
              {dateShortcuts.map((shortcut) => (
                <Button
                  key={shortcut.label}
                  title={shortcut.label}
                  size="small"
                  variant="secondary"
                  onPress={() => applyOneTimeDate(shortcut.value)}
                  style={{ minHeight: 44, paddingHorizontal: 10 }}
                />
              ))}
            </Row>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
              <FieldColumn>
                <FieldLabel>Start time</FieldLabel>
                <Input
                  accessibilityLabel="One-time access start time"
                  value={oneStartTime}
                  onChangeText={setOneStartTime}
                  placeholder="09:00"
                  keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                  maxLength={5}
                  {...webInputProps('time')}
                />
              </FieldColumn>
              <FieldColumn>
                <FieldLabel>End time</FieldLabel>
                <Input
                  accessibilityLabel="One-time access end time"
                  value={oneEndTime}
                  onChangeText={setOneEndTime}
                  placeholder="17:00"
                  keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                  maxLength={5}
                  {...webInputProps('time')}
                />
              </FieldColumn>
            </View>
            <Row style={{ gap: 6, marginTop: 4 }}>
              {timePresets.map((preset) => (
                <Button
                  key={preset.label}
                  title={preset.label}
                  size="small"
                  variant="secondary"
                  onPress={() => applyOneTimePreset(preset.start, preset.end)}
                  style={{ minHeight: 44, paddingHorizontal: 10 }}
                />
              ))}
            </Row>
            <Button
              title="Add one-time access"
              size="small"
              icon={<Feather name="plus" size={14} color="#fff" />}
              onPress={addOneTime}
              disabled={!oneStartDate || !oneEndDate}
              style={{ alignSelf: 'flex-start', marginTop: 8 }}
            />
          </View>

          <Divider />
          <FieldLabel style={{ marginTop: 8 }}>Active access</FieldLabel>
          {oneTime.length === 0 ? (
            <SubtleText>{loading ? 'Loading...' : 'No one-time accesses configured.'}</SubtleText>
          ) : (
            <View style={{ gap: 0 }}>
              {oneTime.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: index === oneTime.length - 1 ? 0 : 1,
                    borderBottomColor: palette.canvas,
                  }}
                >
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Feather name="calendar" size={12} color={palette.primary} />
                      <Text style={{ fontWeight: '700', fontSize: 14, color: palette.text }}>
                        {item.start_date} to {item.end_date}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name="clock" size={12} color={palette.muted} />
                      <SubtleText style={{ fontSize: 13 }}>
                        {formatTime(item.start_time)} to {formatTime(item.end_time)}
                      </SubtleText>
                    </View>
                  </View>
                  <Button
                    size="icon"
                    title=""
                    accessibilityLabel={`Delete one-time access from ${item.start_date} to ${item.end_date}`}
                    variant="ghost"
                    icon={<Feather name="trash-2" size={16} color={palette.danger} />}
                    onPress={() => deleteOneTime(item)}
                  />
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </SectionCard>
  );
};
