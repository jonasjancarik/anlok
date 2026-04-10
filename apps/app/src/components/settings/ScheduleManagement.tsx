import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
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
    <SectionCard title={`Schedules: ${user.name}`}>
      <SubtleText>Guest schedule management.</SubtleText>
      <Row>
        <Button
          title="Recurring Schedule"
          variant={tab === 'recurring' ? 'primary' : 'secondary'}
          onPress={() => setTab('recurring')}
        />
        <Button
          title="One-Time Access"
          variant={tab === 'oneTime' ? 'primary' : 'secondary'}
          onPress={() => setTab('oneTime')}
        />
      </Row>
      {error ? <Banner type="error" text={error} /> : null}
      {success ? <Banner type="success" text={success} /> : null}

      <Divider />
      {tab === 'recurring' ? (
        <>
          <View style={{ gap: 6 }}>
            <FieldLabel>Day of Week</FieldLabel>
            <Row>
              {dayOptions.map((label, index) => (
                <Button
                  key={label}
                  title={label}
                  variant={dayOfWeek === String(index) ? 'primary' : 'secondary'}
                  onPress={() => setDayOfWeek(String(index))}
                />
              ))}
            </Row>
            <FieldLabel>Time Range</FieldLabel>
            <Input
              value={recurringStartTime}
              onChangeText={setRecurringStartTime}
              placeholder="Start time HH:mm"
            />
            <Input
              value={recurringEndTime}
              onChangeText={setRecurringEndTime}
              placeholder="End time HH:mm"
            />
            <Button title="Add Schedule" onPress={addRecurring} />
          </View>

          <Divider />
          <FieldLabel>Recurring Schedules</FieldLabel>
          {recurring.length === 0 ? (
            <SubtleText>{loading ? 'Loading...' : 'No recurring schedules.'}</SubtleText>
          ) : (
            <View style={{ gap: 8 }}>
              {recurring.map((item) => (
                <View
                  key={item.id}
                  style={{
                    borderWidth: 1,
                    borderColor: '#d2dbf0',
                    borderRadius: 10,
                    padding: 10,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontWeight: '700' }}>{dayLabel(item.day_of_week)}</Text>
                  <SubtleText>
                    {formatTime(item.start_time)} - {formatTime(item.end_time)}
                  </SubtleText>
                  <Button
                    title="Delete"
                    variant="danger"
                    onPress={() => deleteRecurring(item.id)}
                  />
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <FieldLabel>Date Range</FieldLabel>
            <Input
              value={oneStartDate}
              onChangeText={handleStartDateChange}
              placeholder={today}
            />
            <Input
              value={oneEndDate}
              onChangeText={handleEndDateChange}
              placeholder={today}
            />
            <FieldLabel>Time Range</FieldLabel>
            <Input
              value={oneStartTime}
              onChangeText={setOneStartTime}
              placeholder="Start time HH:mm"
            />
            <Input
              value={oneEndTime}
              onChangeText={setOneEndTime}
              placeholder="End time HH:mm"
            />
            <Button
              title="Add Access"
              onPress={addOneTime}
              disabled={!oneStartDate || !oneEndDate}
            />
          </View>

          <Divider />
          <FieldLabel>One-Time Access</FieldLabel>
          {oneTime.length === 0 ? (
            <SubtleText>{loading ? 'Loading...' : 'No one-time accesses.'}</SubtleText>
          ) : (
            <View style={{ gap: 8 }}>
              {oneTime.map((item) => (
                <View
                  key={item.id}
                  style={{
                    borderWidth: 1,
                    borderColor: '#d2dbf0',
                    borderRadius: 10,
                    padding: 10,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontWeight: '700' }}>
                    {item.start_date} {'->'} {item.end_date}
                  </Text>
                  <SubtleText>
                    {formatTime(item.start_time)} - {formatTime(item.end_time)}
                  </SubtleText>
                  <Button
                    title="Delete"
                    variant="danger"
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
