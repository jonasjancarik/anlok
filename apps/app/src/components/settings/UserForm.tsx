import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { Apartment, User } from '../../types/entities';
import {
  Banner,
  Button,
  Chip,
  FieldLabel,
  Horizontal,
  Input,
  Row,
  SectionCard,
  SubtleText,
} from '../common/ui';

interface UserFormProps {
  token: string;
  currentUser: User;
  targetUser: User | null;
  onSuccess: (updatedUser: User | null) => void;
  onCancel?: () => void;
}

const roleOptions: User['role'][] = ['admin', 'apartment_admin', 'guest'];

export const UserForm = ({
  token,
  currentUser,
  targetUser,
  onSuccess,
  onCancel,
}: UserFormProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [role, setRole] = useState<User['role']>('guest');
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditing = !!targetUser;
  const canEditRole = currentUser.role === 'admin';
  const canEditApartment = currentUser.role === 'admin';
  const currentApartmentNumber = currentUser.apartment?.number ?? '';
  const isSelfDowngrade =
    currentUser.id === targetUser?.id && currentUser.role === 'admin' && role !== 'admin';

  useEffect(() => {
    setName(targetUser?.name ?? '');
    setEmail(targetUser?.email ?? '');
    setApartmentNumber(targetUser?.apartment?.number ?? currentApartmentNumber);
    setRole(targetUser?.role ?? 'guest');
  }, [targetUser, currentApartmentNumber]);

  useEffect(() => {
    const fetchApartments = async () => {
      try {
        const response = await api.get<Apartment[]>('/apartments', {
          headers: authHeaders(token),
        });
        setApartments(response.data);
      } catch {
        setApartments([]);
      }
    };

    fetchApartments();
  }, [token]);

  const availableApartments = useMemo(() => {
    if (!canEditApartment) {
      const ownApartment = apartments.find((apartment) => apartment.number === currentApartmentNumber);
      return ownApartment ? [ownApartment] : apartments;
    }

    return apartments;
  }, [apartments, canEditApartment, currentApartmentNumber]);

  const performSave = async () => {
    setError('');
    setStatus('');
    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        apartment: { number: apartmentNumber },
        role,
      };

      let response;
      if (targetUser) {
        response = await api.put<User>(`/users/${targetUser.id}`, payload, {
          headers: authHeaders(token),
        });
        setStatus('User updated.');
      } else {
        response = await api.post<User>('/users', payload, {
          headers: authHeaders(token),
        });
        setStatus('User created.');
      }

      onSuccess(response.data);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to save user.'));
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!isSelfDowngrade) {
      void performSave();
      return;
    }

    Alert.alert(
      'Warning: Role Downgrade',
      'You are about to downgrade your own admin role. This cannot be reversed without another admin or direct database access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Downgrade',
          style: 'destructive',
          onPress: () => {
            void performSave();
          },
        },
      ]
    );
  };

  const confirmDelete = () => {
    if (!targetUser) {
      return;
    }

    Alert.alert('Delete user', `Delete ${targetUser.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          setError('');
          setStatus('');
          try {
            await api.delete(`/users/${targetUser.id}`, {
              headers: authHeaders(token),
            });
            setStatus('User deleted.');
            onSuccess(null);
          } catch (nextError) {
            setError(apiErrorMessage(nextError, 'Failed to delete user.'));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <SectionCard title={isEditing ? `Edit: ${targetUser?.name}` : 'Add User'}>
      <View style={{ gap: 6 }}>
        <FieldLabel>Name</FieldLabel>
        <Input value={name} onChangeText={setName} placeholder="Name" />
      </View>

      <View style={{ gap: 6 }}>
        <FieldLabel>Email (Optional)</FieldLabel>
        <Input
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
        />
      </View>

      <View style={{ gap: 6 }}>
        <FieldLabel>Apartment</FieldLabel>
        {availableApartments.length > 0 ? (
          <Row>
            {availableApartments.map((apartment) => (
              <Button
                key={apartment.id}
                title={apartment.number}
                variant={apartmentNumber === apartment.number ? 'primary' : 'secondary'}
                onPress={() => setApartmentNumber(apartment.number)}
                disabled={!canEditApartment && apartment.number !== apartmentNumber}
              />
            ))}
          </Row>
        ) : (
          <Input
            value={apartmentNumber}
            onChangeText={setApartmentNumber}
            placeholder="Apartment number"
            editable={canEditApartment}
          />
        )}
        {!canEditApartment ? <SubtleText>Only admin can change apartment.</SubtleText> : null}
      </View>

      {canEditRole ? (
        <View style={{ gap: 6 }}>
          <FieldLabel>Role</FieldLabel>
          <Horizontal>
            {roleOptions.map((option) => (
              <Button
                key={option}
                title={option}
                variant={role === option ? 'primary' : 'secondary'}
                onPress={() => setRole(option)}
              />
            ))}
          </Horizontal>
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <FieldLabel>Role</FieldLabel>
          <Chip text={role} />
          <SubtleText>Only admin can change role.</SubtleText>
        </View>
      )}

      {status ? <Banner type="success" text={status} /> : null}
      {error ? <Banner type="error" text={error} /> : null}

      <Horizontal>
        <Button
          title={isEditing ? 'Save User' : 'Create User'}
          onPress={save}
          loading={saving}
          disabled={!name.trim() || !apartmentNumber}
          style={{ flexGrow: 1 }}
        />
        {isEditing ? <Button title="Delete" variant="danger" onPress={confirmDelete} /> : null}
      </Horizontal>

      {onCancel ? <Button title="Close" variant="ghost" onPress={onCancel} /> : null}
      {isSelfDowngrade ? (
        <Text style={{ color: '#92400e', fontSize: 12 }}>
          Admin self-downgrade will remove admin rights after save.
        </Text>
      ) : null}
    </SectionCard>
  );
};
