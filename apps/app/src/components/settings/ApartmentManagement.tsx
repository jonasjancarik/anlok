import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { Apartment } from '../../types/entities';
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

interface ApartmentManagementProps {
  token: string;
}

export const ApartmentManagement = ({ token }: ApartmentManagementProps) => {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selected, setSelected] = useState<Apartment | null>(null);
  const [number, setNumber] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const loadApartments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<Apartment[]>('/apartments', {
        headers: authHeaders(token),
      });
      setApartments(response.data);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to load apartments.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadApartments();
  }, [loadApartments]);

  const resetForm = () => {
    setSelected(null);
    setNumber('');
    setDescription('');
  };

  const saveApartment = async () => {
    setError('');
    setSuccess('');

    try {
      if (selected) {
        await api.put(
          `/apartments/${selected.id}`,
          { number: number.trim(), description: description.trim() },
          { headers: authHeaders(token) }
        );
        setSuccess('Apartment updated.');
      } else {
        await api.post(
          '/apartments',
          { number: number.trim(), description: description.trim() },
          { headers: authHeaders(token) }
        );
        setSuccess('Apartment created.');
      }

      resetForm();
      await loadApartments();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to save apartment.'));
    }
  };

  const editApartment = (apartment: Apartment) => {
    setSelected(apartment);
    setNumber(apartment.number);
    setDescription(apartment.description ?? '');
  };

  const removeApartment = (apartment: Apartment) => {
    Alert.alert('Delete apartment', `Delete apartment ${apartment.number}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setError('');
          setSuccess('');
          try {
            await api.delete(`/apartments/${apartment.id}`, {
              headers: authHeaders(token),
            });
            if (selected?.id === apartment.id) {
              resetForm();
            }
            setSuccess('Apartment deleted.');
            await loadApartments();
          } catch (nextError) {
            setError(apiErrorMessage(nextError, 'Failed to delete apartment.'));
          }
        },
      },
    ]);
  };

  return (
    <SectionCard title="Apartments">
      <View style={{ gap: 6 }}>
        <FieldLabel>Apartment Number</FieldLabel>
        <Input value={number} onChangeText={setNumber} placeholder="e.g. 3B" />
      </View>

      <View style={{ gap: 6 }}>
        <FieldLabel>Description</FieldLabel>
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder="Optional"
          multiline
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <Button
          size="small"
          icon={<Feather name={selected ? "save" : "plus"} size={14} color="#fff" />}
          title={selected ? 'Update Apartment' : 'Create Apartment'}
          onPress={saveApartment}
          disabled={!number.trim()}
        />
        {selected ? <Button size="small" title="Cancel Edit" variant="ghost" onPress={resetForm} /> : null}
      </View>

      {success ? <Banner type="success" text={success} /> : null}
      {error ? <Banner type="error" text={error} /> : null}

      <Divider />
      {apartments.length === 0 ? (
        <SubtleText>{loading ? 'Loading apartments...' : 'No apartments found.'}</SubtleText>
      ) : (
        <View style={{ gap: 0 }}>
          {apartments.map((apartment, index) => (
            <View
              key={apartment.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                paddingVertical: 12,
                borderBottomWidth: index === apartments.length - 1 ? 0 : 1,
                borderBottomColor: palette.canvas,
                backgroundColor: selected?.id === apartment.id ? '#F8FAFC' : 'transparent',
                borderRadius: selected?.id === apartment.id ? 8 : 0,
                paddingHorizontal: selected?.id === apartment.id ? 8 : 0,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: palette.text, marginBottom: 2 }}>Apartment {apartment.number}</Text>
                <SubtleText style={{ fontSize: 13 }}>{apartment.description || 'No description'}</SubtleText>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button size="icon" title="" variant="secondary" icon={<Feather name="edit-2" size={14} color={palette.text} />} onPress={() => editApartment(apartment)} />
                <Button
                  size="icon"
                  title=""
                  variant="ghost"
                  icon={<Feather name="trash-2" size={14} color={palette.danger} />}
                  onPress={() => removeApartment(apartment)}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
};
