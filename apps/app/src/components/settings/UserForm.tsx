import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { roleDescription, roleLabel } from '../../lib/roles';
import { Apartment, User } from '../../types/entities';
import {
  Avatar,
  Banner,
  Button,
  Chip,
  FieldLabel,
  Input,
  SectionCard,
  SubtleText,
  palette,
} from '../common/ui';

interface UserFormProps {
  token: string;
  currentUser: User;
  targetUser: User | null;
  onSuccess: (updatedUser: User | null) => void;
  onCancel?: () => void;
  variant?: 'manage' | 'self';
}

const roleOptions: User['role'][] = ['apartment_admin', 'guest', 'admin'];

export const UserForm = ({
  token,
  currentUser,
  targetUser,
  onSuccess,
  onCancel,
  variant = 'manage',
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
  const isSelf = variant === 'self';
  const canEditRole = currentUser.role === 'admin' && !isSelf;
  const canEditApartment = currentUser.role === 'admin' && !isSelf;
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
        setStatus(isSelf ? 'Your details are saved.' : 'Changes saved.');
      } else {
        response = await api.post<User>('/users', payload, {
          headers: authHeaders(token),
        });
        setStatus('Person added.');
      }

      onSuccess(response.data);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Couldn’t save these details. Try again.'));
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
      'Give up building admin rights?',
      'You will lose access to building settings. Only another building admin can give them back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change my role',
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

    Alert.alert(`Remove ${targetUser.name}?`, 'Their PINs, cards, and schedules stop working and are deleted. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          setError('');
          setStatus('');
          try {
            await api.delete(`/users/${targetUser.id}`, {
              headers: authHeaders(token),
            });
            setStatus('Person removed.');
            onSuccess(null);
          } catch (nextError) {
            setError(apiErrorMessage(nextError, 'Couldn’t remove this person. Try again.'));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const roleChoices = roleOptions.includes(role) ? roleOptions : [...roleOptions, role];

  return (
    <SectionCard title={isSelf ? undefined : isEditing ? 'Details' : 'New person'}>
      {isSelf ? (
        <View style={formStyles.identity}>
          <Avatar name={name || currentUser.name} size={56} />
          <View style={formStyles.identityCopy}>
            <Text numberOfLines={1} style={formStyles.identityName}>{currentUser.name}</Text>
            <Text numberOfLines={1} style={formStyles.identityMeta}>
              {[roleLabel(currentUser.role), currentApartmentNumber ? `Apartment ${currentApartmentNumber}` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ gap: 6 }}>
        <FieldLabel>Name</FieldLabel>
        <Input value={name} onChangeText={setName} placeholder="Full name" autoComplete="name" />
      </View>

      <View style={{ gap: 6 }}>
        <FieldLabel>Email</FieldLabel>
        <Input
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
        />
        <SubtleText style={{ fontSize: 13 }}>
          {isSelf ? 'Sign-in codes are sent here.' : 'Needed only if this person signs in to the app.'}
        </SubtleText>
      </View>

      {!isSelf ? (
        <View style={{ gap: 6 }}>
          <FieldLabel>Apartment</FieldLabel>
          {availableApartments.length > 0 ? (
            <View style={formStyles.chipRow}>
              {availableApartments.map((apartment) => {
                const selected = apartmentNumber === apartment.number;
                const disabled = !canEditApartment && !selected;
                return (
                  <Pressable
                    key={apartment.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled }}
                    accessibilityLabel={`Apartment ${apartment.number}`}
                    disabled={disabled}
                    onPress={() => setApartmentNumber(apartment.number)}
                    style={[formStyles.choiceChip, selected ? formStyles.choiceChipSelected : null, disabled ? { opacity: 0.45 } : null]}
                  >
                    <Text style={[formStyles.choiceChipText, selected ? formStyles.choiceChipTextSelected : null]}>
                      {apartment.number}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Input
              value={apartmentNumber}
              onChangeText={setApartmentNumber}
              placeholder="Apartment number"
              editable={canEditApartment}
            />
          )}
          {!canEditApartment ? <SubtleText style={{ fontSize: 13 }}>Only a building admin can move people between apartments.</SubtleText> : null}
        </View>
      ) : null}

      {canEditRole ? (
        <View style={{ gap: 6 }}>
          <FieldLabel>Role</FieldLabel>
          <View accessibilityRole="radiogroup" style={formStyles.roleList}>
            {roleChoices.map((option) => {
              const selected = role === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setRole(option)}
                  style={({ pressed }) => [
                    formStyles.roleOption,
                    selected ? formStyles.roleOptionSelected : null,
                    pressed && !selected ? { opacity: 0.75 } : null,
                  ]}
                >
                  <View style={[formStyles.radio, selected ? formStyles.radioSelected : null]}>
                    {selected ? <View style={formStyles.radioDot} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={formStyles.roleTitle}>{roleLabel(option)}</Text>
                    <Text style={formStyles.roleDescription}>{roleDescription(option)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : !isSelf ? (
        <View style={{ gap: 6 }}>
          <FieldLabel>Role</FieldLabel>
          <Chip text={roleLabel(role)} />
          <SubtleText style={{ fontSize: 13 }}>Only a building admin can change roles.</SubtleText>
        </View>
      ) : null}

      {isSelfDowngrade ? (
        <Banner type="info" text="Saving will remove your building admin rights." />
      ) : null}
      {status ? <Banner type="success" text={status} /> : null}
      {error ? <Banner type="error" text={error} /> : null}

      <Button
        title={isSelf ? 'Save changes' : isEditing ? 'Save changes' : 'Add person'}
        onPress={save}
        loading={saving}
        disabled={!name.trim() || !apartmentNumber}
      />

      {isEditing && !isSelf ? (
        <Button
          title="Remove person"
          variant="ghost"
          icon={<Feather name="trash-2" size={16} color={palette.danger} />}
          textStyle={{ color: palette.danger }}
          onPress={confirmDelete}
          disabled={saving}
        />
      ) : null}

      {onCancel && !isEditing ? <Button title="Cancel" variant="ghost" onPress={onCancel} /> : null}
    </SectionCard>
  );
};

const formStyles = StyleSheet.create({
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 4,
  },
  identityCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  identityName: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '900',
  },
  identityMeta: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    alignItems: 'center',
    backgroundColor: palette.field,
    borderColor: palette.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 56,
    paddingHorizontal: 14,
  },
  choiceChipSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  choiceChipText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  choiceChipTextSelected: {
    color: '#fff',
  },
  roleList: {
    gap: 8,
  },
  roleOption: {
    alignItems: 'center',
    backgroundColor: palette.field,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  roleOptionSelected: {
    backgroundColor: palette.primarySoft,
    borderColor: palette.primary,
  },
  radio: {
    alignItems: 'center',
    borderColor: palette.borderStrong,
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioSelected: {
    borderColor: palette.primary,
  },
  radioDot: {
    backgroundColor: palette.primary,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  roleTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  roleDescription: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
