import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
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

const today = new Date().toISOString().slice(0, 10);
const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const formatTime = (value: string) => value.slice(0, 5);

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
  const [endDateManuallySet, setEndDateManuallySet] = useState(false);

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
      setError('day_of_week must be 0..6 (Mon..Sun).');
      return;
    }

    try {
      await api.post(
        `/guests/${user.id}/recurring-schedules`,
        {
          day_of_week: day,
          start_time: recurringStartTime,
          end_time: recurringEndTime,
        },
        { headers: authHeaders(token) }
      );
      setSuccess('Recurring schedule added.');
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
    if (!endDateManuallySet) {
      setOneEndDate(value);
    }
  };

  const handleEndDateChange = (value: string) => {
    setEndDateManuallySet(true);
    setOneEndDate(value);
  };

  const addOneTime = async () => {
    setError('');
    setSuccess('');

    try {
      await api.post(
        `/guests/${user.id}/one-time-accesses`,
        {
          start_date: oneStartDate,
          end_date: oneEndDate,
          start_time: oneStartTime,
          end_time: oneEndTime,
        },
        { headers: authHeaders(token) }
      );
      setSuccess('One-time access added.');
      setOneStartDate('');
      setOneEndDate('');
      setOneStartTime('09:00');
      setOneEndTime('17:00');
      setEndDateManuallySet(false);
      await loadSchedules();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to add one-time access.'));
    }
  };

  const deleteRecurring = (id: number) => {
    Alert.alert('Delete recurring schedule', 'Delete this recurring schedule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/guests/recurring-schedules/${id}`, {
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

  const deleteOneTime = (id: number) => {
    Alert.alert('Delete one-time access', 'Delete this one-time access?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/guests/one-time-accesses/${id}`, {
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
          title="One-Time"
          size="small"
          variant={tab === 'oneTime' ? 'primary' : 'ghost'}
          onPress={() => setTab('oneTime')}
          style={{ flexGrow: 1 }}
        />
      </Row>

      {error ? <Banner type="error" text={error} /> : null}
      {success ? <Banner type="success" text={success} /> : null}

      {tab === 'recurring' ? (
        <>
          <View style={{ gap: 6, marginTop: 8 }}>
            <FieldLabel>Day of Week</FieldLabel>
            <Row style={{ gap: 6 }}>
              {dayOptions.map((label, index) => (
                <Button
                  key={label}
                  title={label.slice(0, 3)}
                  size="small"
                  variant={dayOfWeek === String(index) ? 'primary' : 'secondary'}
                  onPress={() => setDayOfWeek(String(index))}
                  style={{ paddingHorizontal: 10, minHeight: 32 }}
                />
              ))}
            </Row>
            
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <FieldLabel>Start Time</FieldLabel>
                <Input
                  value={recurringStartTime}
                  onChangeText={setRecurringStartTime}
                  placeholder="HH:mm"
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <FieldLabel>End Time</FieldLabel>
                <Input
                  value={recurringEndTime}
                  onChangeText={setRecurringEndTime}
                  placeholder="HH:mm"
                />
              </View>
            </View>
            <Button 
              title="Add Schedule" 
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
                    variant="ghost"
                    icon={<Feather name="trash-2" size={16} color={palette.danger} />}
                    onPress={() => deleteRecurring(item.id)}
                  />
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <View style={{ gap: 6, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <FieldLabel>Start Date</FieldLabel>
                <Input
                  value={oneStartDate}
                  onChangeText={handleStartDateChange}
                  placeholder={today}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <FieldLabel>End Date</FieldLabel>
                <Input
                  value={oneEndDate}
                  onChangeText={handleEndDateChange}
                  placeholder={today}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <FieldLabel>Start Time</FieldLabel>
                <Input
                  value={oneStartTime}
                  onChangeText={setOneStartTime}
                  placeholder="09:00"
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <FieldLabel>End Time</FieldLabel>
                <Input
                  value={oneEndTime}
                  onChangeText={setOneEndTime}
                  placeholder="17:00"
                />
              </View>
            </View>
            <Button
              title="Add Access"
              size="small"
              icon={<Feather name="plus" size={14} color="#fff" />}
              onPress={addOneTime}
              disabled={!oneStartDate || !oneEndDate}
              style={{ alignSelf: 'flex-start', marginTop: 8 }}
            />
          </View>

          <Divider />
          <FieldLabel style={{ marginTop: 8 }}>Active Accesses</FieldLabel>
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
                    variant="ghost"
                    icon={<Feather name="trash-2" size={16} color={palette.danger} />}
                    onPress={() => deleteOneTime(item.id)}
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
