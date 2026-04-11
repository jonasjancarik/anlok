import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { REQUIRED_PIN_LENGTH } from '../../lib/config';
import { PIN, User } from '../../types/entities';
import {
  Banner,
  Button,
  Divider,
  FieldLabel,
  Input,
  SectionCard,
  SubtleText,
  palette,
} from '../common/ui';

interface PinManagementProps {
  token: string;
  user: User;
}

const weakPins = new Set([
  '1234',
  '0000',
  '7777',
  '2000',
  '2222',
  '9999',
  '5555',
  '1122',
  '8888',
  '2001',
  '1111',
  '1212',
  '1004',
  '4444',
  '6969',
  '3333',
  '6666',
  '1313',
  '4321',
  '1010',
]);

const unsafePinPatterns = [
  { regex: new RegExp(`^(${[...weakPins].join('|')})$`), reason: 'commonly used PIN' },
  { regex: /^(0123|1234|2345|3456|4567|5678|6789|7890)$/, reason: 'consecutive numbers' },
  { regex: /^(9876|8765|7654|6543|5432|4321|3210)$/, reason: 'reverse consecutive numbers' },
  { regex: /^(1379|1397|2468|2486)$/, reason: 'common keyboard pattern' },
  { regex: /^(19|20)\d{2}$/, reason: 'common year of birth' },
  { regex: /^(.)\1{3}$/, reason: 'repeated digits' },
];

export const PinManagement = ({ token, user }: PinManagementProps) => {
  const [pins, setPins] = useState<PIN[]>([]);
  const [pin, setPin] = useState('');
  const [label, setLabel] = useState('');
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const needsPinInput = user.role !== 'guest';

  const pinFeedback = useMemo(() => {
    const sanitizedPin = pin.trim();

    if (!needsPinInput || !sanitizedPin) {
      return '';
    }

    if (sanitizedPin.length !== REQUIRED_PIN_LENGTH) {
      return `PIN must be exactly ${REQUIRED_PIN_LENGTH} digits.`;
    }

    if (!/^\d+$/.test(sanitizedPin)) {
      return 'PIN must contain only digits.';
    }

    const matchedPattern = unsafePinPatterns.find((pattern) => pattern.regex.test(sanitizedPin));
    if (matchedPattern) {
      return `This PIN is not allowed: ${matchedPattern.reason}.`;
    }

    return '';
  }, [needsPinInput, pin]);

  const loadPins = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<PIN[]>(`/users/${user.id}/pins`, {
        headers: authHeaders(token),
      });
      setPins(response.data);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to fetch PINs.'));
    } finally {
      setLoading(false);
    }
  }, [token, user.id]);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  const addPin = async () => {
    setError('');
    setSuccess('');
    setGeneratedPin(null);

    if (needsPinInput && pinFeedback) {
      setError(pinFeedback);
      return;
    }

    try {
      const response = await api.post<PIN>(
        '/pins',
        {
          user_id: user.id,
          label: label.trim() || undefined,
          pin: needsPinInput ? pin.trim() : undefined,
        },
        { headers: authHeaders(token) }
      );

      setPin('');
      setLabel('');
      if (!needsPinInput && response.data.pin) {
        setGeneratedPin(response.data.pin);
        setSuccess('PIN generated successfully.');
      } else {
        setSuccess('PIN added.');
      }
      await loadPins();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to add PIN.'));
    }
  };

  const deletePin = (pinId: number) => {
    Alert.alert('Delete PIN', 'Delete this PIN?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setError('');
          setSuccess('');
          try {
            await api.delete(`/pins/${pinId}`, {
              headers: authHeaders(token),
            });
            setSuccess('PIN deleted.');
            await loadPins();
          } catch (nextError) {
            setError(apiErrorMessage(nextError, 'Failed to delete PIN.'));
          }
        },
      },
    ]);
  };

  return (
    <SectionCard title="Manage PINs">
      <View style={{ gap: 6 }}>
        <FieldLabel>Label</FieldLabel>
        <Input value={label} onChangeText={setLabel} placeholder="e.g. Main keypad" />
      </View>

      {needsPinInput ? (
        <View style={{ gap: 6 }}>
          <FieldLabel>PIN</FieldLabel>
          <Input
            keyboardType="number-pad"
            secureTextEntry
            value={pin}
            onChangeText={setPin}
            placeholder={`Enter ${REQUIRED_PIN_LENGTH}-digit PIN`}
          />
          {pinFeedback ? <Banner type="info" text={pinFeedback} /> : null}
        </View>
      ) : (
        <SubtleText>Guest PIN will be auto-generated securely by backend.</SubtleText>
      )}

      <Button
        title="Add PIN"
        size="small"
        icon={<Feather name="plus" size={14} color="#fff" />}
        onPress={addPin}
        disabled={needsPinInput ? !pin.trim() || !!pinFeedback : false}
        style={{ alignSelf: 'flex-start', marginTop: 4 }}
      />

      {generatedPin ? <Banner type="success" text={`Generated PIN: ${generatedPin}`} /> : null}
      {error ? <Banner type="error" text={error} /> : null}
      {success && !generatedPin ? <Banner type="success" text={success} /> : null}

      <Divider />
      {pins.length === 0 ? (
        <SubtleText>{loading ? 'Loading PINs...' : 'No PINs created yet.'}</SubtleText>
      ) : (
        <View style={{ gap: 0 }}>
          {pins.map((item, index) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: index === pins.length - 1 ? 0 : 1,
                borderBottomColor: palette.canvas,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: palette.text, marginBottom: 2 }}>
                  {item.label || 'Unlabeled PIN'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', letterSpacing: 2, color: palette.text }}>****</Text>
                  <Text style={{ fontSize: 12, color: palette.border }}>•</Text>
                  <SubtleText style={{ fontSize: 12 }}>{new Date(item.created_at).toLocaleDateString()}</SubtleText>
                </View>
              </View>
              <Button 
                size="icon" 
                title="" 
                variant="ghost" 
                icon={<Feather name="trash-2" size={16} color={palette.danger} />} 
                onPress={() => deletePin(item.id)} 
              />
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
};
