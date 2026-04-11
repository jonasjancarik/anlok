import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { Apartment, User } from '../../types/entities';
import { Banner, Button, Chip, Divider, PageScroll, Screen, SectionCard, SubtleText, palette } from '../common/ui';
import { Feather } from '@expo/vector-icons';
import { PinManagement } from './PinManagement';
import { RfidManagement } from './RfidManagement';
import { ScheduleManagement } from './ScheduleManagement';
import { UserForm } from './UserForm';

interface UserManagementProps {
  token: string;
  currentUser: User;
  isActive: boolean;
  onCurrentUserUpdated: (nextUser: User) => void;
}

type ModalType = 'user' | 'pins' | 'rfid' | 'schedule' | null;

const apartmentNumberForUser = (user: User) => user.apartment?.number ?? '';

export const UserManagement = ({
  token,
  currentUser,
  isActive,
  onCurrentUserUpdated,
}: UserManagementProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadApartments = useCallback(async () => {
    try {
      const response = await api.get<Apartment[]>('/apartments', {
        headers: authHeaders(token),
      });
      setApartments(response.data);
    } catch {
      setApartments([]);
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<User[]>('/users', {
        headers: authHeaders(token),
      });

      const currentApartmentNumber = currentUser.apartment?.number ?? '';
      const filtered =
        currentUser.role === 'admin' || !currentApartmentNumber
          ? response.data
          : response.data.filter(
              (item) => apartmentNumberForUser(item) === currentApartmentNumber
            );

      const sorted = [...filtered].sort((a, b) => {
        const apartmentA = apartmentNumberForUser(a);
        const apartmentB = apartmentNumberForUser(b);

        if (apartmentA === apartmentB) {
          return a.name.localeCompare(b.name);
        }

        return apartmentA.localeCompare(apartmentB, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });

      setUsers(sorted);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to fetch users.'));
    } finally {
      setLoading(false);
    }
  }, [token, currentUser.role, currentUser.apartment?.number]);

  useEffect(() => {
    loadApartments();
    loadUsers();
  }, [loadApartments, loadUsers]);

  useEffect(() => {
    if (isActive) {
      loadApartments();
      loadUsers();
    }
  }, [isActive, loadApartments, loadUsers]);

  const groupedUsers = useMemo(() => {
    const usersByApartment = new Map<string, User[]>();

    users.forEach((item) => {
      const apartmentNumber = apartmentNumberForUser(item) || 'Unknown';
      const group = usersByApartment.get(apartmentNumber) ?? [];
      group.push(item);
      usersByApartment.set(apartmentNumber, group);
    });

    return [...usersByApartment.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [users]);

  const openModal = (type: ModalType, user: User | null) => {
    setSelectedUser(user);
    setModalType(type);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setModalType(null);
  };

  const handleUserSaved = async (result: User | null) => {
    if (result && result.id === currentUser.id) {
      onCurrentUserUpdated(result);
    }

    setSuccess(result ? 'User saved.' : 'User deleted.');
    closeModal();
    await loadUsers();
  };

  const toggleUserActive = async (target: User) => {
    setError('');
    setSuccess('');

    try {
      const response = await api.put<User>(
        `/users/${target.id}`,
        { is_active: !target.is_active },
        { headers: authHeaders(token) }
      );

      setUsers((prev) =>
        prev.map((item) => (item.id === target.id ? { ...item, is_active: response.data.is_active } : item))
      );

      if (target.id === currentUser.id) {
        onCurrentUserUpdated({ ...target, is_active: response.data.is_active });
      }

      setSuccess(`User ${response.data.is_active ? 'activated' : 'deactivated'}.`);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to update user status.'));
    }
  };

  const roleColor = (role: User['role']) => {
    if (role === 'admin') {
      return 'danger';
    }

    if (role === 'apartment_admin') {
      return 'default';
    }

    return 'success';
  };

  return (
    <SectionCard title="Users">
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button title="Add User" size="small" icon={<Feather name="plus" size={14} color="#fff" />} onPress={() => openModal('user', null)} />
        <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
          <SubtleText style={{ fontSize: 12 }}>
            Apartments: {currentUser.role === 'admin' ? 'All' : currentUser.apartment?.number ?? 'Current'}
          </SubtleText>
        </View>
      </View>

      {success ? <Banner type="success" text={success} /> : null}
      {error ? <Banner type="error" text={error} /> : null}

      <Divider />
      {groupedUsers.length === 0 ? (
        <SubtleText>{loading ? 'Loading users...' : 'No users found.'}</SubtleText>
      ) : (
        <View style={{ gap: 16 }}>
          {groupedUsers.map(([apartmentNumber, apartmentUsers]) => (
            <View key={apartmentNumber} style={{ gap: 8 }}>
              <View style={{ backgroundColor: palette.canvas, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, alignSelf: 'flex-start' }}>
                <Text style={{ fontWeight: '800', fontSize: 14, color: palette.muted }}>Apartment {apartmentNumber}</Text>
              </View>
              
              {apartmentUsers.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: index === apartmentUsers.length - 1 ? 0 : 1,
                    borderBottomColor: palette.canvas,
                    gap: 10,
                    opacity: item.is_active ? 1 : 0.5,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={{ fontWeight: '700', fontSize: 16, color: palette.text }}>{item.name}</Text>
                      <SubtleText style={{ fontSize: 13 }}>{item.email || 'No email'}</SubtleText>
                    </View>
                    <Chip text={item.role} tone={roleColor(item.role)} />
                  </View>
                  
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <Button size="small" title="Edit" variant="secondary" icon={<Feather name="edit-2" size={12} color={palette.text} />} onPress={() => openModal('user', item)} />
                    <Button size="small" title="PINs" variant="secondary" icon={<Feather name="grid" size={12} color={palette.text} />} onPress={() => openModal('pins', item)} />
                    <Button size="small" title="RFIDs" variant="secondary" icon={<Feather name="radio" size={12} color={palette.text} />} onPress={() => openModal('rfid', item)} />
                    {item.role === 'guest' ? (
                      <Button
                        size="small"
                        title="Schedule"
                        variant="secondary"
                        icon={<Feather name="clock" size={12} color={palette.text} />}
                        onPress={() => openModal('schedule', item)}
                      />
                    ) : null}
                    <Button
                      size="small"
                      title={item.is_active ? 'Disable' : 'Enable'}
                      variant={item.is_active ? 'ghost' : 'secondary'}
                      icon={<Feather name={item.is_active ? 'slash' : 'check'} size={12} color={item.is_active ? palette.danger : palette.text} />}
                      disabled={currentUser.role === 'apartment_admin' && item.role === 'admin'}
                      onPress={() => toggleUserActive(item)}
                    />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      <Modal visible={modalType !== null} animationType="slide" onRequestClose={closeModal}>
        <Screen>
          <PageScroll>
            <Button
              title=""
              icon={<Feather name="x" size={24} color={palette.muted} />}
              variant="ghost"
              size="icon"
              onPress={closeModal}
              style={{ alignSelf: 'flex-start', marginBottom: 8, marginLeft: -8 }}
            />

            {modalType === 'user' ? (
              <UserForm
                token={token}
                currentUser={currentUser}
                targetUser={selectedUser}
                onSuccess={handleUserSaved}
                onCancel={closeModal}
              />
            ) : null}

            {modalType === 'pins' && selectedUser ? (
              <PinManagement token={token} user={selectedUser} />
            ) : null}

            {modalType === 'rfid' && selectedUser ? (
              <RfidManagement token={token} user={selectedUser} />
            ) : null}

            {modalType === 'schedule' && selectedUser ? (
              <ScheduleManagement token={token} user={selectedUser} />
            ) : null}
          </PageScroll>
        </Screen>
      </Modal>

      {apartments.length === 0 ? null : <SubtleText style={{ marginTop: 12, textAlign: 'center', fontSize: 12 }}>Total apartments configured: {apartments.length}</SubtleText>}
    </SectionCard>
  );
};
