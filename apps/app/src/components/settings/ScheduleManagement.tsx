import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { dayLabel, toLocalDate, toLocalDateTime } from '../../lib/time';
import { OneTimeAccess, RecurringSchedule, User } from '../../types/entities';
import {
  Banner,
  Button,
  Divider,
  FieldLabel,
  Input,
  SectionCard,
  SubtleText,
} from '../common/ui';

interface ScheduleManagementProps {
  token: string;
  user: User;
}

const today = new Date().toISOString().slice(0, 10);

export const ScheduleManagement = ({ token, user }: ScheduleManagementProps) => {
  const [recurring, setRecurring] = useState<RecurringSchedule[]>([]);
  const [oneTime, setOneTime] = useState<OneTimeAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [recurringStartTime, setRecurringStartTime] = useState('09:00');
  const [recurringEndTime, setRecurringEndTime] = useState('18:00');

  const [oneStartDate, setOneStartDate] = useState(today);
  const [oneEndDate, setOneEndDate] = useState(today);
  const [oneStartTime, setOneStartTime] = useState('09:00');
  const [oneEndTime, setOneEndTime] = useState('18:00');

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{
        recurring_schedules: RecurringSchedule[];
        one_time_accesses: OneTimeAccess[];
      }>(`/guests/${user.id}/schedules`, {
        headers: authHeaders(token),
      });
      setRecurring(response.data.recurring_schedules ?? []);
      setOneTime(response.data.one_time_accesses ?? []);
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
      setError('day_of_week must be 0..6 (Sun..Sat).');
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
      await loadSchedules();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to add recurring schedule.'));
    }
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
      {error ? <Banner type="error" text={error} /> : null}
      {success ? <Banner type="success" text={success} /> : null}

      <Divider />
      <View style={{ gap: 6 }}>
        <FieldLabel>Add Recurring</FieldLabel>
        <Input
          value={dayOfWeek}
          onChangeText={setDayOfWeek}
          placeholder="day_of_week 0..6"
          keyboardType="number-pad"
        />
        <Input
          value={recurringStartTime}
          onChangeText={setRecurringStartTime}
          placeholder="start_time HH:mm"
        />
        <Input
          value={recurringEndTime}
          onChangeText={setRecurringEndTime}
          placeholder="end_time HH:mm"
        />
        <Button title="Add Recurring" onPress={addRecurring} />
      </View>

      <View style={{ gap: 6 }}>
        <FieldLabel>Add One-Time</FieldLabel>
        <Input
          value={oneStartDate}
          onChangeText={setOneStartDate}
          placeholder="start_date YYYY-MM-DD"
        />
        <Input
          value={oneEndDate}
          onChangeText={setOneEndDate}
          placeholder="end_date YYYY-MM-DD"
        />
        <Input
          value={oneStartTime}
          onChangeText={setOneStartTime}
          placeholder="start_time HH:mm"
        />
        <Input
          value={oneEndTime}
          onChangeText={setOneEndTime}
          placeholder="end_time HH:mm"
        />
        <Button title="Add One-Time" onPress={addOneTime} />
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
                {item.start_time} - {item.end_time}
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
                {toLocalDate(item.start_date)}
                {' -> '}
                {toLocalDate(item.end_date)}
              </Text>
              <SubtleText>
                {item.start_time} - {item.end_time}
              </SubtleText>
              <SubtleText>{toLocalDateTime(item.start_date)}</SubtleText>
              <Button
                title="Delete"
                variant="danger"
                onPress={() => deleteOneTime(item.id)}
              />
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
};
